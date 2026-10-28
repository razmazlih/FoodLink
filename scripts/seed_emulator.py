#!/usr/bin/env python3
"""Create repeatable local demo fixtures. This script refuses real projects."""
from pathlib import Path
import sys
from urllib.parse import urlsplit

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from firebase_admin import auth
from foodlink_core.firebase import configuration, db
from foodlink_core.repository import create_document, list_documents, update_document

PASSWORD = 'FoodLink-test-123'


def require_local_emulators():
    project, auth_host, store_host = configuration()
    if not project.startswith('demo-') or not auth_host or not store_host:
        raise RuntimeError('This command only supports a demo- project with both emulators')
    for host in (auth_host, store_host):
        if urlsplit('//' + host).hostname not in ('localhost', '127.0.0.1', '::1'):
            raise RuntimeError('Demo fixture commands require loopback emulator hosts')
    return project


def account(email, role):
    try:
        user = auth.get_user_by_email(email)
        user = auth.update_user(user.uid, password=PASSWORD, email_verified=True,
                                display_name=f'Demo {role}', disabled=False)
    except auth.UserNotFoundError:
        user = auth.create_user(email=email, password=PASSWORD, email_verified=True,
                                display_name=f'Demo {role}')
    auth.set_custom_user_claims(user.uid, {'role': role})
    db().collection('users').document(user.uid).set({
        'username': f'Demo {role}', 'phone_number': '0500000000',
        'city': 'Haifa', 'street_name': 'Main', 'house_number': 1,
    })
    return user.uid


def seed():
    project = require_local_emulators()
    db()  # Initialize the default Admin app before calling Auth Admin.
    admin_uid = account('admin@example.test', 'admin')
    account('customer@example.test', 'customer')
    fixtures = list_documents('restaurants', filters=[('seed_key', '==', 'emulator-demo-v1')])
    if fixtures:
        restaurant = fixtures[0]
        update_document('restaurants', restaurant['id'], {'owner_uid': admin_uid})
    else:
        restaurant = create_document('restaurants', {
            'name': 'Demo Kitchen', 'city': 'Haifa', 'address': 'Main 1',
            'owner_uid': admin_uid, 'seed_key': 'emulator-demo-v1', 'photo_url': '',
        })
    restaurant_id = restaurant['id']
    existing_hours = list_documents('opening_hours', filters=[('restaurant', '==', restaurant_id)])
    by_day = {value['day_of_week']: value for value in existing_hours}
    for day in ('Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'):
        values = {'restaurant': restaurant_id, 'day_of_week': day, 'is_open': True,
                  'opening_time': '00:00:00', 'closing_time': '23:59:59'}
        if day in by_day:
            update_document('opening_hours', by_day[day]['id'], values)
        else:
            create_document('opening_hours', values)
    categories = list_documents('menu_categories', filters=[('restaurant', '==', restaurant_id)])
    category = categories[0] if categories else create_document('menu_categories', {
        'name': 'Main', 'restaurant': restaurant_id,
    })
    items = list_documents('menu_items', filters=[('category', '==', category['id'])])
    if not items:
        create_document('menu_items', {
            'name': 'Demo Dish', 'category': category['id'], 'restaurant_id': restaurant_id,
            'price_cents': 2500, 'description': 'Local emulator test dish', 'is_available': True,
        })
    # Only disposable emulator credentials are ever printed.
    print(f'Local emulator project: {project}')
    print(f'Admin: admin@example.test / {PASSWORD}')
    print(f'Customer: customer@example.test / {PASSWORD}')
    print(f'Restaurant: Demo Kitchen (id {restaurant_id}), menu item: Demo Dish (25.00)')


if __name__ == '__main__':
    seed()
