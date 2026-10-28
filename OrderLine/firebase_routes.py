"""Authenticated HTTP and WebSocket interfaces for Firebase mode."""
import asyncio
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field

from foodlink_core.firebase import AuthenticationError, Identity, verify_id_token
import firebase_store as store
from schemas.delivery_address import DeliveryAddress
from routes.order_status_websocket import ConnectionManager

router = APIRouter()
security = HTTPBearer(auto_error=False)
manager = ConnectionManager()


def authenticated(credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security)]):
    if not credentials or credentials.scheme.lower() != 'bearer':
        raise HTTPException(401, 'Firebase ID token required', headers={'WWW-Authenticate': 'Bearer'})
    try:
        return verify_id_token(credentials.credentials)
    except AuthenticationError:
        raise HTTPException(401, 'Invalid Firebase ID token', headers={'WWW-Authenticate': 'Bearer'})


Caller = Annotated[Identity, Depends(authenticated)]


class OrderCreate(BaseModel):
    user_id: str = Field(min_length=1)
    restaurant_id: int = Field(gt=0)


class OrderUpdate(BaseModel):
    delivery_address: DeliveryAddress | None = None
    user_id: str | None = None
    restaurant_id: int | None = Field(default=None, gt=0)
    total_price: float | None = None


class ItemCreate(BaseModel):
    order_id: int = Field(gt=0)
    menu_item_id: int = Field(gt=0)
    quantity: int = Field(ge=0, le=1000, strict=True)
    price: float | None = None  # Compatibility input; server pricing always wins.


class ItemUpdate(BaseModel):
    quantity: int | None = Field(default=None, ge=0, le=1000, strict=True)
    price: float | None = None  # Read-only compatibility field.


class StatusCreate(BaseModel):
    order_id: int = Field(gt=0)
    status: Literal['active', 'cancelled', 'delivered']


@router.post('/orders/')
def create_order(payload: OrderCreate, identity: Caller):
    return store.create_order(payload, identity)


@router.get('/orders/')
def list_orders(identity: Caller, user_id: str | None = None, all_orders: bool = Query(False, alias='all')):
    if identity.role != 'admin' and user_id is not None and user_id != identity.uid:
        raise HTTPException(403, 'Cannot list another user orders')
    if identity.role == 'admin':
        orders = store.documents('orders', 'user_id', user_id) if user_id else store.documents('orders')
    elif identity.role == 'restaurant_owner' and (all_orders or user_id is None):
        restaurants = store.documents('restaurants', 'owner_uid', identity.uid)
        orders = []
        for restaurant in restaurants:
            orders.extend(store.documents('orders', 'restaurant_id', restaurant['id']))
    else:
        orders = store.documents('orders', 'user_id', identity.uid)
    return [store.order_response(order) for order in sorted(orders, key=lambda order: order['id'])]


@router.get('/orders/{order_id}/')
def get_order(order_id: int, identity: Caller):
    order = store.read(store.reference('orders', order_id))
    store.authorize(order, identity)
    return store.order_response(order, full=True)


@router.put('/orders/{order_id}/')
def update_order(order_id: int, payload: OrderUpdate, identity: Caller):
    return store.update_order(order_id, payload, identity)


@router.delete('/orders/{order_id}/')
def delete_order(order_id: int, identity: Caller):
    store.delete_order(order_id, identity)
    return {'message': 'Order deleted successfully'}


@router.get('/order-item/{order_id}/')
def list_items(order_id: int, identity: Caller, skip: int = 0, limit: int = 10):
    order = store.read(store.reference('orders', order_id))
    store.authorize(order, identity)
    items = store.documents('order_items', 'order_id', order_id)
    if not items:
        raise HTTPException(404, 'Order items not found')
    return [store.item_response(item) for item in sorted(items, key=lambda item: item['id'])]


@router.post('/order-item/')
def create_item(payload: ItemCreate, identity: Caller):
    return store.mutate_item(identity, payload=payload)


@router.put('/order-item/{item_id}/')
def update_item(item_id: int, payload: ItemUpdate, identity: Caller):
    return store.mutate_item(identity, payload=payload, item_id=item_id)


@router.delete('/order-item/{item_id}/')
def delete_item(item_id: int, identity: Caller):
    store.mutate_item(identity, item_id=item_id, delete=True)
    return {'message': 'Deleted successfully'}


@router.get('/order-status/{order_id}/')
def list_statuses(order_id: int, identity: Caller):
    order = store.read(store.reference('orders', order_id))
    store.authorize(order, identity)
    return sorted(store.documents('order_statuses', 'order_id', order_id), key=lambda status: status['id'])


@router.post('/order-status/')
async def create_status(payload: StatusCreate, identity: Caller):
    status = store.create_status(payload, identity)
    await manager.broadcast(payload.order_id, payload.status)
    return status


@router.websocket('/ws/order-status/{order_id}')
async def order_status_socket(websocket: WebSocket, order_id: int):
    await websocket.accept()
    try:
        message = await asyncio.wait_for(websocket.receive_json(), timeout=10)
        if not isinstance(message, dict) or message.get('type') != 'auth' or not isinstance(message.get('token'), str):
            raise AuthenticationError('Missing authentication frame')
        identity = verify_id_token(message['token'])
    except (AuthenticationError, ValueError, KeyError, TypeError, asyncio.TimeoutError):
        await websocket.close(code=4401)
        return
    except WebSocketDisconnect:
        return
    try:
        order = store.read(store.reference('orders', order_id))
        store.authorize(order, identity)
    except HTTPException:
        await websocket.close(code=4403)
        return
    # The transport is accepted, but no subscription exists until verification succeeds.
    manager.active_connections.setdefault(order_id, []).append(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(websocket, order_id)
