from datetime import datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, EmailStr
import uuid


class CustomerCreate(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = None
    city: Optional[str] = None
    loyalty_tier: Optional[str] = "bronze"


class CustomerOut(BaseModel):
    id: uuid.UUID
    name: str
    email: str
    phone: Optional[str] = None
    city: Optional[str] = None
    loyalty_tier: Optional[str] = None
    total_spent: Optional[Decimal] = None
    last_order_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class CustomerListResponse(BaseModel):
    total: int
    items: list[CustomerOut]
