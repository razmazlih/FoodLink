"""Run with: venv/bin/python -m unittest discover -s tests -v."""
import importlib
import os
import unittest
from unittest.mock import patch
from datetime import datetime

# Import production routes with an engine that cannot reach a real database.
with patch.dict(os.environ, TEST_DATABASE="True", PYTHON_DOTENV_DISABLED="1"):
    import database

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient
from models.base import Base
from models.order_model import OrderModel
from models.order_item_model import OrderItemModel
from models.order_status_model import OrderStatusModel
from routes.order_status_websocket import ConnectionManager

with patch("init_db.init_db"), patch.dict(os.environ, CORS_ALLOWED_ORIGINS="", PYTHON_DOTENV_DISABLED="1"):
    import main


class OrderContracts(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)
        def db_override():
            with self.Session() as session:
                yield session
        main.app.dependency_overrides[database.get_db] = db_override
        self.client = TestClient(main.app)

    def tearDown(self):
        main.app.dependency_overrides.clear()
        self.engine.dispose()

    def test_order_items_total_status_and_read_only_total_update(self):
        created = self.client.post("/orders/", json={"user_id": 1, "restaurant_id": 2})
        self.assertEqual(created.status_code, 200, created.text)
        order_id = created.json()["id"]
        self.assertEqual(self.client.post("/order-item/", json={"order_id": order_id, "menu_item_id": 3, "quantity": 2, "price": 12.5}).status_code, 200)
        self.assertEqual(self.client.post("/order-status/", json={"order_id": order_id, "status": "Preparing"}).status_code, 200)
        response = self.client.put(f"/orders/{order_id}/", json={"total_price": 999, "restaurant_id": 4})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["total_price"], 25)
        detail = self.client.get(f"/orders/{order_id}/").json()
        self.assertEqual(detail["restaurant_id"], 4)
        self.assertEqual(detail["status"][0]["status"], "Preparing")
        self.assertEqual(detail["items"][0]["quantity"], 2)
        self.assertEqual(self.client.delete(f"/orders/{order_id}/").status_code, 200)
        self.assertEqual(self.client.get(f"/orders/{order_id}/").status_code, 404)

    def test_delivery_address_snapshot_persists_and_locks_after_submission(self):
        order_id = self.client.post('/orders/', json={'user_id': 1, 'restaurant_id': 2}).json()['id']
        address = {'label': 'Home', 'city': 'Haifa', 'street_name': 'Main', 'house_number': '12A'}
        response = self.client.put(f'/orders/{order_id}/', json={'delivery_address': address})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(self.client.get(f'/orders/{order_id}/').json()['delivery_address'], address)
        self.client.post('/order-status/', json={'order_id': order_id, 'status': 'active'})
        self.assertEqual(self.client.put(f'/orders/{order_id}/', json={'delivery_address': {**address, 'city': 'Other'}}).status_code, 409)
        self.assertEqual(self.client.get(f'/orders/{order_id}/').json()['delivery_address'], address)

    def test_websocket_clients_receive_only_their_order_status_history(self):
        ids = [self.client.post("/orders/", json={"user_id": 1, "restaurant_id": 2}).json()["id"] for _ in range(2)]
        with self.client.websocket_connect(f"/ws/order-status/{ids[0]}") as first:
            with self.client.websocket_connect(f"/ws/order-status/{ids[1]}") as second:
                for order_id, status in [(ids[0], "Preparing"), (ids[1], "Delivered")]:
                    response = self.client.post("/order-status/", json={"order_id": order_id, "status": status})
                    self.assertEqual(response.status_code, 200)
                self.assertEqual(first.receive_text(), "Preparing")
                self.assertEqual(second.receive_text(), "Delivered")
                self.client.post("/order-status/", json={"order_id": ids[0], "status": "Ready"})
                self.assertEqual(first.receive_text(), "Ready")
        history = self.client.get(f"/order-status/{ids[0]}/").json()
        self.assertEqual([entry["status"] for entry in history], ["Preparing", "Ready"])

    def test_list_eager_loads_items_and_status_in_three_queries(self):
        with self.Session() as session:
            for _ in range(5):
                order = OrderModel(user_id=1, restaurant_id=2, ordered_at=datetime.now())
                order.items.append(OrderItemModel(menu_item_id=3, quantity=2, price=5))
                session.add(order)
            session.commit()
        statements = []
        def count(*args):
            statements.append(args[2])
        event.listen(self.engine, "before_cursor_execute", count)
        try:
            response = self.client.get("/orders/?user_id=1")
        finally:
            event.remove(self.engine, "before_cursor_execute", count)
        self.assertEqual(response.status_code, 200)
        self.assertEqual([order["total_price"] for order in response.json()], [10] * 5)
        self.assertEqual(len(statements), 3)

    def test_cors_default_allows_startup_without_env(self):
        with patch("init_db.init_db"), patch("dotenv.load_dotenv"), patch.dict(os.environ):
            os.environ.pop("CORS_ALLOWED_ORIGINS", None)
            importlib.reload(main)
            self.assertEqual(main.origins, ["http://localhost:3000"])


class AddressSchemaUpgrade(unittest.TestCase):
    def test_existing_orders_gain_nullable_address_column_idempotently(self):
        from sqlalchemy import inspect, text
        import init_db
        engine = create_engine('sqlite://')
        try:
            with engine.begin() as connection:
                connection.execute(text('CREATE TABLE orders (id INTEGER PRIMARY KEY, user_id INTEGER, restaurant_id INTEGER, ordered_at DATETIME)'))
                connection.execute(text('INSERT INTO orders (id, user_id, restaurant_id) VALUES (1, 1, 2)'))
            with patch.object(init_db, 'engine', engine):
                init_db.init_db()
                init_db.init_db()
            self.assertIn('delivery_address', {column['name'] for column in inspect(engine).get_columns('orders')})
            with engine.connect() as connection:
                self.assertIsNone(connection.execute(text('SELECT delivery_address FROM orders WHERE id = 1')).scalar())
        finally:
            engine.dispose()


class WebSocketContracts(unittest.IsolatedAsyncioTestCase):
    async def test_order_isolation_payload_and_failed_connection_cleanup(self):
        class Socket:
            def __init__(self, fail=False):
                self.messages = []
                self.fail = fail
            async def accept(self):
                pass
            async def send_text(self, message):
                if self.fail:
                    raise RuntimeError("closed")
                self.messages.append(message)
        manager = ConnectionManager()
        one, other, closed = Socket(), Socket(), Socket(True)
        await manager.connect(closed, 1)
        await manager.connect(one, 1)
        await manager.connect(other, 2)
        await manager.broadcast(1, "Preparing")
        self.assertEqual(one.messages, ["Preparing"])
        self.assertEqual(other.messages, [])
        self.assertNotIn(closed, manager.active_connections[1])
        manager.disconnect(one, 1)
        manager.disconnect(one, 1)
        self.assertNotIn(1, manager.active_connections)
