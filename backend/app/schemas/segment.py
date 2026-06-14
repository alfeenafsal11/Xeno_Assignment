from datetime import datetime
from typing import Optional, Any
from pydantic import BaseModel
import uuid


class SegmentCreate(BaseModel):
    name: str
    filter_rules: dict[str, Any]
    created_by_ai: bool = False
    nl_query: Optional[str] = None


class SegmentOut(BaseModel):
    id: uuid.UUID
    name: str
    filter_rules: dict[str, Any]
    created_by_ai: bool
    nl_query: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class SegmentPreviewResponse(BaseModel):
    count: int
    sample: list[dict]
