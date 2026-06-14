from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.order import Order
from app.schemas.order import OrderCreate, OrderOut

router = APIRouter(tags=["orders"])


@router.post("/orders", response_model=OrderOut, status_code=201)
async def create_order(payload: OrderCreate, db: AsyncSession = Depends(get_db)):
    order = Order(**payload.model_dump())
    db.add(order)
    try:
        await db.commit()
        await db.refresh(order)
    except Exception as e:
        await db.rollback()
        raise HTTPException(500, str(e))
    return order
