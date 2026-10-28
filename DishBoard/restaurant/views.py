from django.forms import ValidationError
from rest_framework.viewsets import ModelViewSet
from rest_framework.response import Response
from .models import OpeningHours, Restaurant
from .serializers import OpeningHoursSerializer, RestaurantSerializer
from .photos import photo_url_for_upload
from .opening_hours import is_open_at, next_opening_time
from datetime import datetime
from django.utils.timezone import make_aware
from django.db.models import Prefetch


class RestaurantViewSet(ModelViewSet):
    queryset = Restaurant.objects.all()
    serializer_class = RestaurantSerializer

    def perform_create(self, serializer):
        image_file = self.request.FILES.get("photo")
        serializer.save(photo_url=photo_url_for_upload(image_file))

    def perform_update(self, serializer):
        image_file = self.request.FILES.get("photo")
        if image_file:
            serializer.save(photo_url=photo_url_for_upload(image_file))
        else:
            serializer.save()

    def list(self, request, *args, **kwargs):
        fields = request.query_params.get("fields", None)
        queryset = self.get_queryset().prefetch_related(
            Prefetch("opening_hours", queryset=OpeningHours.objects.filter(is_open=True).order_by("pk"),
                     to_attr="open_hours")
        )
        now = make_aware(datetime.now())
        current_day = now.strftime("%A")
        current_time = now.time()

        restaurants_data = []
        for restaurant in queryset:
            today_hours = next(
                (hours for hours in restaurant.open_hours if hours.day_of_week == current_day),
                None,
            )

            is_open_now = is_open_at(today_hours, current_time)

            restaurants_data.append(
                {"restaurant": restaurant, "is_open_now": bool(is_open_now)}
            )

        restaurants_data.sort(key=lambda x: x["is_open_now"], reverse=True)

        serializer = self.get_serializer(
            [r["restaurant"] for r in restaurants_data], many=True
        )

        if fields:
            if "id" not in fields:
                fields = "id," + fields

            fields = fields.split(",")
            data = [
                {field: item[field] for field in fields if field in item}
                for item in serializer.data
            ]
            return Response(data)

        return Response(serializer.data)


class OpeningHouersViewSet(ModelViewSet):
    queryset = OpeningHours.objects.all()
    serializer_class = OpeningHoursSerializer

    def get_queryset(self):
        restaurant_id = self.request.query_params.get("restaurant_id")
        if not restaurant_id:
            raise ValidationError(
                {"detail": "The 'restaurant_id' parameter is required."}
            )

        queryset = super().get_queryset()
        queryset = queryset.filter(restaurant__id=restaurant_id)
        return queryset

    def when_open(self, request, *args, **kwargs):
        restaurant_id = self.request.query_params.get("restaurant_id")
        if not restaurant_id:
            raise ValidationError(
                {"detail": "The 'restaurant_id' parameter is required."}
            )

        now = make_aware(datetime.now())
        current_day = now.strftime("%A")
        current_time = now.time()

        today_hours = OpeningHours.objects.filter(
            restaurant__id=restaurant_id, day_of_week=current_day
        ).first()

        if is_open_at(today_hours, current_time):
            return Response({"is_open": True, "closes_at": today_hours.closing_time})

        next_day_hours = self.get_next_opening_time(restaurant_id, current_day)

        if next_day_hours:
            return Response(
                {
                    "is_open": False,
                    "opens_at": next_day_hours["opening_time"],
                    "next_day": next_day_hours["day_of_week"],
                }
            )

        return Response({"is_open": False, "message": "No opening hours available."})

    def get_next_opening_time(self, restaurant_id, current_day):
        return next_opening_time(restaurant_id, current_day)
