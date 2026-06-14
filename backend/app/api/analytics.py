from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.services.analytics_service import get_all_campaigns_analytics

router = APIRouter(tags=["analytics"])


@router.get("/analytics/campaigns")
async def aggregate_analytics(db: AsyncSession = Depends(get_db)):
    """Aggregate analytics across all campaigns — used by the dashboard KPIs."""
    return await get_all_campaigns_analytics(db)
