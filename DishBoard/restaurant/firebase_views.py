"""Firestore restaurant/menu APIs with verified ownership on every mutation."""
from datetime import datetime, time
import hashlib
import json
from decimal import Decimal
from zoneinfo import ZoneInfo

from google.cloud import firestore
from rest_framework import serializers
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.viewsets import ViewSet

from foodlink_core.firebase import db
from foodlink_core.repository import (NotFoundError, allocate_id, get_document,
    list_documents, reserve_ids)
from .photos import photo_url_for_upload
from .firestore_mutations import (owned_transaction, query as transaction_query,
    read as transaction_read, reference, require_owner as own_restaurant)

DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]


def document(collection, identifier):
    try:
        return get_document(collection, identifier)
    except NotFoundError:
        raise NotFound("Not found.")


def positive_id(value, field="id"):
    return serializers.IntegerField(min_value=1).run_validation(value)



def restaurant_for_category(category):
    return document("restaurants", category["restaurant"])


def validate(serializer_type, data, partial=False):
    unknown = set(data) - set(serializer_type().fields)
    if unknown:
        raise ValidationError({key: "Unsupported field." for key in unknown})
    serializer = serializer_type(data=data, partial=partial)
    serializer.is_valid(raise_exception=True)
    return dict(serializer.validated_data)


class RestaurantInput(serializers.Serializer):
    name = serializers.CharField(max_length=50)
    city = serializers.CharField(max_length=50)
    address = serializers.CharField(max_length=50)
    owner_uid = serializers.CharField(required=False, max_length=128)
    photo = serializers.ImageField(required=False, write_only=True)


class CategoryInput(serializers.Serializer):
    name = serializers.CharField(max_length=50)
    restaurant = serializers.IntegerField(min_value=1)


class ItemInput(serializers.Serializer):
    name = serializers.CharField(max_length=50)
    category = serializers.IntegerField(min_value=1)
    price = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal("0"), required=False)
    description = serializers.CharField(required=False, allow_blank=True)
    is_available = serializers.BooleanField(required=False)


class HoursInput(serializers.Serializer):
    restaurant = serializers.IntegerField(min_value=1)
    day_of_week = serializers.ChoiceField(choices=DAYS)
    is_open = serializers.BooleanField(required=False)
    opening_time = serializers.TimeField(required=False)
    closing_time = serializers.TimeField(required=False)


def restaurant_key(data):
    return hashlib.sha256(json.dumps([data["name"], data["address"]], ensure_ascii=False).encode("utf-8")).hexdigest()


def restaurant_output(data):
    result = {key: data.get(key, "") for key in ("id", "name", "city", "address", "photo_url", "owner_uid")}
    result.update({key: data[key] for key in ("source_url", "verified_on", "price_context", "catalog_only") if key in data})
    return result


def item_output(data):
    result = {"id": data["id"], "category": data["category"], "name": data["name"],
            "price": f"{Decimal(data.get('price_cents', 0)) / 100:.2f}",
            "description": data.get("description", "אין תיאור זמין"),
            "is_available": data.get("is_available", True)}
    result.update({key: data[key] for key in ("source_url", "verified_on") if key in data})
    return result


def category_output(data, items=None):
    if items is None:
        items = list_documents("menu_items", filters=[("category", "==", data["id"])])
    return {"id": data["id"], "restaurant": data["restaurant"], "name": data["name"],
            "items": [item_output(item) for item in items]}


def hours_output(data):
    return {key: data[key] for key in ("id", "restaurant", "day_of_week", "is_open", "opening_time", "closing_time")}


def is_open(hours, now):
    return bool(hours and hours.get("is_open") and
                time.fromisoformat(hours["opening_time"]) <= now.time().replace(tzinfo=None) <=
                time.fromisoformat(hours["closing_time"]))


def delete_in_transaction(transaction, documents):
    if len(documents) > 450:
        raise ValidationError({"detail": "Remove related menu items in smaller groups before deleting this restaurant/category."})
    for collection, identifier in documents:
        transaction.delete(reference(collection, identifier))


