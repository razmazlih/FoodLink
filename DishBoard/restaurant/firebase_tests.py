"""Firestore API contracts and authorization without SQL or remote access."""
from datetime import datetime
from unittest.mock import patch, Mock
from django.test import SimpleTestCase
from rest_framework.test import APIClient
from foodlink_core.firebase import Identity
from restaurant import firebase_views as views


class FirebaseMenuTests(SimpleTestCase):
    @patch('foodlink_core.firebase.initialize', side_effect=AssertionError('Health must not initialize Firebase'))
    def test_health_is_public_and_independent_of_firebase(self, initialize):
        response = APIClient().get('/healthz', HTTP_AUTHORIZATION='Bearer invalid')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'status': 'ok', 'service': 'dishboard'})
        initialize.assert_not_called()

    def setUp(self):
        self.client = APIClient()
        self.owner = Identity('owner', 'one@example.com', 'restaurant_owner', {})
        self.other = Identity('other', 'two@example.com', 'restaurant_owner', {})
        self.customer = Identity('customer', 'customer@example.com', 'customer', {})
        self.restaurant = {'id': 1, 'name': 'Kitchen', 'city': 'Haifa', 'address': 'Main', 'owner_uid': 'owner', 'photo_url': 'https://example.com/p.jpg'}
        self.category = {'id': 1, 'restaurant': 1, 'name': 'Main'}
        self.item = {'id': 1, 'category': 1, 'restaurant_id': 1, 'name': 'Dish', 'price_cents': 1250, 'is_available': True}
        def get(collection, identifier):
            return {'restaurants': self.restaurant, 'menu_categories': self.category, 'menu_items': self.item}[collection].copy()
        patcher = patch.object(views, 'get_document', side_effect=get)
        patcher.start()
        self.addCleanup(patcher.stop)
        self.transaction = Mock()
        patches = [
            patch.object(views, 'owned_transaction', side_effect=lambda identity, ids, operation, **kwargs: operation(self.transaction, {1: self.restaurant.copy()})),
            patch.object(views, 'transaction_read', side_effect=lambda transaction, collection, identifier: get(collection, identifier)),
            patch.object(views, 'transaction_query', return_value=[]),
            patch.object(views, 'reference', side_effect=lambda collection, identifier: (collection, identifier)),
            patch.object(views, 'allocate_id', return_value=2),
        ]
        for patcher in patches:
            patcher.start()
            self.addCleanup(patcher.stop)

    @patch.object(views, 'list_documents')
    def test_public_menu_shapes(self, documents):
        documents.side_effect = [[self.category], [self.item]]
        response = self.client.get('/api/menu/category/?restaurant_id=1')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data[0]['items'][0]['price'], '12.50')
        self.assertNotIn('price_cents', response.data[0]['items'][0])
        self.assertEqual(self.client.get('/api/menu/item/').status_code, 405)

    def test_customer_anonymous_and_other_owner_cannot_mutate(self):
        for identity in [None, self.customer, self.other]:
            self.client = APIClient()
            if identity is not None:
                self.client.force_authenticate(identity)
            for method, path, data in [('patch', '/api/restaurants/info/1/', {'name': 'Hacked'}), ('post', '/api/menu/category/', {'name': 'Hacked', 'restaurant': 1}), ('patch', '/api/menu/item/1/', {'price': '0.01'}), ('delete', '/api/menu/item/1/', {})]:
                self.assertIn(getattr(self.client, method)(path, data, format='json').status_code, [401, 403])
        self.transaction.create.assert_not_called()
        self.transaction.delete.assert_not_called()
        self.transaction.update.assert_not_called()

    @patch.object(views, 'reserve_ids', return_value=list(range(1, 8)))
    @patch.object(views, 'allocate_id', return_value=2)
    @patch.object(views, 'db')
    @patch.object(views.firestore, 'transactional', side_effect=lambda fn: fn)
    def test_create_restaurant_and_seven_hours_in_one_transaction(self, decorator, db, allocate, reserve):
        self.client.force_authenticate(self.owner)
        db.return_value.collection.return_value.document.return_value.get.return_value.exists = False
        response = self.client.post('/api/restaurants/info/', {'name': 'New', 'city': 'Haifa', 'address': 'Second'}, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['owner_uid'], 'owner')
        db.return_value.transaction.assert_called_once()
        writes = db.return_value.transaction.return_value.create.call_args_list
        self.assertEqual(len(writes), 9)
        hours = [call.args[1] for call in writes if 'day_of_week' in call.args[1]]
        self.assertEqual({value['day_of_week'] for value in hours}, set(views.DAYS))
        self.assertTrue(all(value['restaurant'] == 2 for value in hours))

    def test_owner_prices_integer_cents_and_immutable_category_parent(self):
        self.client.force_authenticate(self.owner)
        response = self.client.post('/api/menu/item/', {'name': 'New', 'category': 1, 'price': '23.45'}, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(self.transaction.create.call_args.args[1]['price_cents'], 2345)
        self.assertEqual(self.transaction.create.call_args.args[1]['restaurant_id'], 1)
        self.assertEqual(self.client.patch('/api/menu/item/1/', {'price': '-1'}, format='json').status_code, 400)
        with patch.object(views, 'list_documents', return_value=[]):
            response = self.client.patch('/api/menu/category/1/', {'name': 'Updated', 'restaurant': 99}, format='json')
        self.assertEqual(response.data['restaurant'], 1)
        self.transaction.update.assert_called_once_with(('menu_categories', 1), {'name': 'Updated'})

    def test_owner_cannot_transfer_restaurant_ownership(self):
        self.client.force_authenticate(self.owner)
        self.assertEqual(self.client.patch('/api/restaurants/info/1/', {'owner_uid': 'other'}, format='json').status_code, 403)
        self.transaction.update.assert_not_called()

    @patch.object(views, 'list_documents')
    @patch.object(views, 'datetime')
    def test_open_hours_uses_existing_wire_shape(self, clock, documents):
        clock.now.return_value = datetime(2026, 10, 26, 12)
        documents.return_value = [{'id': 1, 'restaurant': 1, 'day_of_week': 'Monday', 'is_open': True, 'opening_time': '08:00:00', 'closing_time': '18:00:00'}]
        response = self.client.get('/api/restaurants/opening-hours/when-open/?restaurant_id=1')
        self.assertEqual(response.data, {'is_open': True, 'closes_at': '18:00:00'})

    @patch.object(views, 'db')
    @patch.object(views, 'transaction_query')
    def test_restaurant_cascade_deletes_all_owned_children_in_transaction(self, query, db):
        self.client.force_authenticate(self.owner)
        query.side_effect = [[{'id': 2}], [{'id': 3}], [{'id': 4}]]
        response = self.client.delete('/api/restaurants/info/1/')
        self.assertEqual(response.status_code, 204)
        deleted = [call.args[0] for call in self.transaction.delete.call_args_list]
        for expected in [('restaurants', 1), ('menu_categories', 2), ('menu_items', 3), ('opening_hours', 4)]:
            self.assertIn(expected, deleted)
        self.assertEqual(len(deleted), 5)  # Includes the restaurant uniqueness index.

    @patch.object(views, 'transaction_query', return_value=[{'id': 9}])
    def test_duplicate_category_name_is_rejected_before_writing(self, query):
        self.client.force_authenticate(self.owner)
        response = self.client.post('/api/menu/category/', {'name': 'Main', 'restaurant': 1}, format='json')
        self.assertEqual(response.status_code, 400)
        self.transaction.create.assert_not_called()

    @patch.object(views, 'db')
    @patch.object(views, 'reserve_ids', return_value=list(range(1, 8)))
    def test_duplicate_restaurant_name_address_is_rejected_before_writing(self, reserve, db):
        self.client.force_authenticate(self.owner)
        db.return_value.collection.return_value.document.return_value.get.return_value.exists = True
        with patch.object(views.firestore, 'transactional', side_effect=lambda fn: fn):
            response = self.client.post('/api/restaurants/info/', {'name': 'Kitchen', 'city': 'Haifa', 'address': 'Main'}, format='json')
        self.assertEqual(response.status_code, 400)
        db.return_value.transaction.return_value.create.assert_not_called()


class AtomicOwnershipTests(SimpleTestCase):
    def setUp(self):
        from restaurant import firestore_mutations
        self.mutations = firestore_mutations
        self.owner = Identity('owner', 'owner@example.com', 'restaurant_owner', {})
        self.client = Mock()
        self.snapshot = self.client.collection.return_value.document.return_value.get.return_value
        self.snapshot.exists = True
        self.snapshot.id = '1'
        self.snapshot.to_dict.return_value = {'owner_uid': 'owner'}
        self.patches = [patch.object(firestore_mutations, 'db', return_value=self.client),
                        patch.object(firestore_mutations.firestore, 'transactional', side_effect=lambda fn: fn)]
        for patcher in self.patches:
            patcher.start()
            self.addCleanup(patcher.stop)

    def test_transaction_rechecks_current_owner_and_touches_parent(self):
        operation = Mock(return_value={'saved': True})
        self.assertEqual(self.mutations.owned_transaction(self.owner, [1], operation), {'saved': True})
        transaction = self.client.transaction.return_value
        transaction.update.assert_called_once()
        self.assertIn('_revision', transaction.update.call_args.args[1])
        self.snapshot.to_dict.return_value = {'owner_uid': 'new-owner'}
        operation.reset_mock()
        from rest_framework.exceptions import PermissionDenied
        with self.assertRaises(PermissionDenied):
            self.mutations.owned_transaction(self.owner, [1], operation)
        operation.assert_not_called()

    def test_deleted_parent_blocks_child_write(self):
        self.snapshot.exists = False
        operation = Mock()
        from rest_framework.exceptions import NotFound
        with self.assertRaises(NotFound):
            self.mutations.owned_transaction(self.owner, [1], operation)
        operation.assert_not_called()
