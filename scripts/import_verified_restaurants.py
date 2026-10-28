#!/usr/bin/env python3
"""Validate the sourced catalog; write to Firestore only with --apply --project ID.

Imports are atomic per restaurant and repeat runs leave identical data alone.
No accounts, ownership claims, opening hours, or order availability are invented.
"""
import argparse
from datetime import date
import hashlib
import json
import os
from pathlib import Path
import re
import sys
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
MAX_ID = 2**53 - 1


def digest(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False).encode('utf-8')).hexdigest()


def load_catalog(path):
    catalog = json.loads(Path(path).read_text(encoding='utf-8'))
    date.fromisoformat(catalog['verified_on'])
    if not catalog['restaurants']:
        raise ValueError('The catalog is empty')
    keys, branches = set(), set()
    for restaurant in catalog['restaurants']:
        key = restaurant['key']
        if not re.fullmatch(r'[a-z0-9-]{1,100}', key) or key in keys:
            raise ValueError('Invalid or duplicate catalog key')
        keys.add(key)
        for field in ('name', 'city', 'address', 'price_context'):
            if not isinstance(restaurant[field], str) or not restaurant[field].strip():
                raise ValueError(f'Missing {field}: {key}')
        if any(len(restaurant[field]) > 50 for field in ('name', 'city', 'address')):
            raise ValueError(f'Restaurant exceeds API field limits: {key}')
        branch = digest([restaurant['name'], restaurant['address']])
        if branch in branches:
            raise ValueError('Duplicate restaurant branch')
        branches.add(branch)
        source = urlsplit(restaurant['source_url'])
        if source.scheme != 'https' or not source.hostname or source.username or source.password:
            raise ValueError(f'Expected a public HTTPS source: {key}')
        categories = restaurant['categories']
        if not categories:
            raise ValueError(f'No menu categories: {key}')
        names = set()
        for category in categories:
            name = category['name']
            if not isinstance(name, str) or not name.strip() or len(name) > 50 or name in names:
                raise ValueError(f'Invalid or duplicate category: {key}')
            names.add(name)
            if not category['items']:
                raise ValueError(f'Empty menu category: {key}')
            item_names = set()
            for item in category['items']:
                price = item['price_cents']
                name = item['name']
                if not isinstance(name, str) or not name.strip() or len(name) > 50 or name in item_names:
                    raise ValueError(f'Invalid or duplicate menu item: {key}')
                item_names.add(name)
                if type(price) is not int or not 0 < price <= 9999999999:
                    raise ValueError(f'Expected a positive integer price in agorot: {key}')
        count = len(categories) + sum(len(c['items']) for c in categories)
        if count > 200:
            raise ValueError('Catalog restaurant exceeds atomic import size limit')
    return catalog


def import_restaurant(client, restaurant, verified_on):
    from google.cloud import firestore

    marker_ref = client.collection('_verified_catalog').document(restaurant['key'])
    unique_ref = client.collection('_restaurant_keys').document(digest([restaurant['name'], restaurant['address']]))
    fingerprint = digest({'verified_on': verified_on, 'restaurant': restaurant})

    @firestore.transactional
    def save(transaction):
        marker_snapshot = marker_ref.get(transaction=transaction)
        unique_snapshot = unique_ref.get(transaction=transaction)
        previous = marker_snapshot.to_dict() if marker_snapshot.exists else None
        if previous and previous['fingerprint'] == fingerprint:
            return previous['restaurant_id'], 'unchanged'
        if unique_snapshot.exists and (not previous or unique_snapshot.to_dict()['restaurant_id'] != previous['restaurant_id']):
            raise ValueError(f"Existing branch is not managed by this importer: {restaurant['key']}")
        if previous and previous['branch_key'] != unique_ref.id:
            raise ValueError('Changing a previously imported branch identity requires manual review')

        counts = {'restaurants': 0 if previous else 1,
                  'menu_categories': len(restaurant['categories']),
                  'menu_items': sum(len(c['items']) for c in restaurant['categories'])}
        counters = {}
        for collection, count in counts.items():
            if count:
                ref = client.collection('_counters').document(collection)
                snap = ref.get(transaction=transaction)
                current = snap.to_dict().get('value', 0) if snap.exists else 0
                if type(current) is not int or current < 0 or current + count > MAX_ID:
                    raise ValueError('Invalid or exhausted ID counter')
                counters[collection] = (ref, current, count)
        # Every read precedes every write, including numeric counter reads.
        ids = {}
        for collection, (ref, current, count) in counters.items():
            ids[collection] = iter(range(current + 1, current + count + 1))
            transaction.set(ref, {'value': current + count})
        restaurant_id = previous['restaurant_id'] if previous else next(ids['restaurants'])
        metadata = {'source_url': restaurant['source_url'], 'verified_on': verified_on,
                    'price_context': restaurant['price_context'], 'catalog_only': True,
                    'catalog_key': restaurant['key']}
        values = {field: restaurant[field] for field in ('name', 'city', 'address')}
        values.update(metadata)
        restaurant_ref = client.collection('restaurants').document(str(restaurant_id))
        if previous:
            transaction.update(restaurant_ref, values)
            for collection, identifiers in previous['menu_documents'].items():
                for identifier in identifiers:
                    transaction.delete(client.collection(collection).document(str(identifier)))
        else:
            transaction.create(restaurant_ref, {**values, 'owner_uid': '', 'photo_url': ''})
        transaction.set(unique_ref, {'restaurant_id': restaurant_id})
        documents = {'menu_categories': [], 'menu_items': []}
        for category in restaurant['categories']:
            category_id = next(ids['menu_categories'])
            documents['menu_categories'].append(category_id)
            transaction.create(client.collection('menu_categories').document(str(category_id)),
                               {'name': category['name'], 'restaurant': restaurant_id})
            for item in category['items']:
                item_id = next(ids['menu_items'])
                documents['menu_items'].append(item_id)
                transaction.create(client.collection('menu_items').document(str(item_id)), {
                    'name': item['name'], 'price_cents': item['price_cents'],
                    'category': category_id, 'restaurant_id': restaurant_id,
                    'description': '', 'is_available': False, **metadata,
                })
        transaction.set(marker_ref, {'fingerprint': fingerprint, 'restaurant_id': restaurant_id,
                                   'branch_key': unique_ref.id, 'menu_documents': documents})
        return restaurant_id, 'updated' if previous else 'created'

    return save(client.transaction())


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--data', type=Path, default=ROOT / 'data/verified_restaurants.json')
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--project', help='Explicit Firebase project ID for writes')
    args = parser.parse_args()
    catalog = load_catalog(args.data)
    restaurants = catalog['restaurants']
    items = sum(len(c['items']) for r in restaurants for c in r['categories'])
    print(f"Validated {len(restaurants)} restaurants, {items} menu items; checked {catalog['verified_on']}.")
    if not args.apply:
        print('Dry run: no Firebase access or writes. Use --apply --project ID to import.')
        return
    if not args.project:
        parser.error('--apply requires --project')
    configured = os.environ.get('FIREBASE_PROJECT_ID')
    if configured and configured != args.project:
        parser.error('--project differs from FIREBASE_PROJECT_ID')
    os.environ['FIREBASE_PROJECT_ID'] = args.project
    from foodlink_core.firebase import db
    client = db()
    for restaurant in restaurants:
        identifier, status = import_restaurant(client, restaurant, catalog['verified_on'])
        print(f"{status}: {restaurant['name']} (id {identifier})")


if __name__ == '__main__':
    main()