class FirebaseRestaurantViewSet(ViewSet):
    permission_classes = [AllowAny]

    def list(self, request):
        restaurants = list_documents("restaurants")
        hours = list_documents("opening_hours", filters=[("is_open", "==", True)])
        now = datetime.now(ZoneInfo("Asia/Jerusalem"))
        day = now.strftime("%A")
        current = {hour["restaurant"]: hour for hour in sorted(hours, key=lambda value: value["id"], reverse=True)
                   if hour["day_of_week"] == day}
        restaurants.sort(key=lambda item: is_open(current.get(item["id"]), now), reverse=True)
        data = [restaurant_output(item) for item in restaurants]
        fields = request.query_params.get("fields")
        if fields:
            fields = list(dict.fromkeys(["id"] + fields.split(",")))
            data = [{key: item[key] for key in fields if key in item} for item in data]
        return Response(data)

    def retrieve(self, request, pk=None):
        return Response(restaurant_output(document("restaurants", positive_id(pk))))

    def create(self, request):
        # Validate the identity before inspecting or storing uploads.
        own_restaurant(request.user, {"owner_uid": getattr(request.user, "uid", None)})
        values = validate(RestaurantInput, request.data)
        owner = values.pop("owner_uid", request.user.uid)
        if not request.user.is_admin and owner != request.user.uid:
            raise PermissionDenied("Cannot assign another restaurant owner.")
        values["owner_uid"] = owner
        values["photo_url"] = photo_url_for_upload(values.pop("photo", None))
        client = db()
        identifier = allocate_id("restaurants")
        hour_ids = reserve_ids("opening_hours", 7)
        @firestore.transactional
        def save(transaction):
            unique_ref = client.collection("_restaurant_keys").document(restaurant_key(values))
            if unique_ref.get(transaction=transaction).exists:
                raise ValidationError({"name": "A restaurant with this name and address already exists."})
            transaction.create(unique_ref, {"restaurant_id": identifier})
            transaction.create(client.collection("restaurants").document(str(identifier)), values)
            for day, hour_id in zip(DAYS, hour_ids):
                transaction.create(client.collection("opening_hours").document(str(hour_id)),
                    {"restaurant": identifier, "day_of_week": day, "is_open": False,
                     "opening_time": "00:00:00", "closing_time": "00:00:00"})
        save(client.transaction())
        return Response(restaurant_output({**values, "id": identifier}), status=201)

    def partial_update(self, request, pk=None):
        identifier = positive_id(pk)
        existing = document("restaurants", identifier)
        own_restaurant(request.user, existing)
        values = validate(RestaurantInput, request.data, partial=True)
        if "owner_uid" in values and not request.user.is_admin:
            raise PermissionDenied("Only administrators can transfer ownership.")
        photo = values.pop("photo", None)
        if photo:
            values["photo_url"] = photo_url_for_upload(photo)
        def save(transaction, parents):
            current = parents[identifier]
            updated = {**current, **values}
            old_key, new_key = restaurant_key(current), restaurant_key(updated)
            if old_key != new_key:
                unique_ref = db().collection("_restaurant_keys").document(new_key)
                unique = unique_ref.get(transaction=transaction)
                if unique.exists and unique.to_dict().get("restaurant_id") != identifier:
                    raise ValidationError({"name": "A restaurant with this name and address already exists."})
                if not unique.exists:
                    transaction.create(unique_ref, {"restaurant_id": identifier})
                transaction.delete(db().collection("_restaurant_keys").document(old_key))
            if values:
                transaction.update(reference("restaurants", identifier), values)
            return updated
        saved = owned_transaction(request.user, [identifier], save)
        return Response(restaurant_output(saved))

    update = partial_update

    def destroy(self, request, pk=None):
        identifier = positive_id(pk)
        own_restaurant(request.user, document("restaurants", identifier))
        def remove(transaction, parents):
            categories = transaction_query(transaction, "menu_categories", [("restaurant", identifier)])
            items = transaction_query(transaction, "menu_items", [("restaurant_id", identifier)])
            hours = transaction_query(transaction, "opening_hours", [("restaurant", identifier)])
            documents = [("restaurants", identifier)] + [(collection, value["id"]) for collection, values in
                         [("menu_categories", categories), ("menu_items", items), ("opening_hours", hours)] for value in values]
            delete_in_transaction(transaction, documents)
            transaction.delete(db().collection("_restaurant_keys").document(restaurant_key(parents[identifier])))
        owned_transaction(request.user, [identifier], remove, deleting=True)
        return Response(status=204)


