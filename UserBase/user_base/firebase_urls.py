from django.urls import path
from users.firebase_views import (FirebaseAdminStatsView, FirebaseAdminUsersView,
    FirebaseChangePasswordView, FirebaseChangeUsernameView, FirebaseProfileView, FirebaseRegisterView)

urlpatterns = [
    path("api/users/profile/", FirebaseProfileView.as_view()),
    path("api/users/register/", FirebaseRegisterView.as_view()),
    path("api/users/change-username/", FirebaseChangeUsernameView.as_view()),
    path("api/users/change-password/", FirebaseChangePasswordView.as_view()),
    path("api/admin/users/", FirebaseAdminUsersView.as_view()),
    path("api/admin/users/<str:uid>/", FirebaseAdminUsersView.as_view()),
    path("api/admin/stats/", FirebaseAdminStatsView.as_view()),
]
