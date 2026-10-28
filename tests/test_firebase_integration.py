"""Opt-in real emulator/API contract tests, never real Firebase projects.

Start Auth9099, Firestore8080 and the three Firebase API services first, then:
FOODLINK_FIREBASE_INTEGRATION=1 FIREBASE_PROJECT_ID=demo-foodlink \
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
OrderLine/venv/bin/python -m unittest discover -s tests -p test_firebase_integration.py -v
"""
from concurrent.futures import ThreadPoolExecutor
import json
import os
from pathlib import Path
import subprocess
import sys
import time
import unittest
from urllib.error import HTTPError
from urllib.parse import urlencode, urlsplit
from urllib.request import Request, urlopen
import uuid

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from firebase_admin import auth
from foodlink_core.firebase import configuration, db
from foodlink_core.repository import allocate_id


def http(method, url, data=None, token=None):
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    request = Request(url, method=method, headers=headers,
                      data=json.dumps(data).encode() if data is not None else None)
    try:
        response = urlopen(request, timeout=30)
    except HTTPError as error:
        response = error
    with response:
        raw = response.read().decode()
        try:
            value = json.loads(raw) if raw else None
        except json.JSONDecodeError:
            value = {'detail': 'Non-JSON server response'}
        return response.status, value


def loopback(url):
    address = urlsplit(url)
    if address.scheme not in ('http', 'ws') or address.hostname not in ('localhost', '127.0.0.1', '::1'):
        raise RuntimeError('Integration tests only permit loopback HTTP/WebSocket endpoints')
    if address.username or address.password:
        raise RuntimeError('Access-bearing endpoint URLs are not permitted')
    return url.rstrip('/')