class FirebaseCategoryViewSet(ViewSet):
    permission_classes = [AllowAny]

    def list(self, request):
        restaurant_id = positive_id(request.query_params.get("restaurant_id"), "restaurant_id")
        categories = list_documents("menu_categories", filters=[("restaurant", "==", restaurant_id)])
        items = list_documents("menu_items", filters=[("restaurant_id", "==", restaurant_id)])
        return Response([category_output(category, [item for item in items if item["category"] == category["id"]])
                         for category in categories])

    def retrieve(self, request, pk=None):
        return Response(category_output(document("menu_categories", positive_id(pk))))

    def create(self, request):
        values = validate(CategoryInput, request.data)
        own_restaurant(request.user, document("restaurants", values["restaurant"]))
        identifier = allocate_id("menu_categories")
        def save(transaction, parents):
            duplicates = transaction_query(transaction, "menu_categories", [("restaurant", values["restaurant"]), ("name", values["name"])])
            if duplicates:
                raise ValidationError({"name": "A category with this name already exists in this restaurant."})
            transaction.create(reference("menu_categories", identifier), values)
            return {**values, "id": identifier}
        saved = owned_transaction(request.user, [values["restaurant"]], save)
        return Response(category_output(saved, []), status=201)

    def partial_update(self, request, pk=None):
        identifier = positive_id(pk)
        existing = document("menu_categories", identifier)
        own_restaurant(request.user, restaurant_for_category(existing))
        values = validate(CategoryInput, request.data, partial=True)
        values.pop("restaurant", None)  # Preserve the existing category's parent.
        def save(transaction, parents):
            current = transaction_read(transaction, "menu_categories", identifier)
            if current["restaurant"] != existing["restaurant"]:
                raise NotFound()
            if "name" in values:
                duplicates = transaction_query(transaction, "menu_categories", [("restaurant", current["restaurant"]), ("name", values["name"])])
                if any(item["id"] != identifier for item in duplicates):
                    raise ValidationError({"name": "A category with this name already exists in this restaurant."})
            if values:
                transaction.update(reference("menu_categories", identifier), values)
            return {**current, **values}
        saved = owned_transaction(request.user, [existing["restaurant"]], save)
        return Response(category_output(saved))

    update = partial_update

    def destroy(self, request, pk=None):
        identifier = positive_id(pk)
        existing = document("menu_categories", identifier)
        own_restaurant(request.user, restaurant_for_category(existing))
        def remove(transaction, parents):
            transaction_read(transaction, "menu_categories", identifier)
            items = transaction_query(transaction, "menu_items", [("category", identifier)])
            documents = [("menu_categories", identifier)] + [("menu_items", item["id"]) for item in items]
            delete_in_transaction(transaction, documents)
        owned_transaction(request.user, [existing["restaurant"]], remove)
        return Response(status=204)


class FirebaseItemViewSet(ViewSet):
    permission_classes = [AllowAny]

    def list(self, request):
        return Response({"detail": "קריאת רשימת פריטים אינה נתמכת."}, status=405)

    def retrieve(self, request, pk=None):
        return Response(item_output(document("menu_items", positive_id(pk))))

    def create(self, request):
        values = validate(ItemInput, request.data)
        category = document("menu_categories", values["category"])
        own_restaurant(request.user, restaurant_for_category(category))
        values["restaurant_id"] = category["restaurant"]
        values["price_cents"] = int(values.pop("price", Decimal("0")) * 100)
        values.setdefault("description", "אין תיאור זמין")
        values.setdefault("is_available", True)
        identifier = allocate_id("menu_items")
        def save(transaction, parents):
            current_category = transaction_read(transaction, "menu_categories", values["category"])
            if current_category["restaurant"] != values["restaurant_id"]:
                raise NotFound()
            transaction.create(reference("menu_items", identifier), values)
        owned_transaction(request.user, [values["restaurant_id"]], save)
        return Response(item_output({**values, "id": identifier}), status=201)

    def partial_update(self, request, pk=None):
        identifier = positive_id(pk)
        existing = document("menu_items", identifier)
        own_restaurant(request.user, document("restaurants", existing["restaurant_id"]))
        values = validate(ItemInput, request.data, partial=True)
        if "category" in values:
            category = document("menu_categories", values["category"])
            own_restaurant(request.user, restaurant_for_category(category))
            values["restaurant_id"] = category["restaurant"]
        if "price" in values:
            values["price_cents"] = int(values.pop("price") * 100)
        def save(transaction, parents):
            current = transaction_read(transaction, "menu_items", identifier)
            if current["restaurant_id"] != existing["restaurant_id"]:
                raise NotFound()
            if "category" in values:
                category = transaction_read(transaction, "menu_categories", values["category"])
                if category["restaurant"] != values["restaurant_id"]:
                    raise NotFound()
            if values:
                transaction.update(reference("menu_items", identifier), values)
            return {**current, **values}
        saved = owned_transaction(request.user, [existing["restaurant_id"], values.get("restaurant_id", existing["restaurant_id"])], save)
        return Response(item_output(saved))

    update = partial_update

    def destroy(self, request, pk=None):
        identifier = positive_id(pk)
        existing = document("menu_items", identifier)
        own_restaurant(request.user, document("restaurants", existing["restaurant_id"]))
        def remove(transaction, parents):
            current = transaction_read(transaction, "menu_items", identifier)
            if current["restaurant_id"] != existing["restaurant_id"]:
                raise NotFound()
            transaction.delete(reference("menu_items", identifier))
        owned_transaction(request.user, [existing["restaurant_id"]], remove)
        return Response(status=204)


