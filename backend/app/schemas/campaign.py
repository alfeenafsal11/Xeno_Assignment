from datetime import datetime
from typing import Optional
from pydantic import BaseModel
import uuid


class CampaignCreate(BaseModel):
    name: str
    segment_id: Optional[uuid.UUID] = None
    message: str
    channel: str  # whatsapp, email, sms, rcs


class CampaignOut(BaseModel):
    id: uuid.UUID
    name: str
    segment_id: Optional[uuid.UUID] = None
    message: str
    channel: str
    status: str
    launched_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class CampaignAnalyticsOut(BaseModel):
    campaign_id: uuid.UUID
    sent: int
    delivered: int
    failed: int
    opened: int
    clicked: int
    delivery_rate: float
    open_rate: float
    click_rate: float
