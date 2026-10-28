from pydantic import BaseModel, ConfigDict
from typing import List, Optional
from datetime import datetime

from schemas.delivery_address import DeliveryAddress
from schemas.order_item_schemas import OrderItemResponseSchema
from schemas.order_status_schema import StatusShowSchema


class OrderCreateSchema(BaseModel):
    user_id: int
    restaurant_id: int

class SmallStatusSchema(BaseModel):
    status: str
    updated_at: datetime

class OrderSchema(BaseModel):
    id: Optional[int] = None
    user_id: int
    restaurant_id: int
    total_price: float
    delivery_address: Optional[DeliveryAddress] = None
    ordered_at: datetime
    status: List[SmallStatusSchema]

    model_config = ConfigDict(from_attributes=True)

class FullOrderSchema(BaseModel):
    id: Optional[int] = None
    user_id: int
    restaurant_id: int
    total_price: float
    delivery_address: Optional[DeliveryAddress] = None
    ordered_at: datetime
    items: List[OrderItemResponseSchema]
    status: List[StatusShowSchema]


class OrderUpdateSchema(BaseModel):
    delivery_address: Optional[DeliveryAddress] = None
    user_id: Optional[int] = None
    restaurant_id: Optional[int] = None
    total_price: Optional[float] = None

    model_config = ConfigDict(from_attributes=True)