class FirebaseHoursViewSet(ViewSet):
    permission_classes = [AllowAny]

    def restaurant_id(self, request):
        return positive_id(request.query_params.get("restaurant_id"), "restaurant_id")

    def list(self, request):
        identifier = self.restaurant_id(request)
        return Response([hours_output(value) for value in list_documents("opening_hours", filters=[("restaurant", "==", identifier)])])

    def retrieve(self, request, pk=None):
        value = document("opening_hours", positive_id(pk))
        if value["restaurant"] != self.restaurant_id(request):
            raise NotFound()
        return Response(hours_output(value))

    def create(self, request):
        values = validate(HoursInput, request.data)
        own_restaurant(request.user, document("restaurants", values["restaurant"]))
        values.setdefault("is_open", False)
        values["opening_time"] = values.get("opening_time", time()).isoformat()
        values["closing_time"] = values.get("closing_time", time()).isoformat()
        identifier = allocate_id("opening_hours")
        def save(transaction, parents):
            duplicates = transaction_query(transaction, "opening_hours", [("restaurant", values["restaurant"]), ("day_of_week", values["day_of_week"])])
            if duplicates:
                raise ValidationError({"day_of_week": "This restaurant already has opening hours for that day."})
            transaction.create(reference("opening_hours", identifier), values)
        owned_transaction(request.user, [values["restaurant"]], save)
        return Response(hours_output({**values, "id": identifier}), status=201)

    def partial_update(self, request, pk=None):
        identifier = positive_id(pk)
        existing = document("opening_hours", identifier)
        if existing["restaurant"] != self.restaurant_id(request):
            raise NotFound()
        own_restaurant(request.user, document("restaurants", existing["restaurant"]))
        values = validate(HoursInput, request.data, partial=True)
        if "restaurant" in values and values["restaurant"] != existing["restaurant"]:
            raise ValidationError({"restaurant": "Opening hours cannot move between restaurants."})
        if "day_of_week" in values and values["day_of_week"] != existing["day_of_week"]:
            raise ValidationError({"day_of_week": "Update the existing record for that day."})
        for field in ("opening_time", "closing_time"):
            if field in values:
                values[field] = values[field].isoformat()
        def save(transaction, parents):
            current = transaction_read(transaction, "opening_hours", identifier)
            if current["restaurant"] != existing["restaurant"]:
                raise NotFound()
            if values:
                transaction.update(reference("opening_hours", identifier), values)
            return {**current, **values}
        saved = owned_transaction(request.user, [existing["restaurant"]], save)
        return Response(hours_output(saved))

    update = partial_update

    def destroy(self, request, pk=None):
        identifier = positive_id(pk)
        existing = document("opening_hours", identifier)
        if existing["restaurant"] != self.restaurant_id(request):
            raise NotFound()
        own_restaurant(request.user, document("restaurants", existing["restaurant"]))
        def remove(transaction, parents):
            current = transaction_read(transaction, "opening_hours", identifier)
            if current["restaurant"] != existing["restaurant"]:
                raise NotFound()
            transaction.delete(reference("opening_hours", identifier))
        owned_transaction(request.user, [existing["restaurant"]], remove)
        return Response(status=204)

    def when_open(self, request):
        identifier = self.restaurant_id(request)
        hours = list_documents("opening_hours", filters=[("restaurant", "==", identifier)])
        now = datetime.now(ZoneInfo("Asia/Jerusalem"))
        day = now.strftime("%A")
        today = next((value for value in sorted(hours, key=lambda item: item["id"]) if value["day_of_week"] == day), None)
        if is_open(today, now):
            return Response({"is_open": True, "closes_at": today["closing_time"]})
        current_index = DAYS.index(day)
        for offset in range(1, 8):
            next_day = DAYS[(current_index + offset) % 7]
            next_hours = next((value for value in sorted(hours, key=lambda item: item["id"])
                               if value["day_of_week"] == next_day and value["is_open"]), None)
            if next_hours:
                return Response({"is_open": False, "opens_at": next_hours["opening_time"], "next_day": next_day})
        return Response({"is_open": False, "message": "No opening hours available."})
