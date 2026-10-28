"""Shared address-book validation for SQL and Firebase profiles."""
from rest_framework import serializers


class AddressSerializer(serializers.Serializer):
    id = serializers.RegexField(r'^[A-Za-z0-9_-]{1,64}$')
    label = serializers.CharField(max_length=40)
    city = serializers.CharField(max_length=20)
    street_name = serializers.CharField(max_length=50)
    house_number = serializers.IntegerField(min_value=1)
    is_default = serializers.BooleanField(default=False)


def normalize_addresses(value):
    serializer = AddressSerializer(data=value, many=True)
    serializer.is_valid(raise_exception=True)
    addresses = [dict(item) for item in serializer.validated_data]
    if len(addresses) > 20:
        raise serializers.ValidationError('You can save up to 20 addresses.')
    if len({item['id'] for item in addresses}) != len(addresses):
        raise serializers.ValidationError('Address IDs must be unique.')
    if sum(item['is_default'] for item in addresses) > 1:
        raise serializers.ValidationError('Choose one default address.')
    if addresses and not any(item['is_default'] for item in addresses):
        addresses[0]['is_default'] = True
    return addresses


def profile_addresses(data):
    if data.get('addresses') is not None:
        return data['addresses']
    if data.get('city') and data.get('street_name') and data.get('house_number'):
        return [dict(id='legacy', label='בית', city=data['city'],
                     street_name=data['street_name'], house_number=data['house_number'], is_default=True)]
    return []


def default_fields(addresses):
    default = next((item for item in addresses if item['is_default']), {})
    return {key: default.get(key, None if key == 'house_number' else '')
            for key in ('city', 'street_name', 'house_number')}
