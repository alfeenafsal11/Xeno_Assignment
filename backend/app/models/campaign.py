from sqlalchemy import Column, String, Text, DateTime, ForeignKey, text
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base


class Campaign(Base):
    __tablename__ = "campaigns"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    name = Column(String(255), nullable=False)
    segment_id = Column(UUID(as_uuid=True), ForeignKey("segments.id"), nullable=True)
    message = Column(Text, nullable=False)
    channel = Column(String(20), nullable=False)  # whatsapp, email, sms, rcs
    status = Column(String(20), default="draft")   # draft, launching, active, completed
    launched_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=text("NOW()"))
