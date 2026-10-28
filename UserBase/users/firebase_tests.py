"""Firebase account contracts: SimpleTestCase forbids SQL access."""
from types import SimpleNamespace
from unittest.mock import patch
from django.test import SimpleTestCase
from rest_framework.test import APIClient
from foodlink_core.firebase import AuthenticationError, Identity
from foodlink_core.repository import NotFoundError
from users import firebase_views as views


class FirebaseAccountTests(SimpleTestCase):
    def setUp(self):
        self.client = APIClient()
        self.customer = Identity('uid-customer', 'customer@example.com', 'customer', {})
        self.admin = Identity('uid-admin', 'admin@example.com', 'admin', {})

    def test_profile_requires_token_and_rejects_role_email_password(self):
        self.assertEqual(self.client.get('/api/users/profile/').status_code, 401)
        self.client.force_authenticate(self.customer)
        for field in ['role', 'user_type', 'email', 'password']:
            response = self.client.patch('/api/users/profile/', {field: 'admin'}, format='json')
            self.assertEqual(response.status_code, 400)

    @patch.object(views, 'get_document', side_effect=NotFoundError())
    @patch.object(views, 'create_document', return_value={'id': 'uid-customer', 'username': 'Customer', 'role': 'admin'})
    def test_registration_uid_email_and_role_are_from_identity(self, create, get):
        self.client.force_authenticate(self.customer)
        response = self.client.post('/api/users/register/', {'username': 'Customer'}, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['id'], 'uid-customer')
        self.assertEqual(response.data['email'], 'customer@example.com')
        self.assertEqual(response.data['user_type'], 'customer')
        create.assert_called_once_with('users', {'username': 'Customer'}, document_id='uid-customer')

    @patch('foodlink_core.drf.verify_id_token', side_effect=AuthenticationError('invalid'))
    def test_invalid_token_is_rejected(self, verify):
        self.client.credentials(HTTP_AUTHORIZATION='Bearer invalid')
        self.assertEqual(self.client.get('/api/users/profile/').status_code, 401)

    @patch.object(views.auth, 'set_custom_user_claims')
    def test_customer_cannot_access_admin_or_promote_user(self, claims):
        self.client.force_authenticate(self.customer)
        self.assertEqual(self.client.get('/api/admin/users/').status_code, 403)
        self.assertEqual(self.client.put('/api/admin/users/other/', {'role': 'admin'}, format='json').status_code, 403)
        self.assertEqual(self.client.get('/api/admin/stats/').status_code, 403)
        claims.assert_not_called()

    @patch.object(views, 'get_document', return_value={})
    @patch.object(views, 'db')
    @patch.object(views.auth, 'revoke_refresh_tokens')
    @patch.object(views.auth, 'set_custom_user_claims')
    @patch.object(views.auth, 'get_user')
    def test_admin_role_edit_preserves_other_claims_and_revokes(self, get_user, claims, revoke, db, profile):
        self.client.force_authenticate(self.admin)
        user = SimpleNamespace(uid='uid-customer', email='customer@example.com', display_name='Customer', custom_claims={'role': 'customer', 'billing': 'existing'})
        promoted = SimpleNamespace(**{**vars(user), 'custom_claims': {'role': 'restaurant_owner', 'billing': 'existing'}})
        get_user.side_effect = [user, promoted]
        response = self.client.put('/api/admin/users/uid-customer/', {'role': 'restaurant_owner'}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['role'], 'restaurant_owner')
        claims.assert_called_once_with('uid-customer', {'role': 'restaurant_owner', 'billing': 'existing'})
        revoke.assert_called_once_with('uid-customer')

    @patch.object(views, 'db')
    @patch.object(views, 'collection_count', side_effect=[1, 2])
    @patch.object(views.auth, 'list_users')
    @patch.object(views, 'list_documents')
    def test_stats_only_counts_delivered_revenue(self, documents, users, count, db):
        self.client.force_authenticate(self.admin)
        documents.return_value = [{'state': 'delivered', 'total_cents': 1250}]
        users.return_value.iterate_all.return_value = iter([object(), object()])
        self.assertEqual(self.client.get('/api/admin/stats/').data, {'totalUsers': 2, 'totalRestaurants': 1, 'totalOrders': 2, 'totalRevenue': 12.5})
        documents.assert_called_once_with('orders', filters=[('state', '==', 'delivered')])
        self.assertEqual([call.args[0] for call in count.call_args_list], ['restaurants', 'orders'])

    @patch.object(views, 'get_document', return_value={'city': 'Haifa', 'street_name': 'Main', 'house_number': 3})
    def test_existing_profile_address_is_available_in_book(self, get):
        self.client.force_authenticate(self.customer)
        response = self.client.get('/api/users/profile/')
        self.assertEqual(response.data['addresses'][0]['id'], 'legacy')
        self.assertTrue(response.data['addresses'][0]['is_default'])

    @patch.object(views, 'update_document')
    @patch.object(views, 'get_document', return_value={})
    def test_address_book_is_written_only_to_authenticated_profile(self, get, update):
        self.client.force_authenticate(self.customer)
        address = dict(id='work', label='Work', city='Haifa', street_name='Main', house_number=2, is_default=False)
        update.side_effect = lambda collection, uid, changes: changes
        response = self.client.patch('/api/users/profile/', {'addresses': [address]}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['addresses'][0]['is_default'])
        self.assertEqual(update.call_args.args[:2], ('users', self.customer.uid))
        self.assertEqual(update.call_args.args[2]['city'], 'Haifa')
        response = self.client.patch('/api/users/profile/', {'addresses': []}, format='json')
        self.assertEqual(response.data['addresses'], [])
        self.assertEqual(response.data['city'], '')
