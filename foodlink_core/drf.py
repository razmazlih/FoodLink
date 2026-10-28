"""Optional Django REST Framework adapter; importing core needs no Django."""
from rest_framework.authentication import BaseAuthentication, get_authorization_header
from rest_framework.exceptions import AuthenticationFailed

from .firebase import AuthenticationError, verify_id_token


class FirebaseAuthentication(BaseAuthentication):
    def authenticate(self, request):
        header = get_authorization_header(request).split()
        if not header or header[0].lower() != b'bearer':
            return None
        if len(header) != 2:
            raise AuthenticationFailed('Expected a Bearer Firebase ID token')
        try:
            token = header[1].decode('ascii')
            identity = verify_id_token(token)
        except (UnicodeDecodeError, AuthenticationError) as error:
            raise AuthenticationFailed('Invalid or expired Firebase ID token') from error
        return identity, token

    def authenticate_header(self, request):
        return 'Bearer'
