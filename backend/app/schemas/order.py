from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel
import uuid


class OrderCreate(BaseModel):
    customer_id: uuid.UUID
    amount: Decimal
    product_category: str
    ordered_at: datetime


class OrderOut(BaseModel):
    id: uuid.UUID
    customer_id: uuid.UUID
    amount: Decimal
    product_category: str
    ordered_at: datetime
    created_at: datetime

    model_config = {"from_attributes": True}
