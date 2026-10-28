from django.urls import include, path
from django.http import JsonResponse
from django.views.decorators.http import require_GET
from rest_framework.routers import DefaultRouter
from restaurant.firebase_views import (FirebaseCategoryViewSet, FirebaseHoursViewSet,
                                       FirebaseItemViewSet, FirebaseRestaurantViewSet)

restaurants = DefaultRouter()
restaurants.register("info", FirebaseRestaurantViewSet, basename="firebase-restaurant")
restaurants.register("opening-houers", FirebaseHoursViewSet, basename="firebase-hours")
menu = DefaultRouter()
menu.register("category", FirebaseCategoryViewSet, basename="firebase-category")
menu.register("item", FirebaseItemViewSet, basename="firebase-item")


@require_GET
def healthz(request):
    return JsonResponse({"status": "ok", "service": "dishboard"})


urlpatterns = [
    path("healthz", healthz),
    path("api/restaurants/opening-hours/when-open/", FirebaseHoursViewSet.as_view({"get": "when_open"})),
    path("api/restaurants/", include(restaurants.urls)),
    path("api/menu/", include(menu.urls)),
]
