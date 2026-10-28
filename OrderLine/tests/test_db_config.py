"""Configuration checks require no PostgreSQL server or schema writes."""
import os
from pathlib import Path
import subprocess
import sys
import unittest

from sqlalchemy.engine import make_url
from db_config import auto_init_db, database_settings, postgres_schema


class DatabaseConfiguration(unittest.TestCase):
    def test_legacy_defaults_keep_driver_search_path(self):
        url, arguments = database_settings({})
        self.assertEqual(url.database, 'orderline-db')
        self.assertEqual(arguments, {})
        self.assertIsNone(postgres_schema({}))
        self.assertTrue(auto_init_db({}))

    def test_private_schema_excludes_public_and_credentials_round_trip(self):
        password, user = 'secret@:/?#% value', 'user@:/?#%'
        url, arguments = database_settings({'POSTGRES_SCHEMA': 'orderline', 'POSTGRES_USER': user,
                                           'POSTGRES_PASSWORD': password, 'POSTGRES_DB': 'foodlink'})
        parsed = make_url(url.render_as_string(hide_password=False))
        self.assertEqual(parsed.username, user)
        self.assertEqual(parsed.password, password)
        self.assertEqual(parsed.database, 'foodlink')
        self.assertEqual(arguments, {'options': '-csearch_path="orderline"'})
        self.assertNotIn('public', arguments['options'])

    def test_schema_validation_rejects_injection_reserved_and_empty_names(self):
        for name in ['', 'public', 'pg_catalog', 'pg_temp', 'information_schema', 'OrderLine',
                     'one,two', 'x -cstatement_timeout=0', 'x; DROP TABLE orders',
                     '"orderline"', 'a' * 64, 'non-ascii-é']:
            with self.subTest(name=name), self.assertRaises(ValueError):
                database_settings({'POSTGRES_SCHEMA': name})
        self.assertEqual(postgres_schema({'POSTGRES_SCHEMA': 'a' * 63}), 'a' * 63)

    def test_auto_init_toggle_is_explicit_and_backwards_compatible(self):
        for value in ['true', '1', 'yes', 'on', 'TRUE']:
            self.assertTrue(auto_init_db({'AUTO_INIT_DB': value}))
        for value in ['false', '0', 'no', 'off', 'FALSE']:
            self.assertFalse(auto_init_db({'AUTO_INIT_DB': value}))
        with self.assertRaises(ValueError):
            auto_init_db({'AUTO_INIT_DB': 'maybe'})

    def run_isolated(self, program, **settings):
        environment = {**os.environ, 'TEST_DATABASE': 'True', 'PYTHON_DOTENV_DISABLED': '1', **settings}
        environment.pop('POSTGRES_SCHEMA', None)
        result = subprocess.run([sys.executable, '-c', program], cwd=Path(__file__).resolve().parents[1],
                                env=environment, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_disabled_startup_imports_routes_without_database_ddl(self):
        self.run_isolated('''
from unittest.mock import patch
with patch('init_db.init_db') as initialize, patch('sqlalchemy.engine.Engine.connect') as connect:
    import main
    initialize.assert_not_called()
    connect.assert_not_called()
    assert any(route.path == '/orders/' for route in main.app.routes)
''', AUTO_INIT_DB='false')

    def test_default_startup_still_initializes(self):
        self.run_isolated('''
import os
from unittest.mock import patch
os.environ.pop('AUTO_INIT_DB', None)
with patch('init_db.init_db') as initialize:
    import main
    initialize.assert_called_once_with()
''')

    def test_explicit_initializer_registers_all_models_and_runs_with_toggle_disabled(self):
        self.run_isolated('''
import runpy
from unittest.mock import patch
from models.base import Base
with patch.object(Base.metadata, 'create_all') as create:
    runpy.run_module('init_db', run_name='__main__')
    create.assert_called_once()
    assert set(Base.metadata.tables) == {'orders', 'order_item', 'order_status'}
''', AUTO_INIT_DB='false')
