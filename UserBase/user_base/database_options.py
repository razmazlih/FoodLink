"""Optional PostgreSQL schema isolation for standalone service deployment."""
import re

from django.core.exceptions import ImproperlyConfigured


def postgres_schema_options(environ):
    schema = environ.get("POSTGRES_SCHEMA", "")
    if not schema:
        return {}
    if (
        not re.fullmatch(r"[a-z_][a-z0-9_]{0,62}", schema)
        or schema in {"public", "information_schema"}
        or schema.startswith("pg_")
    ):
        raise ImproperlyConfigured(
            "POSTGRES_SCHEMA must be a private lowercase PostgreSQL identifier of at most 63 characters."
        )
    # Exclude public so each service owns its auth/contenttypes/migration tables.
    return {"options": f"-c search_path={schema}"}
