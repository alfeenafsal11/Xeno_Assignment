from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text

from app.core.database import get_db
from app.models.customer import Customer
from app.schemas.customer import CustomerCreate, CustomerOut, CustomerListResponse

router = APIRouter(tags=["customers"])


@router.post("/customers", response_model=CustomerOut, status_code=201)
async def create_customer(payload: CustomerCreate, db: AsyncSession = Depends(get_db)):
    customer = Customer(**payload.model_dump())
    db.add(customer)
    try:
        await db.commit()
        await db.refresh(customer)
    except Exception as e:
        await db.rollback()
        if "unique" in str(e).lower():
            raise HTTPException(409, f"Customer with email {payload.email} already exists")
        raise HTTPException(500, str(e))
    return customer


@router.post("/customers/bulk", status_code=201)
async def bulk_create_customers(payload: list[CustomerCreate], db: AsyncSession = Depends(get_db)):
    customers = [Customer(**c.model_dump()) for c in payload]
    db.add_all(customers)
    try:
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(500, str(e))
    return {"created": len(customers)}


@router.get("/customers", response_model=CustomerListResponse)
async def list_customers(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=200),
    search: str = Query(None),
    db: AsyncSession = Depends(get_db),
):
    query = select(Customer)
    count_query = select(func.count()).select_from(Customer)

    if search:
        like = f"%{search}%"
        query = query.where(
            (Customer.name.ilike(like)) | (Customer.email.ilike(like)) | (Customer.city.ilike(like))
        )
        count_query = count_query.where(
            (Customer.name.ilike(like)) | (Customer.email.ilike(like)) | (Customer.city.ilike(like))
        )

    total_result = await db.execute(count_query)
    total = total_result.scalar()

    result = await db.execute(query.offset(skip).limit(limit).order_by(Customer.created_at.desc()))
    customers = result.scalars().all()

    return {"total": total, "items": customers}


@router.get("/customers/{customer_id}", response_model=CustomerOut)
async def get_customer(customer_id: str, db: AsyncSession = Depends(get_db)):
    customer = await db.get(Customer, customer_id)
    if not customer:
        raise HTTPException(404, "Customer not found")
    return customer
