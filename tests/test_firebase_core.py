"""Shared Firebase contracts; isolated mocks never contact a project."""
import importlib
import os
from pathlib import Path
import sys
import unittest
from unittest.mock import MagicMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from foodlink_core import firebase, repository


PRODUCTION = {'FIREBASE_PROJECT_ID': 'foodlink-razmaz'}
EMULATORS = {
    'FIREBASE_PROJECT_ID': 'demo-foodlink',
    'FIREBASE_AUTH_EMULATOR_HOST': '127.0.0.1:9099',
    'FIRESTORE_EMULATOR_HOST': '127.0.0.1:8080',
}


class FirebaseConfigurationTests(unittest.TestCase):
    def test_project_must_be_explicit(self):
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(firebase.FirebaseConfigurationError):
                firebase.configuration()

    def test_production_and_paired_demo_emulators(self):
        with patch.dict(os.environ, PRODUCTION, clear=True):
            self.assertEqual(firebase.configuration(), ('foodlink-razmaz', '', ''))
        with patch.dict(os.environ, EMULATORS, clear=True):
            self.assertEqual(firebase.configuration(), ('demo-foodlink', '127.0.0.1:9099', '127.0.0.1:8080'))

    def test_partial_emulation_real_project_emulation_and_url_hosts_are_rejected(self):
        cases = [
            {**PRODUCTION, 'FIREBASE_AUTH_EMULATOR_HOST': 'localhost:9099'},
            {**EMULATORS, 'FIREBASE_PROJECT_ID': 'foodlink-razmaz'},
            {'FIREBASE_PROJECT_ID': 'demo-foodlink'},
            {**EMULATORS, 'FIRESTORE_EMULATOR_HOST': 'http://localhost:8080'},
            {**EMULATORS, 'FIRESTORE_EMULATOR_HOST': 'localhost'},
        ]
        for environment in cases:
            with self.subTest(environment=environment), patch.dict(os.environ, environment, clear=True):
                with self.assertRaises(firebase.FirebaseConfigurationError):
                    firebase.configuration()

    def test_emulator_initialization_uses_anonymous_not_adc(self):
        app = MagicMock(project_id='demo-foodlink')
        with patch.dict(os.environ, EMULATORS, clear=True), \
                patch.object(firebase, '_configuration', None), \
                patch.object(firebase.firebase_admin, 'get_app', side_effect=ValueError), \
                patch.object(firebase.firebase_admin, 'initialize_app', return_value=app) as initialize, \
                patch.object(firebase.credentials, 'ApplicationDefault') as adc:
            self.assertIs(firebase.initialize(), app)
            self.assertIsInstance(initialize.call_args.args[0].get_credential(), firebase.AnonymousCredentials)
            self.assertEqual(initialize.call_args.args[1], {'projectId': 'demo-foodlink'})
            adc.assert_not_called()

    def test_project_mismatch_and_changed_configuration_fail_closed(self):
        with patch.dict(os.environ, PRODUCTION, clear=True), \
                patch.object(firebase, '_configuration', None), \
                patch.object(firebase.firebase_admin, 'get_app', return_value=MagicMock(project_id='another-project')):
            with self.assertRaises(firebase.FirebaseConfigurationError):
                firebase.initialize()
        with patch.dict(os.environ, PRODUCTION, clear=True), \
                patch.object(firebase, '_configuration', ('another-project', '', '')):
            with self.assertRaises(firebase.FirebaseConfigurationError):
                firebase.initialize()

    def test_firestore_client_is_lazy_and_reused(self):
        app, client = object(), object()
        with patch.object(firebase, '_client', None), \
                patch.object(firebase, 'initialize', return_value=app), \
                patch.object(firebase.firestore, 'client', return_value=client) as create:
            create.assert_not_called()
            self.assertIs(firebase.db(), client)
            self.assertIs(firebase.db(), client)
            create.assert_called_once_with(app=app)


