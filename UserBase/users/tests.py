from django.test import SimpleTestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase


class AccountContractTests(APITestCase):
    def setUp(self):
        self.payload = dict(username="customer", password="original123", email="a@example.com",
                            phone_number="0501234567", city="Haifa", street_name="Main", house_number=1)

    def test_registration_login_and_current_user_profile(self):
        response = self.client.post("/api/users/register/", self.payload)
        self.assertEqual(response.status_code, 201)
        self.assertNotIn("password", response.data)
        self.assertTrue(get_user_model().objects.get(username="customer").check_password("original123"))
        login = self.client.post("/api/login/", {"username": "customer", "password": "original123"})
        self.assertEqual(login.status_code, 200)
        self.client.credentials(HTTP_AUTHORIZATION="Bearer " + login.data["access"])
        response = self.client.patch("/api/users/profile/", {"city": "Tel Aviv", "username": "ignored"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["username"], "customer")
        self.assertEqual(response.data["city"], "Tel Aviv")

    def test_manager_legacy_login_path_is_not_a_userbase_endpoint(self):
        self.assertEqual(self.client.post("/auth/login", {}).status_code, 404)

    def test_profile_requires_authentication_and_password_requires_old_password(self):
        self.assertEqual(self.client.get("/api/users/profile/").status_code, 401)
        user = get_user_model().objects.create_user(**self.payload)
        self.client.force_authenticate(user)
        response = self.client.put("/api/users/change-password/", {"old_password": "wrong", "new_password": "replacement123"})
        self.assertEqual(response.status_code, 400)
        response = self.client.put("/api/users/change-password/", {"old_password": "original123", "new_password": "replacement123"})
        self.assertEqual(response.status_code, 200)
        user.refresh_from_db()
        self.assertTrue(user.check_password("replacement123"))


class DatabaseSchemaConfigurationTests(SimpleTestCase):
    def test_optional_schema_and_rejected_identifiers(self):
        from django.core.exceptions import ImproperlyConfigured
        from user_base.database_options import postgres_schema_options
        self.assertEqual(postgres_schema_options({}), {})
        self.assertEqual(postgres_schema_options({"POSTGRES_SCHEMA": ""}), {})
        self.assertEqual(postgres_schema_options({"POSTGRES_SCHEMA": "userbase"}),
                         {"options": "-c search_path=userbase"})
        for invalid in ("public", "information_schema", "pg_catalog", "pg_temp", "pg_custom",
                        "public,other", "foo;drop", "a b", "Upper", "1schema", "x" * 64):
            with self.subTest(schema=invalid), self.assertRaises(ImproperlyConfigured):
                postgres_schema_options({"POSTGRES_SCHEMA": invalid})

    def test_production_settings_apply_only_explicit_schema(self):
        import os
        import importlib.util
        from pathlib import Path
        from unittest.mock import patch
        for schema in (None, "userbase"):
            environ = {} if schema is None else {"POSTGRES_SCHEMA": schema}
            with patch.dict(os.environ, environ, clear=True), patch("dotenv.load_dotenv"):
                spec = importlib.util.spec_from_file_location(
                    "user_base._schema_settings_test",
                    Path(__file__).resolve().parents[1] / "user_base" / "settings.py")
                settings_module = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(settings_module)
                config = vars(settings_module)
            database = config["DATABASES"]["default"]
            self.assertEqual(database["ENGINE"], "django.db.backends.postgresql")
            expected = {} if schema is None else {"options": "-c search_path=userbase"}
            self.assertEqual(database["OPTIONS"], expected)


class MigrationReadinessTests(APITestCase):
    def test_committed_history_is_applied_without_model_sync(self):
        from django.db import connection
        from django.db.migrations.recorder import MigrationRecorder
        applied = MigrationRecorder(connection).applied_migrations()
        for migration in [('users', '0002_alter_user_house_number')]:
            self.assertIn(migration, applied)
        for table in ['django_migrations', 'django_content_type', 'auth_permission', 'users_user']:
            self.assertIn(table, connection.introspection.table_names())
