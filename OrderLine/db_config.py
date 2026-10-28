"""Connection settings shared by the server and explicit schema initializer."""
import re
from os import environ

from sqlalchemy.engine import URL


def postgres_schema(settings=None):
    settings = environ if settings is None else settings
    schema = settings.get("POSTGRES_SCHEMA")
    if schema is None:
        return None
    if (
        not re.fullmatch(r"[a-z_][a-z0-9_]{0,62}", schema)
        or schema in {"public", "information_schema"}
        or schema.startswith("pg_")
    ):
        raise ValueError("POSTGRES_SCHEMA must be a private lowercase PostgreSQL identifier (1–63 characters)")
    return schema


def database_settings(settings=None):
    settings = environ if settings is None else settings
    schema = postgres_schema(settings)
    if settings.get("TEST_DATABASE") == "True":
        return "sqlite:///./test.db", {}
    url = URL.create(
        "postgresql",
        username=settings.get("POSTGRES_USER", "razmaz"),
        password=settings.get("POSTGRES_PASSWORD", "razmaz123"),
        host=settings.get("POSTGRES_HOST", "localhost"),
        port=int(settings.get("POSTGRES_PORT", "5432")),
        database=settings.get("POSTGRES_DB", "orderline-db"),
    )
    # A configured private schema must never fall back to tables in public.
    connect_args = {"options": f'-csearch_path="{schema}"'} if schema else {}
    return url, connect_args


def auto_init_db(settings=None):
    settings = environ if settings is None else settings
    value = settings.get("AUTO_INIT_DB", "true").lower()
    if value in {"true", "1", "yes", "on"}:
        return True
    if value in {"false", "0", "no", "off"}:
        return False
    raise ValueError("AUTO_INIT_DB must be true or false")
