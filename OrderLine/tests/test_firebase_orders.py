"""Firebase order behavior without credentials or a running Firestore server."""
import asyncio
from copy import deepcopy
from types import SimpleNamespace
import unittest
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException
from fastapi.testclient import TestClient

import firebase_store as store
import firebase_routes as routes
from firebase_main import app
from foodlink_core.firebase import AuthenticationError


class FirebaseHealthTests(unittest.TestCase):
    @patch('foodlink_core.firebase.initialize', side_effect=AssertionError('Health must not initialize Firebase'))
    def test_health_is_public_and_independent_of_firebase(self, initialize):
        response = TestClient(app).get('/healthz', headers={'Authorization': 'Bearer invalid'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'status': 'ok', 'service': 'orderline'})
        initialize.assert_not_called()


def identity(uid='customer', role='customer'):
    return SimpleNamespace(uid=uid, email=f'{uid}@example.test', role=role, claims={})


class Snapshot:
    def __init__(self, data, identifier):
        self.id = identifier
        self.data = deepcopy(data)
        self.exists = data is not None
    def to_dict(self):
        return deepcopy(self.data)


class Reference:
    def __init__(self, database, collection, key):
        self.database, self.collection, self.key = database, collection, key
    def get(self, transaction=None):
        if transaction:
            transaction.assert_readable()
        return Snapshot(self.database.data.get((self.collection, self.key)), self.key)


class Collection:
    def __init__(self, database, name, field=None, value=None):
        self.database, self.name, self.field, self.value = database, name, field, value
    def document(self, key):
        return Reference(self.database, self.name, key)
    def where(self, filter):
        return Collection(self.database, self.name, filter.field_path, filter.value)
    def stream(self, transaction=None):
        if transaction:
            transaction.assert_readable()
        return [Snapshot(value, identifier) for (collection, identifier), value in self.database.data.items()
                if collection == self.name and (self.field is None or value.get(self.field) == self.value)]


class Transaction:
    def __init__(self, database):
        self.database, self.writes = database, []
    def assert_readable(self):
        assert not self.writes, 'Firestore reads must precede all writes'
    def create(self, ref, value):
        self.writes.append(('create', ref, deepcopy(value)))
    def update(self, ref, value):
        self.writes.append(('update', ref, deepcopy(value)))
    def delete(self, ref):
        self.writes.append(('delete', ref, None))
    def commit(self):
        for operation, ref, value in self.writes:
            key = (ref.collection, ref.key)
            if operation == 'delete':
                self.database.data.pop(key, None)
            elif operation == 'create':
                assert key not in self.database.data
                self.database.data[key] = value
            else:
                self.database.data[key].update(value)


def transactional(function):
    def run(transaction):
        result = function(transaction)
        transaction.commit()
        return result
    return run


class Database:
    def __init__(self):
        self.data, self.counters = {}, {}
    def collection(self, name):
        return Collection(self, name)
    def transaction(self):
        return Transaction(self)
    def allocate(self, collection, transaction=None):
        transaction.assert_readable()
        self.counters[collection] = self.counters.get(collection, 0) + 1
        # Model the real allocator's counter write, detecting any later reads.
        transaction.create(Reference(self, '_fake_counters', f'{collection}-{self.counters[collection]}'), {})
        return self.counters[collection]


