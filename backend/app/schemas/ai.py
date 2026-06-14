from pydantic import BaseModel
from typing import Optional, Any


class NLSegmentRequest(BaseModel):
    query: str


class NLSegmentResponse(BaseModel):
    filter_rules: dict[str, Any]
    suggested_name: str


class MessageRequest(BaseModel):
    segment_description: str
    goal: str
    channel: str  # whatsapp, email, sms, rcs


class MessageResponse(BaseModel):
    message: str
    subject: Optional[str] = None  # for email only


class ChannelRequest(BaseModel):
    segment_description: str
    goal: str
    audience_size: int


class ChannelResponse(BaseModel):
    recommended: str
    ranking: list[str]
    reasoning: str


class AgentRequest(BaseModel):
    goal: str


class AgentConfirmRequest(BaseModel):
    name: str
    segment_id: Optional[str] = None
    filter_rules: Optional[dict[str, Any]] = None
    message: str
    channel: str
