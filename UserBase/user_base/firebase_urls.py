from django.urls import path
from django.http import JsonResponse
from django.views.decorators.http import require_GET
from users.firebase_views import (FirebaseAdminStatsView, FirebaseAdminUsersView,
    FirebaseChangePasswordView, FirebaseChangeUsernameView, FirebaseProfileView, FirebaseRegisterView)


@require_GET
def healthz(request):
    return JsonResponse({"status": "ok", "service": "userbase"})


urlpatterns = [
    path("healthz", healthz),
    path("api/users/profile/", FirebaseProfileView.as_view()),
    path("api/users/register/", FirebaseRegisterView.as_view()),
    path("api/users/change-username/", FirebaseChangeUsernameView.as_view()),
    path("api/users/change-password/", FirebaseChangePasswordView.as_view()),
    path("api/admin/users/", FirebaseAdminUsersView.as_view()),
    path("api/admin/users/<str:uid>/", FirebaseAdminUsersView.as_view()),
    path("api/admin/stats/", FirebaseAdminStatsView.as_view()),
]
