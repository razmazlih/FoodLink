from rest_framework import serializers
from .models import User
from .addresses import normalize_addresses, profile_addresses, default_fields


class UserSerializer(serializers.ModelSerializer):
    addresses = serializers.JSONField(required=False)

    def validate_addresses(self, value):
        return normalize_addresses(value)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['addresses'] = profile_addresses(data)
        return data

    def update(self, instance, validated_data):
        if 'addresses' in validated_data:
            validated_data.update(default_fields(validated_data['addresses']))
        return super().update(instance, validated_data)

    class Meta:
        model = User
        fields = [
            "addresses",
            "id",
            "username",
            "email",
            "user_type",
            "phone_number",
            "city",
            "street_name",
            "house_number",
        ]
        read_only_fields = ["id", "username", "email"]


class CreateUserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True, required=True, style={"input_type": "password"}
    )

    class Meta:
        model = User
        fields = [
            "username",
            "email",
            "password",
            "user_type",
            "phone_number",
            "city",
            "street_name",
            "house_number",
        ]

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True, write_only=True)
    new_password = serializers.CharField(required=True, write_only=True)

    def validate_old_password(self, value):
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("הסיסמה הישנה שגויה.")
        return value

    def validate_new_password(self, value):
        if len(value) < 8:
            raise serializers.ValidationError("הסיסמה החדשה חייבת להכיל לפחות 8 תווים.")
        return value


class ChangeUsernameSerializer(serializers.Serializer):
    new_username = serializers.CharField(required=True)

    def validate_new_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("שם המשתמש כבר תפוס.")
        return value
