from django.test import TestCase, SimpleTestCase
from rest_framework.test import APIClient
from rest_framework.exceptions import ValidationError
from .addresses import normalize_addresses, profile_addresses
from .models import User
from .serializers import UserSerializer
from .firebase_views import validated_profile


ADDRESS = dict(id='home', label='Home', city='Haifa', street_name='Main', house_number=3, is_default=True)


class AddressValidationTests(SimpleTestCase):
    def test_legacy_and_explicit_empty(self):
        legacy = {key: ADDRESS[key] for key in ('city', 'street_name', 'house_number')}
        self.assertTrue(profile_addresses(legacy)[0]['is_default'])
        self.assertEqual(profile_addresses({**legacy, 'addresses': []}), [])

    def test_default_normalized_and_invalid_books_rejected(self):
        self.assertTrue(normalize_addresses([{**ADDRESS, 'is_default': False}])[0]['is_default'])
        for book in ([ADDRESS, ADDRESS], [ADDRESS, {**ADDRESS, 'id': 'work'}], [{**ADDRESS, 'house_number': 0}], [ADDRESS] * 21):
            with self.assertRaises(ValidationError):
                normalize_addresses(book)

    def test_firebase_updates_legacy_fields_and_clears_last_address(self):
        self.assertEqual(validated_profile({'addresses': [ADDRESS]})['city'], 'Haifa')
        self.assertEqual(validated_profile({'addresses': []}), dict(addresses=[], city='', street_name='', house_number=None))


class AddressProfileTests(TestCase):
    def test_book_persists_and_default_remains_backward_compatible(self):
        user = User.objects.create_user(username='customer', password='password', city='Old', street_name='Old', house_number=1)
        self.assertEqual(UserSerializer(user).data['addresses'][0]['id'], 'legacy')
        serializer = UserSerializer(user, data={'addresses': [ADDRESS]}, partial=True)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        serializer.save()
        user.refresh_from_db()
        self.assertEqual(user.addresses, [ADDRESS])
        self.assertEqual(user.city, ADDRESS['city'])
        serializer = UserSerializer(user, data={'addresses': []}, partial=True)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        serializer.save()
        self.assertEqual(UserSerializer(user).data['addresses'], [])
