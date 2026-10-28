from django.test import SimpleTestCase
from datetime import datetime, time
from unittest.mock import patch
from django.test import TestCase
from rest_framework.test import APIClient
from .models import Restaurant, OpeningHours


class RestaurantContractTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.closed = Restaurant.objects.create(name="Closed", city="Haifa", address="1")
        self.open = Restaurant.objects.create(name="Open", city="Haifa", address="2")
        OpeningHours.objects.filter(restaurant=self.open, day_of_week="Monday").update(
            is_open=True, opening_time=time(8), closing_time=time(18))

    @patch("restaurant.views.datetime")
    def test_open_first_fields_and_constant_query_count(self, clock):
        clock.now.return_value = datetime(2026, 10, 26, 12)
        with self.assertNumQueries(2):
            response = self.client.get("/api/restaurants/info/?fields=name")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, [{"id": self.open.id, "name": "Open"},
                                         {"id": self.closed.id, "name": "Closed"}])

    def test_legacy_hours_path_and_creation_signal(self):
        response = self.client.get(f"/api/restaurants/opening-houers/?restaurant_id={self.open.id}")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 7)
        self.assertEqual(set(response.data[0]), {"id", "restaurant", "day_of_week", "is_open", "opening_time", "closing_time"})

    @patch("restaurant.views.datetime")
    def test_when_open_contract(self, clock):
        clock.now.return_value = datetime(2026, 10, 26, 12)
        response = self.client.get(f"/api/restaurants/opening-hours/when-open/?restaurant_id={self.open.id}")
        self.assertEqual(response.data, {"is_open": True, "closes_at": time(18)})

    def test_restaurant_and_opening_hours_crud(self):
        response = self.client.post("/api/restaurants/info/", {"name": "New", "city": "Haifa", "address": "3"})
        self.assertEqual(response.status_code, 201)
        restaurant_id = response.data["id"]
        self.assertTrue(response.data["photo_url"].startswith("https://"))
        endpoint = f"/api/restaurants/info/{restaurant_id}/"
        self.assertEqual(self.client.patch(endpoint, {"name": "Renamed"}).status_code, 200)
        self.assertEqual(self.client.get(endpoint).data["name"], "Renamed")
        hour = OpeningHours.objects.filter(restaurant_id=restaurant_id).first()
        response = self.client.patch(
            f"/api/restaurants/opening-houers/{hour.id}/?restaurant_id={restaurant_id}",
            {"is_open": True, "opening_time": "09:00", "closing_time": "17:00"})
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["is_open"])
        self.assertEqual(self.client.delete(endpoint).status_code, 204)
        self.assertFalse(OpeningHours.objects.filter(restaurant_id=restaurant_id).exists())

    @patch("restaurant.views.datetime")
    def test_before_today_opening_still_reports_next_day_as_before(self, clock):
        clock.now.return_value = datetime(2026, 10, 26, 7)
        OpeningHours.objects.filter(restaurant=self.open, day_of_week="Tuesday").update(
            is_open=True, opening_time=time(9), closing_time=time(18))
        response = self.client.get(f"/api/restaurants/opening-hours/when-open/?restaurant_id={self.open.id}")
        self.assertEqual(response.data, {"is_open": False, "opens_at": time(9), "next_day": "Tuesday"})

    @patch("restaurant.photos.cloudinary.uploader.upload")
    def test_missing_photo_defaults_on_create_and_preserves_existing_on_update(self, upload):
        from .photos import DEFAULT_PHOTO_URL
        response = self.client.post("/api/restaurants/info/", {"name": "Photo", "city": "Haifa", "address": "4"})
        self.assertEqual(response.data["photo_url"], DEFAULT_PHOTO_URL)
        restaurant = Restaurant.objects.get(pk=response.data["id"])
        restaurant.photo_url = "https://example.com/existing.jpg"
        restaurant.save()
        response = self.client.patch(f"/api/restaurants/info/{restaurant.id}/", {"name": "Updated"})
        self.assertEqual(response.data["photo_url"], "https://example.com/existing.jpg")
        upload.assert_not_called()

    @patch("restaurant.photos.cloudinary.uploader.upload", return_value={"secure_url": "https://example.com/uploaded.jpg"})
    def test_upload_boundary_used_for_create_and_update(self, upload):
        from types import SimpleNamespace
        from unittest.mock import Mock
        from .views import RestaurantViewSet
        image = object()
        view = RestaurantViewSet()
        view.request = SimpleNamespace(FILES={"photo": image})
        for operation in (view.perform_create, view.perform_update):
            serializer = Mock()
            operation(serializer)
            serializer.save.assert_called_once_with(photo_url="https://example.com/uploaded.jpg")
        self.assertEqual(upload.call_count, 2)
        upload.assert_called_with(image)


class DatabaseSchemaConfigurationTests(SimpleTestCase):
    def test_optional_schema_and_rejected_identifiers(self):
        from django.core.exceptions import ImproperlyConfigured
        from dish_board.database_options import postgres_schema_options
        self.assertEqual(postgres_schema_options({}), {})
        self.assertEqual(postgres_schema_options({"POSTGRES_SCHEMA": ""}), {})
        self.assertEqual(postgres_schema_options({"POSTGRES_SCHEMA": "dishboard"}),
                         {"options": "-c search_path=dishboard"})
        for invalid in ("public", "information_schema", "pg_catalog", "pg_temp", "pg_custom",
                        "public,other", "foo;drop", "a b", "Upper", "1schema", "x" * 64):
            with self.subTest(schema=invalid), self.assertRaises(ImproperlyConfigured):
                postgres_schema_options({"POSTGRES_SCHEMA": invalid})

    def test_production_settings_apply_only_explicit_schema(self):
        import os
        import importlib.util
        from pathlib import Path
        from unittest.mock import patch
        for schema in (None, "dishboard"):
            environ = {} if schema is None else {"POSTGRES_SCHEMA": schema}
            with patch.dict(os.environ, environ, clear=True), patch("dotenv.load_dotenv"):
                spec = importlib.util.spec_from_file_location(
                    "dish_board._schema_settings_test",
                    Path(__file__).resolve().parents[1] / "dish_board" / "settings.py")
                settings_module = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(settings_module)
                config = vars(settings_module)
            database = config["DATABASES"]["default"]
            self.assertEqual(database["ENGINE"], "django.db.backends.postgresql")
            expected = {} if schema is None else {"options": "-c search_path=dishboard"}
            self.assertEqual(database["OPTIONS"], expected)


class MigrationReadinessTests(TestCase):
    def test_committed_history_is_applied_without_model_sync(self):
        from django.db import connection
        from django.db.migrations.recorder import MigrationRecorder
        applied = MigrationRecorder(connection).applied_migrations()
        for migration in [('restaurant', '0006_alter_restaurant_address_alter_restaurant_city_and_more'), ('menu', '0004_alter_category_name_alter_item_name')]:
            self.assertIn(migration, applied)
        for table in ['django_migrations', 'django_content_type', 'auth_permission', 'auth_user', 'restaurant_restaurant', 'menu_item']:
            self.assertIn(table, connection.introspection.table_names())
