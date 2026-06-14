from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models.campaign import Campaign
from app.models.segment import Segment
from app.schemas.campaign import CampaignCreate, CampaignOut, CampaignAnalyticsOut
from app.services.analytics_service import get_campaign_analytics
from app.services.segment_engine import get_segment_customer_ids, evaluate_segment
from app.api.auth import get_current_user

router = APIRouter(tags=["campaigns"])


@router.post("/campaigns", response_model=CampaignOut, status_code=201)
async def create_campaign(
    payload: CampaignCreate,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
):
    campaign = Campaign(**payload.model_dump())
    db.add(campaign)
    await db.commit()
    await db.refresh(campaign)
    return campaign


@router.get("/campaigns", response_model=list[CampaignOut])
async def list_campaigns(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Campaign).order_by(Campaign.created_at.desc()))
    return result.scalars().all()


@router.get("/campaigns/{campaign_id}", response_model=CampaignOut)
async def get_campaign(campaign_id: str, db: AsyncSession = Depends(get_db)):
    campaign = await db.get(Campaign, campaign_id)
    if not campaign:
        raise HTTPException(404, "Campaign not found")
    return campaign


@router.post("/campaigns/{campaign_id}/launch", status_code=202)
async def launch_campaign(
    campaign_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
):
    campaign = await db.get(Campaign, campaign_id)
    if not campaign:
        raise HTTPException(404, "Campaign not found")
    if campaign.status not in ("draft", "completed"):
        raise HTTPException(409, f"Campaign is already {campaign.status}")

    # Resolve segment → customer IDs
    if campaign.segment_id:
        segment = await db.get(Segment, str(campaign.segment_id))
        if not segment:
            raise HTTPException(404, "Segment not found")
        customer_ids = await get_segment_customer_ids(db, segment.filter_rules)
    else:
        raise HTTPException(400, "Campaign has no segment assigned")

    if not customer_ids:
        raise HTTPException(400, "Segment has 0 customers — cannot launch")

    # Set status to launching immediately
    campaign.status = "launching"
    campaign.launched_at = datetime.now(timezone.utc)
    await db.commit()

    # Dispatch Celery task
    from app.workers.campaign_tasks import send_campaign_to_recipients
    send_campaign_to_recipients.delay(str(campaign.id), customer_ids)

    return {
        "status": "launching",
        "campaign_id": str(campaign.id),
        "recipient_count": len(customer_ids),
        "message": f"Campaign launching to {len(customer_ids)} recipients",
    }


@router.get("/campaigns/{campaign_id}/analytics", response_model=CampaignAnalyticsOut)
async def campaign_analytics(campaign_id: str, db: AsyncSession = Depends(get_db)):
    campaign = await db.get(Campaign, campaign_id)
    if not campaign:
        raise HTTPException(404, "Campaign not found")
    analytics = await get_campaign_analytics(db, campaign_id)
    return analytics
