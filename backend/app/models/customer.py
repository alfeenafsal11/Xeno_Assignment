from sqlalchemy import Column, String, Numeric, DateTime, text
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base


class Customer(Base):
    __tablename__ = "customers"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    phone = Column(String(20))
    city = Column(String(100))
    loyalty_tier = Column(String(20))  # bronze, silver, gold, platinum
    total_spent = Column(Numeric(12, 2), default=0)
    last_order_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=text("NOW()"))