class IdentityTests(unittest.TestCase):
    def test_verified_token_checks_revocation_and_normalizes_identity(self):
        app = object()
        claims = {'uid': 'firebase-uid', 'email': 'customer@example.test', 'role': 'restaurant_owner'}
        with patch.object(firebase, 'initialize', return_value=app), \
                patch.object(firebase.auth, 'verify_id_token', return_value=claims) as verify:
            identity = firebase.verify_id_token('signed-id-token')
            verify.assert_called_once_with('signed-id-token', app=app, check_revoked=True)
        self.assertEqual(identity.uid, 'firebase-uid')
        self.assertEqual(identity.id, 'firebase-uid')
        self.assertEqual(identity.role, 'restaurant_owner')
        self.assertTrue(identity.is_authenticated)
        self.assertFalse(identity.is_admin)
        with self.assertRaises(TypeError):
            identity.claims['role'] = 'admin'

    def test_roles_come_only_from_signed_top_level_custom_claims(self):
        cases = [
            ({'uid': 'u', 'profile': {'role': 'admin'}}, 'customer'),
            ({'uid': 'u', 'admin': 'true'}, 'customer'),
            ({'uid': 'u', 'role': 'unknown'}, 'customer'),
            ({'uid': 'u', 'admin': True}, 'admin'),
            ({'uid': 'u', 'role': 'admin'}, 'admin'),
        ]
        for claims, role in cases:
            with self.subTest(claims=claims), patch.object(firebase, 'initialize'), \
                    patch.object(firebase.auth, 'verify_id_token', return_value=claims):
                self.assertEqual(firebase.verify_id_token('token').role, role)

    def test_invalid_missing_and_deleted_user_tokens_are_authentication_errors(self):
        for token in [None, '', '   ', 1]:
            with self.subTest(token=token), patch.object(firebase, 'initialize') as initialize:
                with self.assertRaises(firebase.AuthenticationError):
                    firebase.verify_id_token(token)
                initialize.assert_not_called()
        for error in [ValueError('private decoder diagnostic'), firebase.auth.UserNotFoundError('deleted user')]:
            with patch.object(firebase, 'initialize'), patch.object(firebase.auth, 'verify_id_token', side_effect=error):
                with self.assertRaisesRegex(firebase.AuthenticationError, '^Invalid or expired Firebase ID token$'):
                    firebase.verify_id_token('token')


