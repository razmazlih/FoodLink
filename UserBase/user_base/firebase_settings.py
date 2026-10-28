"""Firebase-only runtime: no Django ORM, sessions, or SQL database access."""
import os

SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "firebase-api-no-django-sessions")
DEBUG = False
ALLOWED_HOSTS = os.getenv("ALLOWED_HOSTS", "localhost,127.0.0.1,testserver").split(",")
CORS_ALLOWED_ORIGINS = os.getenv("CORS_ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001,http://localhost:3002,http://127.0.0.1:3002").split(",")
ROOT_URLCONF = "user_base.firebase_urls"
INSTALLED_APPS = ["rest_framework", "corsheaders"]
MIDDLEWARE = ["corsheaders.middleware.CorsMiddleware", "django.middleware.common.CommonMiddleware"]
DATABASES = {}
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["foodlink_core.drf.FirebaseAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "UNAUTHENTICATED_USER": None,
    "UNAUTHENTICATED_TOKEN": None,
}
LANGUAGE_CODE = "he"
TIME_ZONE = "Asia/Jerusalem"
USE_TZ = True
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
