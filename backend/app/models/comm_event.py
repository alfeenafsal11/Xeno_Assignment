from sqlalchemy import Column, String, DateTime, ForeignKey, UniqueConstraint, Index, text
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base


class CommEvent(Base):
    __tablename__ = "comm_events"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    campaign_id = Column(UUID(as_uuid=True), ForeignKey("campaigns.id"), nullable=False)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id"), nullable=False)
    channel = Column(String(20))
    status = Column(String(20), default="sent")   # sent, delivered, failed, opened, clicked
    idempotency_key = Column(String(255), unique=True, nullable=False)
    event_at = Column(DateTime(timezone=True), server_default=text("NOW()"))
    created_at = Column(DateTime(timezone=True), server_default=text("NOW()"))

    __table_args__ = (
        UniqueConstraint("idempotency_key", name="uq_comm_events_idempotency_key"),
        Index("ix_comm_events_campaign_status", "campaign_id", "status"),
    )