class RepositoryTests(unittest.TestCase):
    def setUp(self):
        self.client = MagicMock()
        self.reference = self.client.collection.return_value.document.return_value
        self.snapshot = self.reference.get.return_value
        self.snapshot.exists = True
        self.snapshot.id = '7'
        self.snapshot.to_dict.return_value = {'name': 'Soup'}
        self.db_patch = patch.object(repository, 'db', return_value=self.client)
        self.db_patch.start()
        self.addCleanup(self.db_patch.stop)

    def test_numeric_entity_ids_and_string_user_uids(self):
        self.assertEqual(repository.get_document('menu_items', 7), {'id': 7, 'name': 'Soup'})
        self.assertEqual(repository.get_document('users', '7'), {'id': '7', 'name': 'Soup'})
        self.snapshot.exists = False
        with self.assertRaises(repository.NotFoundError):
            repository.get_document('menu_items', 7)

    def test_transactional_counter_allocates_contiguous_ids(self):
        self.snapshot.to_dict.return_value = {'value': 7}
        transaction = MagicMock()
        self.assertEqual(repository.reserve_ids('orders', 3, transaction), [8, 9, 10])
        self.client.collection.assert_called_with('_counters')
        self.reference.get.assert_called_once_with(transaction=transaction)
        transaction.set.assert_called_once_with(self.reference, {'value': 10})

    def test_first_id_and_standalone_transaction(self):
        self.snapshot.exists = False
        with patch.object(repository.firestore, 'transactional', side_effect=lambda function: function):
            self.assertEqual(repository.allocate_id('orders'), 1)
        self.client.transaction.assert_called_once_with(max_attempts=1)
        self.client.transaction.return_value.set.assert_called_once_with(self.reference, {'value': 1})

    def test_transient_counter_contention_retries_fresh_transactions_with_backoff(self):
        from google.api_core.exceptions import Aborted
        aborted = Aborted('contention')
        wrapped = ValueError('SDK transaction exhausted')
        wrapped.__cause__ = aborted
        self.snapshot.exists = False
        with patch.object(repository.firestore, 'transactional', return_value=MagicMock(side_effect=[wrapped, [1]])) as decorate, \
                patch.object(repository.time, 'sleep') as sleep:
            self.assertEqual(repository.allocate_id('orders'), 1)
            self.assertEqual(self.client.transaction.call_count, 2)
            self.assertEqual(decorate.call_count, 2)
            sleep.assert_called_once()

    def test_counter_retry_is_bounded(self):
        from google.api_core.exceptions import Aborted
        failure = Aborted('contention')
        with patch.object(repository.firestore, 'transactional', return_value=MagicMock(side_effect=failure)), \
                patch.object(repository.time, 'sleep') as sleep:
            with self.assertRaises(Aborted):
                repository.allocate_id('orders')
            self.assertEqual(self.client.transaction.call_count, repository._COUNTER_ATTEMPTS)
            self.assertEqual(sleep.call_count, repository._COUNTER_ATTEMPTS - 1)

    def test_invalid_counter_errors_are_not_retried(self):
        self.snapshot.to_dict.return_value = {'value': -1}
        with patch.object(repository.firestore, 'transactional', side_effect=lambda function: function), \
                patch.object(repository.time, 'sleep') as sleep:
            with self.assertRaisesRegex(ValueError, 'counter'):
                repository.allocate_id('orders')
            self.client.transaction.assert_called_once_with(max_attempts=1)
            sleep.assert_not_called()

    def test_invalid_counter_and_unsafe_inputs_never_write(self):
        transaction = MagicMock()
        for current in [-1, True, '7', repository.MAX_ID]:
            self.snapshot.to_dict.return_value = {'value': current}
            with self.subTest(current=current), self.assertRaises(ValueError):
                repository.allocate_id('orders', transaction)
        transaction.set.assert_not_called()
        for collection in ['a/b', '_counters', '', '..']:
            with self.subTest(collection=collection), self.assertRaises(ValueError):
                repository.allocate_id(collection)
        for identifier in [True, '', 'a/b', None]:
            with self.subTest(identifier=identifier), self.assertRaises(ValueError):
                repository.get_document('orders', identifier)

    def test_user_document_cannot_override_its_identifier(self):
        repository.create_document('users', {'id': 'forged', 'name': 'Soup'}, document_id='uid')
        self.reference.create.assert_called_once_with({'name': 'Soup'})
        repository.update_document('users', 'uid', {'id': 'forged', 'name': 'Soup'})
        self.reference.update.assert_called_once_with({'name': 'Soup'})

    def test_filtered_list_preserves_wire_ids(self):
        collection = self.client.collection.return_value
        collection.where.return_value.stream.return_value = [self.snapshot]
        rows = repository.list_documents('menu_items', filters=[('category', '==', 1)])
        self.assertEqual(rows, [{'name': 'Soup', 'id': 7}])
        field_filter = collection.where.call_args.kwargs['filter']
        self.assertEqual((field_filter.field_path, field_filter.op_string, field_filter.value), ('category', '==', 1))


class DrfAdapterTests(unittest.TestCase):
    def test_bearer_adapter_returns_shared_identity_and_401_challenge(self):
        from foodlink_core.drf import FirebaseAuthentication
        identity = firebase.Identity('uid', None, 'customer', {})
        request = MagicMock(META={'HTTP_AUTHORIZATION': 'Bearer signed-token'})
        with patch('foodlink_core.drf.verify_id_token', return_value=identity) as verify:
            adapter = FirebaseAuthentication()
            self.assertEqual(adapter.authenticate(request), (identity, 'signed-token'))
            verify.assert_called_once_with('signed-token')
            self.assertEqual(adapter.authenticate_header(request), 'Bearer')

    def test_missing_and_malformed_bearer_headers(self):
        from foodlink_core.drf import FirebaseAuthentication
        from rest_framework.exceptions import AuthenticationFailed
        adapter = FirebaseAuthentication()
        self.assertIsNone(adapter.authenticate(MagicMock(META={})))
        with self.assertRaises(AuthenticationFailed):
            adapter.authenticate(MagicMock(META={'HTTP_AUTHORIZATION': 'Bearer one two'}))


if __name__ == '__main__':
    unittest.main()
