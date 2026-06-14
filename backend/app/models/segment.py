from sqlalchemy import Column, String, Boolean, Text, DateTime, text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.core.database import Base


class Segment(Base):
    __tablename__ = "segments"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    name = Column(String(255), nullable=False)
    filter_rules = Column(JSONB, nullable=False)
    created_by_ai = Column(Boolean, default=False)
    nl_query = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=text("NOW()"))