class FirebaseOrderTests(unittest.TestCase):
    def setUp(self):
        self.database = Database()
        self.database.data.update({
            ('restaurants', '1'): {'id': 1, 'owner_uid': 'owner'},
            ('restaurants', '2'): {'id': 2, 'owner_uid': 'other-owner'},
            ('menu_items', '1'): {'id': 1, 'restaurant_id': 1, 'price_cents': 1299, 'name': 'Soup', 'is_available': True},
            ('menu_items', '2'): {'id': 2, 'restaurant_id': 2, 'price_cents': 500, 'name': 'Bread'},
        })
        self.patches = [patch.object(store, 'db', return_value=self.database),
                        patch.object(store, 'allocate_id', side_effect=self.database.allocate),
                        patch.object(store.firestore, 'transactional', side_effect=transactional)]
        for patched in self.patches:
            patched.start()
        self.caller = identity()
        app.dependency_overrides[routes.authenticated] = lambda: self.caller
        self.client = TestClient(app)

    def tearDown(self):
        app.dependency_overrides.clear()
        for patched in reversed(self.patches):
            patched.stop()

    def order(self):
        response = self.client.post('/orders/', json={'user_id': 'customer', 'restaurant_id': 1})
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()['id']

    def item(self, order, **changes):
        payload = {'order_id': order, 'menu_item_id': 1, 'quantity': 2, 'price': 0.01} | changes
        return self.client.post('/order-item/', json=payload)

    def test_server_prices_atomic_total_quantity_and_delete(self):
        order = self.order()
        created = self.item(order)
        self.assertEqual(created.status_code, 200, created.text)
        item = created.json()
        self.assertEqual((item['price'], item['name']), (12.99, 'Soup'))
        updated = self.client.put(f"/order-item/{item['id']}/", json={'quantity': 3, 'price': 0})
        self.assertEqual(updated.status_code, 200, updated.text)
        full = self.client.get(f'/orders/{order}/').json()
        self.assertEqual(full['total_price'], 38.97)
        self.assertEqual(self.database.data[('orders', str(order))]['total_cents'], 3897)
        self.assertEqual(full['items'][0]['quantity'], 3)
        self.assertEqual(self.client.delete(f"/order-item/{item['id']}/").status_code, 200)
        self.assertEqual(self.client.get(f'/orders/{order}/').json()['total_price'], 0)

    def test_cannot_forge_owner_or_move_restaurant(self):
        self.assertEqual(self.client.post('/orders/', json={'user_id': 'victim', 'restaurant_id': 1}).status_code, 403)
        order = self.order()
        self.assertEqual(self.client.put(f'/orders/{order}/', json={'user_id': 'victim'}).status_code, 403)
        self.assertEqual(self.client.put(f'/orders/{order}/', json={'restaurant_id': 2}).status_code, 409)
        self.assertEqual(self.item(order, menu_item_id=2).status_code, 409)
        self.assertEqual(self.client.get(f'/orders/{order}/').json()['total_price'], 0)

    def test_customer_other_owner_and_admin_permissions(self):
        order = self.order()
        self.caller = identity('other')
        for path in [f'/orders/{order}/', f'/order-item/{order}/', f'/order-status/{order}/']:
            self.assertEqual(self.client.get(path).status_code, 403)
        self.assertEqual(self.client.get('/orders/?user_id=customer').status_code, 403)
        self.caller = identity('owner', 'restaurant_owner')
        self.assertEqual(self.client.get(f'/orders/{order}/').status_code, 200)
        self.assertEqual(len(self.client.get('/orders/?all=true').json()), 1)
        self.caller = identity('other-owner', 'restaurant_owner')
        self.assertEqual(self.client.get(f'/orders/{order}/').status_code, 403)
        self.assertEqual(self.client.get('/orders/?all=true').json(), [])
        self.caller = identity('administrator', 'admin')
        self.assertEqual(self.client.get(f'/orders/{order}/').status_code, 200)
        self.assertEqual(len(self.client.get('/orders/?all=true').json()), 1)

    def test_status_transitions_lock_checkout_and_management_delivery(self):
        order = self.order()
        self.assertEqual(self.client.post('/order-status/', json={'order_id': order, 'status': 'active'}).status_code, 409)
        self.item(order)
        self.assertEqual(self.client.post('/order-status/', json={'order_id': order, 'status': 'active'}).status_code, 200)
        self.assertEqual(self.item(order).status_code, 409)
        self.assertEqual(self.client.post('/order-status/', json={'order_id': order, 'status': 'delivered'}).status_code, 403)
        self.caller = identity('owner', 'restaurant_owner')
        self.assertEqual(self.client.post('/order-status/', json={'order_id': order, 'status': 'delivered'}).status_code, 200)
        self.assertEqual([status['status'] for status in self.client.get(f'/order-status/{order}/').json()], ['active', 'delivered'])
        self.assertEqual(self.client.post('/order-status/', json={'order_id': order, 'status': 'cancelled'}).status_code, 409)

    def test_delivery_address_is_a_validated_locked_order_snapshot(self):
        order = self.order()
        address = {'label': 'Office', 'city': 'Haifa', 'street_name': 'Main', 'house_number': 12}
        self.assertEqual(self.client.put(f'/orders/{order}/', json={'delivery_address': {**address, 'city': ' '}}).status_code, 422)
        self.caller = identity('owner', 'restaurant_owner')
        self.assertEqual(self.client.put(f'/orders/{order}/', json={'delivery_address': address}).status_code, 403)
        self.caller = identity()
        saved = self.client.put(f'/orders/{order}/', json={'delivery_address': address})
        self.assertEqual(saved.status_code, 200, saved.text)
        self.assertEqual(saved.json()['delivery_address'], {**address, 'house_number': '12'})
        self.assertEqual(self.client.put(f'/orders/{order}/', json={'delivery_address': None}).status_code, 422)
        self.item(order)
        self.client.post('/order-status/', json={'order_id': order, 'status': 'active'})
        self.assertEqual(self.client.put(f'/orders/{order}/', json={'delivery_address': {**address, 'city': 'Tel Aviv'}}).status_code, 409)
        self.assertEqual(self.client.get(f'/orders/{order}/').json()['delivery_address']['city'], 'Haifa')

    def test_negative_quantities_rejected_and_zero_allowed(self):
        order = self.order()
        self.assertEqual(self.item(order, quantity=-1).status_code, 422)
        self.assertEqual(self.item(order, quantity=True).status_code, 422)
        self.assertEqual(self.item(order, quantity=0).status_code, 200)

    def test_http_auth_missing_invalid_and_valid_token(self):
        app.dependency_overrides.clear()
        self.assertEqual(self.client.get('/orders/').status_code, 401)
        with patch.object(routes, 'verify_id_token', side_effect=AuthenticationError('bad')):
            self.assertEqual(self.client.get('/orders/', headers={'Authorization': 'Bearer invalid'}).status_code, 401)
        with patch.object(routes, 'verify_id_token', return_value=identity()):
            self.assertEqual(self.client.get('/orders/', headers={'Authorization': 'Bearer valid'}).status_code, 200)

    def test_websocket_requires_first_frame_auth_and_checks_owner(self):
        order = self.order()
        with self.client.websocket_connect(f'/ws/order-status/{order}?token=ignored') as socket:
            self.assertNotIn(order, routes.manager.active_connections)
            socket.send_json({'type': 'wrong', 'token': 'invalid'})
            self.assertEqual(socket.receive()['code'], 4401)
        with self.client.websocket_connect(f'/ws/order-status/{order}') as socket:
            socket.send_bytes(b'not-json')
            self.assertEqual(socket.receive()['code'], 4401)
        with patch.object(routes, 'verify_id_token', side_effect=AuthenticationError('invalid')):
            with self.client.websocket_connect(f'/ws/order-status/{order}') as socket:
                socket.send_json({'type': 'auth', 'token': 'invalid'})
                self.assertEqual(socket.receive()['code'], 4401)
        with patch.object(routes, 'verify_id_token', return_value=identity('other')):
            with self.client.websocket_connect(f'/ws/order-status/{order}') as socket:
                socket.send_json({'type': 'auth', 'token': 'other'})
                self.assertEqual(socket.receive()['code'], 4403)
        with patch.object(routes, 'verify_id_token', return_value=identity()):
            with self.client.websocket_connect(f'/ws/order-status/{order}') as socket:
                socket.send_json({'type': 'auth', 'token': 'valid'})
                # Mutating through HTTP proves registration and delivery after authentication.
                self.item(order)
                self.client.post('/order-status/', json={'order_id': order, 'status': 'active'})
                self.assertEqual(socket.receive_text(), 'active')
                self.caller = identity('owner', 'restaurant_owner')
                delivered = self.client.post('/order-status/', json={'order_id': order, 'status': 'delivered'})
                self.assertEqual(delivered.status_code, 200, delivered.text)
                self.assertEqual(socket.receive_text(), 'delivered')
                self.caller = identity()
                refreshed = self.client.get(f'/orders/{order}/').json()
                self.assertEqual(refreshed['status'][-1]['status'], 'delivered')
                self.assertIn('updated_at', refreshed['status'][-1])
        self.assertNotIn(order, routes.manager.active_connections)


    def test_websocket_auth_timeout_does_not_register_subscriber(self):
        socket = SimpleNamespace(accept=AsyncMock(), close=AsyncMock(),
                                 receive_json=AsyncMock(side_effect=asyncio.TimeoutError))
        asyncio.run(routes.order_status_socket(socket, 99))
        socket.close.assert_awaited_once_with(code=4401)
        self.assertNotIn(99, routes.manager.active_connections)

    def test_no_bearer_auth_errors_use_consistent_challenge(self):
        app.dependency_overrides.clear()
        for headers in [{}, {'Authorization': 'Basic eA=='}, {'Authorization': 'Bearer'}]:
            response = self.client.get('/orders/', headers=headers)
            self.assertEqual(response.status_code, 401)
            self.assertEqual(response.headers['www-authenticate'], 'Bearer')
