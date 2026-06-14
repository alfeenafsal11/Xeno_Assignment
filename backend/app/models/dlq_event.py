from sqlalchemy import Column, Integer, Text, DateTime, text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.core.database import Base


class DlqEvent(Base):
    __tablename__ = "dlq_events"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    payload = Column(JSONB, nullable=False)
    error = Column(Text)
    retry_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=text("NOW()"))
