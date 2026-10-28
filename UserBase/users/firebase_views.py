"""Firebase account APIs. Password authentication belongs to the client SDK."""
from firebase_admin import auth
from .addresses import normalize_addresses, profile_addresses, default_fields
from rest_framework import serializers, status
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView
from foodlink_core.firebase import db
from foodlink_core.repository import (NotFoundError, create_document, get_document,
                                     list_documents, update_document)


class ProfileInput(serializers.Serializer):
    addresses = serializers.JSONField(required=False)
    username = serializers.CharField(max_length=150, required=False)
    phone_number = serializers.RegexField(r"^\d{10}$", required=False, allow_blank=True)
    city = serializers.CharField(max_length=50, required=False, allow_blank=True)
    street_name = serializers.CharField(max_length=50, required=False, allow_blank=True)
    house_number = serializers.IntegerField(required=False, allow_null=True)


def profile_data(data, identity):
    result = {key: data.get(key, "") for key in ProfileInput().fields}
    result["addresses"] = profile_addresses(data)
    result.update(id=identity.uid, email=identity.email or "", user_type=identity.role)
    result["username"] = result["username"] or (identity.email or identity.uid).split("@")[0]
    return result


def validated_profile(data):
    unexpected = set(data) - set(ProfileInput().fields)
    if unexpected:
        raise ValidationError({key: "This field cannot be changed here." for key in unexpected})
    serializer = ProfileInput(data=data)
    serializer.is_valid(raise_exception=True)
    changes = dict(serializer.validated_data)
    if 'addresses' in changes:
        changes['addresses'] = normalize_addresses(changes['addresses'])
        changes.update(default_fields(changes['addresses']))
    return changes


def ensure_profile(identity, changes=None):
    try:
        data = get_document("users", identity.uid)
    except NotFoundError:
        data = create_document("users", changes or {}, document_id=identity.uid)
    else:
        if changes:
            data = update_document("users", identity.uid, changes)
    return profile_data(data, identity)


class FirebaseProfileView(APIView):
    def get(self, request):
        return Response(ensure_profile(request.user))

    def patch(self, request):
        return Response(ensure_profile(request.user, validated_profile(request.data)))

    put = patch


class FirebaseRegisterView(APIView):
    def post(self, request):
        return Response(ensure_profile(request.user, validated_profile(request.data)),
                        status=status.HTTP_201_CREATED)


class FirebaseChangeUsernameView(APIView):
    def put(self, request):
        if set(request.data) != {"new_username"}:
            raise ValidationError({"new_username": "Provide only new_username."})
        changes = validated_profile({"username": request.data["new_username"]})
        ensure_profile(request.user, changes)
        return Response({"message": "שם המשתמש שונה בהצלחה."})


class FirebaseChangePasswordView(APIView):
    def put(self, request):
        raise ValidationError({"detail": "Change your password using Firebase Authentication in the client."})


def require_admin(identity):
    if not identity.is_admin:
        raise PermissionDenied("Administrator access required.")


def role_from_claims(claims):
    claims = claims or {}
    if claims.get("admin") is True or claims.get("role") == "admin":
        return "admin"
    return "restaurant_owner" if claims.get("role") == "restaurant_owner" else "customer"


def admin_user_data(user, profile=None):
    profile = profile or {}
    return {"id": user.uid, "name": profile.get("username") or user.display_name or user.email or user.uid,
            "email": user.email or "", "role": role_from_claims(user.custom_claims)}


def auth_user(uid):
    try:
        return auth.get_user(uid)
    except auth.UserNotFoundError:
        raise NotFound("User not found.")


def user_profile(uid):
    try:
        return get_document("users", uid)
    except NotFoundError:
        return {}


class FirebaseAdminUsersView(APIView):
    def get(self, request, uid=None):
        require_admin(request.user)
        db()  # Initialize the shared Firebase app before Auth Admin calls.
        if uid:
            return Response(admin_user_data(auth_user(uid), user_profile(uid)))
        profiles = {str(profile["id"]): profile for profile in list_documents("users")}
        return Response([admin_user_data(user, profiles.get(user.uid))
                         for user in auth.list_users().iterate_all()])

    def post(self, request):
        require_admin(request.user)
        return Response({"detail": "Create accounts through Firebase Authentication registration."}, status=405)

    def put(self, request, uid=None):
        require_admin(request.user)
        if not uid:
            raise NotFound()
        unknown = set(request.data) - {"name", "email", "role"}
        if unknown:
            raise ValidationError({field: "Unsupported field." for field in unknown})
        if "role" in request.data and request.data["role"] not in {"admin", "customer", "restaurant_owner"}:
            raise ValidationError({"role": "Invalid role."})
        email = serializers.EmailField().run_validation(request.data["email"]) if "email" in request.data else None
        name = serializers.CharField(max_length=150).run_validation(request.data["name"]) if "name" in request.data else None
        db()
        user = auth_user(uid)
        updates = {}
        if email is not None:
            updates["email"] = email
        if name is not None:
            updates["display_name"] = name
        if updates:
            try:
                user = auth.update_user(uid, **updates)
            except auth.EmailAlreadyExistsError:
                raise ValidationError({"email": "Email already exists."})
        if "role" in request.data:
            claims = dict(user.custom_claims or {})
            claims.pop("admin", None)
            claims["role"] = request.data["role"]
            auth.set_custom_user_claims(uid, claims)
            auth.revoke_refresh_tokens(uid)
            user = auth_user(uid)
        if name is not None:
            try:
                update_document("users", uid, {"username": name})
            except NotFoundError:
                create_document("users", {"username": name}, document_id=uid)
        return Response(admin_user_data(user, user_profile(uid)))

    patch = put

    def delete(self, request, uid=None):
        require_admin(request.user)
        if not uid:
            raise NotFound()
        db()
        auth_user(uid)
        auth.delete_user(uid)
        # Keep historical order references, but remove the account profile.
        db().collection("users").document(uid).delete()
        return Response(status=204)


def collection_count(collection):
    # Aggregation reads avoid downloading every document for dashboard counts.
    return int(db().collection(collection).count().get()[0][0].value)


class FirebaseAdminStatsView(APIView):
    def get(self, request):
        require_admin(request.user)
        db()
        delivered = list_documents("orders", filters=[("state", "==", "delivered")])
        return Response({"totalUsers": sum(1 for _ in auth.list_users().iterate_all()),
                         "totalRestaurants": collection_count("restaurants"),
                         "totalOrders": collection_count("orders"),
                         "totalRevenue": sum(order.get("total_cents", 0) for order in delivered) / 100})