@unittest.skipUnless(os.getenv('FOODLINK_FIREBASE_INTEGRATION') == '1', 'Opt-in emulator integration suite')
class FirebaseApiIntegration(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        project, auth_host, store_host = configuration()
        if not project.startswith('demo-') or not auth_host or not store_host:
            raise RuntimeError('Integration writes require demo project and both emulators')
        loopback('http://' + auth_host)
        loopback('http://' + store_host)
        cls.users_url = loopback(os.getenv('FOODLINK_USERBASE_URL', 'http://127.0.0.1:8001'))
        cls.menu_url = loopback(os.getenv('FOODLINK_DISHBOARD_URL', 'http://127.0.0.1:8002'))
        cls.orders_url = loopback(os.getenv('FOODLINK_ORDERLINE_URL', 'http://127.0.0.1:8003'))
        cls.auth_url = f'http://{auth_host}/identitytoolkit.googleapis.com/v1/accounts:'
        cls.run_id = uuid.uuid4().hex[:10]
        cls.accounts = []
        cls.documents = set()
        db()
        cls.addClassCleanup(cls.cleanup)
        cls.admin = cls.signup('admin', 'admin')
        cls.customer = cls.signup('customer', 'customer')
        cls.other = cls.signup('other', 'customer')
        cls.owner = cls.signup('owner', 'restaurant_owner')
        cls.restaurant = cls.create_restaurant(cls.admin['uid'])
        cls.owner_restaurant = cls.create_restaurant(cls.owner['uid'])
        status, cls.category = http('POST', cls.menu_url + '/api/menu/category/', {
            'name': 'Integration Main', 'restaurant': cls.restaurant['id'],
        }, cls.admin['token'])
        if status != 201:
            raise AssertionError(f'Category fixture failed: HTTP {status}')
        cls.documents.add(('menu_categories', str(cls.category['id'])))
        status, cls.item = http('POST', cls.menu_url + '/api/menu/item/', {
            'name': 'Integration Dish', 'category': cls.category['id'], 'price': '25.00',
        }, cls.admin['token'])
        if status != 201:
            raise AssertionError(f'Menu fixture failed: HTTP {status}')
        cls.documents.add(('menu_items', str(cls.item['id'])))

    @classmethod
    def signup(cls, label, role):
        email = f'{label}-{cls.run_id}@example.test'
        password = 'FoodLink-test-123'
        status, account = http('POST', cls.auth_url + 'signUp?key=emulator-only', {
            'email': email, 'password': password, 'returnSecureToken': True,
        })
        if status != 200:
            raise AssertionError(f'Auth emulator signup failed: HTTP {status}')
        uid = account['localId']
        cls.accounts.append(uid)
        auth.set_custom_user_claims(uid, {'role': role})
        status, session = http('POST', cls.auth_url + 'signInWithPassword?key=emulator-only', {
            'email': email, 'password': password, 'returnSecureToken': True,
        })
        if status != 200:
            raise AssertionError(f'Auth emulator sign-in failed: HTTP {status}')
        return {'uid': uid, 'token': session['idToken']}

    @classmethod
    def create_restaurant(cls, owner_uid):
        status, value = http('POST', cls.menu_url + '/api/restaurants/info/', {
            'name': f'Integration {cls.run_id}', 'city': 'Haifa', 'address': str(uuid.uuid4()),
            'owner_uid': owner_uid,
        }, cls.admin['token'])
        if status != 201:
            raise AssertionError(f'Restaurant fixture failed: HTTP {status}')
        cls.documents.add(('restaurants', str(value['id'])))
        status, hours = http('GET', cls.menu_url + f"/api/restaurants/opening-houers/?restaurant_id={value['id']}")
        if status == 200:
            cls.documents.update(('opening_hours', str(hour['id'])) for hour in hours)
        return value

    @classmethod
    def cleanup(cls):
        # Delete only IDs created by this run, never sweep or reset emulators.
        if not cls.accounts and not cls.documents:
            return
        client = db()
        for collection, identifier in cls.documents:
            client.collection(collection).document(identifier).delete(retry=None, timeout=5)
        for uid in cls.accounts:
            client.collection('users').document(uid).delete(retry=None, timeout=5)
            try:
                auth.delete_user(uid)
            except auth.UserNotFoundError:
                pass
        client.collection('_counters').document('integration_ids_' + cls.run_id).delete(retry=None, timeout=5)

    def request(self, expected, method, base, path, data=None, identity=None):
        status, value = http(method, base + path, data, identity['token'] if identity else None)
        self.assertEqual(status, expected, f'{method} {path}: expected {expected}, received {status}; {value}')
        return value

    def new_order(self, restaurant=None):
        value = self.request(200, 'POST', self.orders_url, '/orders/', {
            'user_id': self.customer['uid'], 'restaurant_id': (restaurant or self.restaurant)['id'],
        }, self.customer)
        self.documents.add(('orders', str(value['id'])))
        return value

    def add_item(self, order, quantity=1):
        value = self.request(200, 'POST', self.orders_url, '/order-item/', {
            'order_id': order['id'], 'menu_item_id': self.item['id'], 'quantity': quantity, 'price': 0.01,
        }, self.customer)
        self.documents.add(('order_items', str(value['id'])))
        return value

    def add_status(self, expected, order, state, identity):
        value = self.request(expected, 'POST', self.orders_url, '/order-status/', {
            'order_id': order['id'], 'status': state,
        }, identity)
        if expected == 200:
            self.documents.add(('order_statuses', str(value['id'])))
        return value

    def test_profile_claims_and_administrator_boundaries(self):
        self.request(401, 'GET', self.users_url, '/api/users/profile/')
        profile = self.request(201, 'POST', self.users_url, '/api/users/register/', {
            'username': 'Integration Customer', 'city': 'Haifa', 'phone_number': '0500000000',
        }, self.customer)
        self.assertEqual(profile['id'], self.customer['uid'])
        self.assertEqual(profile['user_type'], 'customer')
        self.request(400, 'PATCH', self.users_url, '/api/users/profile/', {'user_type': 'admin'}, self.customer)
        self.request(403, 'GET', self.users_url, '/api/admin/users/', identity=self.customer)
        users = self.request(200, 'GET', self.users_url, '/api/admin/users/', identity=self.admin)
        self.assertIn(self.customer['uid'], [user['id'] for user in users])
        self.request(403, 'GET', self.users_url, '/api/admin/stats/', identity=self.customer)
        self.request(200, 'GET', self.users_url, '/api/admin/stats/', identity=self.admin)

    def test_restaurant_and_menu_ownership(self):
        self.request(200, 'PATCH', self.menu_url, f"/api/restaurants/info/{self.owner_restaurant['id']}/",
                     {'city': 'Tel Aviv'}, self.owner)
        self.request(403, 'PATCH', self.menu_url, f"/api/restaurants/info/{self.restaurant['id']}/",
                     {'city': 'Tel Aviv'}, self.owner)
        self.request(403, 'POST', self.menu_url, '/api/menu/category/',
                     {'name': 'Forbidden', 'restaurant': self.restaurant['id']}, self.customer)
        self.request(401, 'POST', self.menu_url, '/api/menu/category/',
                     {'name': 'Unauthenticated', 'restaurant': self.restaurant['id']})
        category = self.request(201, 'POST', self.menu_url, '/api/menu/category/',
                     {'name': 'Owner Main', 'restaurant': self.owner_restaurant['id']}, self.owner)
        self.documents.add(('menu_categories', str(category['id'])))
        own_item = self.request(201, 'POST', self.menu_url, '/api/menu/item/', {
            'name': 'Owner Dish', 'category': category['id'], 'price': '25.00',
        }, self.owner)
        self.documents.add(('menu_items', str(own_item['id'])))
        own_order = self.new_order(self.owner_restaurant)
        own_order_item = self.request(200, 'POST', self.orders_url, '/order-item/', {
            'order_id': own_order['id'], 'menu_item_id': own_item['id'], 'quantity': 1,
        }, self.customer)
        self.documents.add(('order_items', str(own_order_item['id'])))
        self.request(200, 'GET', self.orders_url, f"/orders/{own_order['id']}/", identity=self.owner)
        other_restaurant_order = self.new_order()
        self.request(403, 'GET', self.orders_url, f"/orders/{other_restaurant_order['id']}/", identity=self.owner)
        self.add_status(200, own_order, 'active', self.customer)
        self.add_status(200, own_order, 'delivered', self.owner)
        self.request(403, 'POST', self.menu_url, '/api/menu/category/',
                     {'name': 'Wrong Owner', 'restaurant': self.restaurant['id']}, self.owner)
        self.request(403, 'PATCH', self.menu_url, f"/api/restaurants/info/{self.owner_restaurant['id']}/",
                     {'owner_uid': self.other['uid']}, self.owner)

    def test_order_pricing_totals_and_cross_user_isolation(self):
        self.request(401, 'GET', self.orders_url, '/orders/')
        self.request(403, 'POST', self.orders_url, '/orders/', {
            'user_id': self.other['uid'], 'restaurant_id': self.restaurant['id'],
        }, self.customer)
        order = self.new_order()
        self.assertIsInstance(order['id'], int)
        self.assertEqual(order['user_id'], self.customer['uid'])
        item = self.add_item(order, 2)
        self.assertEqual(item['price'], 25)
        self.request(200, 'PUT', self.orders_url, f"/order-item/{item['id']}/", {'quantity': 3, 'price': 0.01}, self.customer)
        detail = self.request(200, 'GET', self.orders_url, f"/orders/{order['id']}/", identity=self.customer)
        self.assertEqual(detail['total_price'], 75)
        updated = self.request(200, 'PUT', self.orders_url, f"/orders/{order['id']}/", {'total_price': 0.01}, self.customer)
        self.assertEqual(updated['total_price'], 75)
        self.request(403, 'GET', self.orders_url, f"/orders/{order['id']}/", identity=self.other)
        self.request(403, 'GET', self.orders_url, '/orders/?' + urlencode({'user_id': self.customer['uid']}), identity=self.other)
        self.request(403, 'PUT', self.orders_url, f"/order-item/{item['id']}/", {'quantity': 99}, self.other)
        self.add_status(200, order, 'active', self.customer)
        self.request(409, 'PUT', self.orders_url, f"/order-item/{item['id']}/", {'quantity': 2}, self.customer)
        self.add_status(403, order, 'delivered', self.customer)
        self.add_status(200, order, 'delivered', self.admin)
        history = self.request(200, 'GET', self.orders_url, f"/order-status/{order['id']}/", identity=self.customer)
        self.assertEqual([entry['status'] for entry in history], ['active', 'delivered'])

    def test_item_validation_and_draft_deletion(self):
        order = self.new_order()
        self.request(422, 'POST', self.orders_url, '/order-item/', {
            'order_id': order['id'], 'menu_item_id': self.item['id'], 'quantity': -1,
        }, self.customer)
        self.request(422, 'POST', self.orders_url, '/order-item/', {
            'order_id': order['id'], 'menu_item_id': self.item['id'], 'quantity': 1001,
        }, self.customer)
        wrong_restaurant_order = self.new_order(self.owner_restaurant)
        self.request(409, 'POST', self.orders_url, '/order-item/', {
            'order_id': wrong_restaurant_order['id'], 'menu_item_id': self.item['id'], 'quantity': 1,
        }, self.customer)
        item = self.add_item(order)
        self.request(200, 'DELETE', self.orders_url, f"/order-item/{item['id']}/", identity=self.customer)
        detail = self.request(200, 'GET', self.orders_url, f"/orders/{order['id']}/", identity=self.customer)
        self.assertEqual(detail['total_price'], 0)
        self.assertEqual(detail['items'], [])
        self.add_status(409, order, 'active', self.customer)
        self.request(200, 'DELETE', self.orders_url, f"/orders/{order['id']}/", identity=self.customer)
        self.request(404, 'GET', self.orders_url, f"/orders/{order['id']}/", identity=self.customer)

    def test_concurrent_numeric_id_allocation(self):
        collection = 'integration_ids_' + self.run_id
        with ThreadPoolExecutor(max_workers=4) as pool:
            identifiers = list(pool.map(lambda _: allocate_id(collection), range(8)))
        self.assertEqual(sorted(identifiers), list(range(1, 9)))

    def test_firebase_entrypoints_do_not_import_sql_models(self):
        targets = [
            ('UserBase', 'user_base.firebase_settings', 'user_base.firebase_urls', ('users.models',)),
            ('DishBoard', 'dish_board.firebase_settings', 'dish_board.firebase_urls', ('restaurant.models', 'menu.models')),
            ('OrderLine', None, 'firebase_main', ('database', 'models.order_model', 'sqlalchemy')),
        ]
        for service, settings, module, forbidden in targets:
            code = "import os,sys,importlib; "
            code += f"sys.path[:0]=[{str(ROOT)!r},{str(ROOT / service)!r}]; "
            if settings:
                code += f"os.environ['DJANGO_SETTINGS_MODULE']={settings!r}; import django; django.setup(); "
            code += f"importlib.import_module({module!r}); assert not any(name in sys.modules for name in {forbidden!r})"
            environment = dict(os.environ, PYTHON_DOTENV_DISABLED='1')
            result = subprocess.run([str(ROOT / service / 'venv/bin/python'), '-c', code],
                                    env=environment, capture_output=True, text=True, timeout=30)
            self.assertEqual(result.returncode, 0, f'{service} Firebase entrypoint imported a SQL dependency or failed startup')

    def test_authenticated_websocket_order_isolation(self):
        try:
            from websockets.sync.client import connect
            from websockets.exceptions import ConnectionClosed
        except ImportError:
            self.skipTest('Run with OrderLine venv for websockets sync client')
        first, second = self.new_order(), self.new_order()
        self.add_item(first)
        self.add_item(second)
        base = self.orders_url.replace('http://', 'ws://')
        with connect(base + f"/ws/order-status/{first['id']}", open_timeout=10) as one:
            with connect(base + f"/ws/order-status/{second['id']}", open_timeout=10) as two:
                one.send(json.dumps({'type': 'auth', 'token': self.customer['token']}))
                two.send(json.dumps({'type': 'auth', 'token': self.customer['token']}))
                time.sleep(0.3)  # Endpoint intentionally retains plain statuses, without an auth ACK.
                self.add_status(200, first, 'active', self.customer)
                self.add_status(200, second, 'active', self.customer)
                self.assertEqual(one.recv(timeout=5), 'active')
                self.assertEqual(two.recv(timeout=5), 'active')
                self.add_status(200, first, 'cancelled', self.customer)
                self.add_status(200, second, 'delivered', self.admin)
                self.assertEqual(one.recv(timeout=5), 'cancelled')
                self.assertEqual(two.recv(timeout=5), 'delivered')
        with connect(base + f"/ws/order-status/{first['id']}", open_timeout=10) as denied:
            denied.send(json.dumps({'type': 'auth', 'token': self.other['token']}))
            with self.assertRaises(ConnectionClosed) as caught:
                denied.recv(timeout=5)
            self.assertEqual(caught.exception.rcvd.code, 4403)


if __name__ == '__main__':
    unittest.main()
