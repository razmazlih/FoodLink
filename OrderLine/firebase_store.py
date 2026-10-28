"""Firestore order storage. Money is stored in integer cents only."""
from datetime import datetime, timezone

from fastapi import HTTPException
from google.cloud import firestore
from google.cloud.firestore_v1.base_query import FieldFilter
from foodlink_core.firebase import db
from foodlink_core.repository import allocate_id


def reference(collection, identifier):
    return db().collection(collection).document(str(identifier))


def read(reference, transaction=None):
    snapshot = reference.get(transaction=transaction)
    if not snapshot.exists:
        raise HTTPException(404, 'Resource not found')
    return snapshot.to_dict() | {'id': int(snapshot.id)}


def documents(collection, field=None, value=None, transaction=None):
    query = db().collection(collection)
    if field is not None:
        query = query.where(filter=FieldFilter(field, '==', value))
    return [snapshot.to_dict() | {'id': int(snapshot.id)} for snapshot in query.stream(transaction=transaction)]


def authorize(order, identity, transaction=None):
    if identity.role == 'admin' or order['user_id'] == identity.uid:
        return
    restaurant = read(reference('restaurants', order['restaurant_id']), transaction)
    if identity.role == 'restaurant_owner' and restaurant.get('owner_uid') == identity.uid:
        return
    raise HTTPException(403, 'Order access denied')


def manage(order, identity, transaction=None):
    if identity.role == 'admin':
        return
    restaurant = read(reference('restaurants', order['restaurant_id']), transaction)
    if identity.role == 'restaurant_owner' and restaurant.get('owner_uid') == identity.uid:
        return
    raise HTTPException(403, 'Restaurant management permission required')


def draft(order):
    if order.get('state', 'draft') != 'draft':
        raise HTTPException(409, 'Only draft orders can be edited')


def item_response(item):
    return {key: value for key, value in item.items() if key != 'price_cents'} | {'price': item['price_cents'] / 100}


def order_response(order, full=False):
    statuses = documents('order_statuses', 'order_id', order['id'])
    statuses.sort(key=lambda status: status['id'])
    result = {key: order[key] for key in ['id', 'user_id', 'restaurant_id', 'ordered_at']}
    result['delivery_address'] = order.get('delivery_address')
    result.update(total_price=order.get('total_cents', 0) / 100, status=statuses)
    if full:
        items = documents('order_items', 'order_id', order['id'])
        result['items'] = [item_response(item) for item in sorted(items, key=lambda item: item['id'])]
    return result


def create_order(payload, identity):
    if payload.user_id != identity.uid:
        raise HTTPException(403, 'Cannot create an order for another user')
    @firestore.transactional
    def create(transaction):
        read(reference('restaurants', payload.restaurant_id), transaction)
        identifier = allocate_id('orders', transaction=transaction)
        order = dict(id=identifier, user_id=identity.uid, restaurant_id=payload.restaurant_id,
                     ordered_at=datetime.now(timezone.utc), total_cents=0, state='draft')
        transaction.create(reference('orders', identifier), order)
        return order
    return order_response(create(db().transaction()))


def update_order(identifier, payload, identity):
    @firestore.transactional
    def update(transaction):
        ref = reference('orders', identifier)
        order = read(ref, transaction)
        authorize(order, identity, transaction)
        if payload.user_id is not None and payload.user_id != order['user_id']:
            raise HTTPException(403, 'Order ownership cannot be changed')
        if payload.restaurant_id is not None and payload.restaurant_id != order['restaurant_id']:
            raise HTTPException(409, 'Create a new cart to change restaurants')
        if 'delivery_address' in payload.model_fields_set:
            draft(order)
            if identity.uid != order['user_id'] and identity.role != 'admin':
                raise HTTPException(403, 'Only the customer can select a delivery address')
            if payload.delivery_address is None:
                raise HTTPException(422, 'Delivery address cannot be empty')
            address = payload.delivery_address.model_dump()
            transaction.update(ref, {'delivery_address': address})
            order['delivery_address'] = address
        # total_price remains a calculated, read-only field.
        return order
    return order_response(update(db().transaction()))


def mutate_item(identity, payload=None, item_id=None, delete=False):
    @firestore.transactional
    def mutate(transaction):
        existing = read(reference('order_items', item_id), transaction) if item_id is not None else None
        order_id = existing['order_id'] if existing else payload.order_id
        order_ref = reference('orders', order_id)
        order = read(order_ref, transaction)
        authorize(order, identity, transaction)
        draft(order)
        if existing:
            updated = {**existing, 'quantity': payload.quantity if payload and payload.quantity is not None else existing['quantity']}
            identifier = item_id
        else:
            menu = read(reference('menu_items', payload.menu_item_id), transaction)
            if menu['restaurant_id'] != order['restaurant_id']:
                raise HTTPException(409, 'Menu item belongs to a different restaurant')
            if menu.get('is_available') is False:
                raise HTTPException(409, 'Menu item is unavailable')
            price = menu['price_cents']
            if not isinstance(price, int) or isinstance(price, bool) or price < 0:
                raise HTTPException(409, 'Menu item has an invalid price')
            identifier = allocate_id('order_items', transaction=transaction)
            updated = dict(id=identifier, order_id=order_id, menu_item_id=payload.menu_item_id,
                           quantity=payload.quantity, price_cents=price, name=menu['name'])
        old_total = existing['price_cents'] * existing['quantity'] if existing else 0
        new_total = 0 if delete else updated['price_cents'] * updated['quantity']
        total = order.get('total_cents', 0) - old_total + new_total
        if total < 0:
            raise HTTPException(409, 'Order total is inconsistent')
        if delete:
            transaction.delete(reference('order_items', identifier))
        elif existing:
            transaction.update(reference('order_items', identifier), {'quantity': updated['quantity']})
        else:
            transaction.create(reference('order_items', identifier), updated)
        transaction.update(order_ref, {'total_cents': total})
        return item_response(updated)
    return mutate(db().transaction())


def delete_order(identifier, identity):
    @firestore.transactional
    def delete(transaction):
        ref = reference('orders', identifier)
        order = read(ref, transaction)
        authorize(order, identity, transaction)
        draft(order)
        items = documents('order_items', 'order_id', identifier, transaction)
        statuses = documents('order_statuses', 'order_id', identifier, transaction)
        for item in items:
            transaction.delete(reference('order_items', item['id']))
        for status in statuses:
            transaction.delete(reference('order_statuses', status['id']))
        transaction.delete(ref)
    delete(db().transaction())


def create_status(payload, identity):
    @firestore.transactional
    def create(transaction):
        ref = reference('orders', payload.order_id)
        order = read(ref, transaction)
        authorize(order, identity, transaction)
        current = order.get('state', 'draft')
        allowed = {'draft': {'active', 'cancelled'}, 'active': {'cancelled', 'delivered'}}
        if payload.status not in allowed.get(current, set()):
            raise HTTPException(409, 'Invalid order status transition')
        if payload.status == 'delivered':
            manage(order, identity, transaction)
        if payload.status == 'active' and order.get('total_cents', 0) <= 0:
            raise HTTPException(409, 'Cannot submit an empty order')
        identifier = allocate_id('order_statuses', transaction=transaction)
        status = dict(id=identifier, order_id=payload.order_id, status=payload.status,
                      updated_at=datetime.now(timezone.utc))
        transaction.create(reference('order_statuses', identifier), status)
        transaction.update(ref, {'state': payload.status})
        return status
    return create(db().transaction())
