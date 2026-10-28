"""Lazy Firebase Admin initialization and verified server identities."""
from dataclasses import dataclass
import json
import os
import re
from threading import RLock
from types import MappingProxyType
from typing import Mapping
from urllib.parse import urlsplit

import firebase_admin
from firebase_admin import auth, credentials, firestore
from google.auth.credentials import AnonymousCredentials


class FirebaseConfigurationError(RuntimeError):
    pass


class AuthenticationError(ValueError):
    pass


@dataclass(frozen=True)
class Identity:
    uid: str
    email: str | None
    role: str
    claims: Mapping

    @property
    def is_admin(self):
        return self.role == 'admin'

    @property
    def is_authenticated(self):
        return True

    @property
    def id(self):
        return self.uid


_lock = RLock()
_client = None
_configuration = None


class _EmulatorCredential(credentials.Base):
    def get_credential(self):
        return AnonymousCredentials()


def _emulator_host(name, value):
    try:
        address = urlsplit('//' + value)
        if (not address.hostname or address.port is None or not 1 <= address.port <= 65535
                or address.username or address.password or address.path or address.query or address.fragment):
            raise ValueError()
    except ValueError as error:
        raise FirebaseConfigurationError(f'{name} must be host:port, without a URL scheme or path') from error


def configuration():
    project = os.getenv('FIREBASE_PROJECT_ID', '').strip()
    if not re.fullmatch(r'[a-z][a-z0-9-]{4,61}[a-z0-9]', project):
        raise FirebaseConfigurationError('FIREBASE_PROJECT_ID must be an explicit valid Firebase project ID')
    auth_host = os.getenv('FIREBASE_AUTH_EMULATOR_HOST', '').strip()
    store_host = os.getenv('FIRESTORE_EMULATOR_HOST', '').strip()
    if bool(auth_host) != bool(store_host):
        raise FirebaseConfigurationError('Auth and Firestore emulator hosts must be configured together')
    if auth_host:
        _emulator_host('FIREBASE_AUTH_EMULATOR_HOST', auth_host)
        _emulator_host('FIRESTORE_EMULATOR_HOST', store_host)
        if not project.startswith('demo-'):
            raise FirebaseConfigurationError('Emulators require a demo- Firebase project to prevent mixing test tokens and real data')
        if os.getenv('FIREBASE_SERVICE_ACCOUNT_JSON', '').strip():
            raise FirebaseConfigurationError('Remove FIREBASE_SERVICE_ACCOUNT_JSON when using emulators')
    elif project.startswith('demo-'):
        raise FirebaseConfigurationError('A demo- project requires both Firebase emulators')
    return project, auth_host, store_host


def _cloud_credential(project):
    """Use a server-only service-account JSON secret when provided, otherwise ADC."""
    secret = os.getenv('FIREBASE_SERVICE_ACCOUNT_JSON', '').strip()
    if not secret:
        return credentials.ApplicationDefault()
    try:
        account = json.loads(secret)
        if (not isinstance(account, dict) or account.get('type') != 'service_account'
                or account.get('project_id') != project):
            raise ValueError()
        return credentials.Certificate(account)
    except (ValueError, TypeError, KeyError):
        # SDK parse errors can contain credential fields. Do not expose their text
        # or chained exceptions in server logs or API responses.
        raise FirebaseConfigurationError('Invalid FIREBASE_SERVICE_ACCOUNT_JSON for the configured project') from None


def initialize():
    """Use server credentials in cloud mode and anonymous demo emulator access."""
    global _configuration
    current = configuration()
    with _lock:
        if _configuration is not None and _configuration != current:
            raise FirebaseConfigurationError('Firebase configuration changed after initialization; restart the service')
        project, auth_host, _ = current
        try:
            app = firebase_admin.get_app()
        except ValueError:
            credential = _EmulatorCredential() if auth_host else _cloud_credential(project)
            app = firebase_admin.initialize_app(credential, {'projectId': project})
        if app.project_id != project:
            raise FirebaseConfigurationError('The initialized Firebase app belongs to another project')
        _configuration = current
        return app


def db():
    global _client
    app = initialize()
    with _lock:
        if _client is None:
            _client = firestore.client(app=app)
        return _client


def verify_id_token(token):
    if not isinstance(token, str) or not token.strip():
        raise AuthenticationError('A Firebase ID token is required')
    app = initialize()
    try:
        claims = auth.verify_id_token(token, app=app, check_revoked=True)
    except (ValueError, auth.InvalidIdTokenError, auth.ExpiredIdTokenError,
            auth.RevokedIdTokenError, auth.UserDisabledError, auth.UserNotFoundError) as error:
        raise AuthenticationError('Invalid or expired Firebase ID token') from error
    uid = claims.get('uid') or claims.get('sub')
    if not isinstance(uid, str) or not uid:
        raise AuthenticationError('The Firebase ID token has no user ID')
    role = claims.get('role', 'customer')
    if claims.get('admin') is True:
        role = 'admin'
    if role not in ('customer', 'restaurant_owner', 'admin'):
        role = 'customer'
    email = claims.get('email')
    return Identity(uid, email if isinstance(email, str) else None, role, MappingProxyType(dict(claims)))
