"""All AI endpoints."""
import logging
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.ai import (
    NLSegmentRequest, NLSegmentResponse,
    MessageRequest, MessageResponse,
    ChannelRequest, ChannelResponse,
    AgentRequest, AgentConfirmRequest,
)
from app.ai.segment_ai import nl_to_segment
from app.ai.message_ai import generate_message
from app.ai.channel_ai import recommend_channel
from app.ai.agent import run_campaign_agent
from app.api.auth import get_current_user
from app.models.segment import Segment
from app.models.campaign import Campaign
from app.models.comm_event import CommEvent
from app.services.segment_engine import get_segment_customer_ids
from app.services.campaign_service import launch_campaign

router = APIRouter(tags=["ai"])
logger = logging.getLogger(__name__)


@router.post("/ai/segment", response_model=NLSegmentResponse)
async def ai_segment(
    payload: NLSegmentRequest,
    _user: str = Depends(get_current_user),
):
    """Convert natural language query to segment filter rules."""
    try:
        result = await nl_to_segment(payload.query)
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"AI segment error: {e}")
        raise HTTPException(500, f"AI error: {e}")


@router.post("/ai/message", response_model=MessageResponse)
async def ai_message(
    payload: MessageRequest,
    _user: str = Depends(get_current_user),
):
    """Generate campaign message copy for a segment and channel."""
    try:
        result = await generate_message(
            payload.segment_description,
            payload.goal,
            payload.channel,
        )
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"AI message error: {e}")
        raise HTTPException(500, f"AI error: {e}")


@router.post("/ai/channel", response_model=ChannelResponse)
async def ai_channel(
    payload: ChannelRequest,
    _user: str = Depends(get_current_user),
):
    """Recommend the best channel for a campaign."""
    try:
        result = await recommend_channel(
            payload.segment_description,
            payload.goal,
            payload.audience_size,
        )
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"AI channel error: {e}")
        raise HTTPException(500, f"AI error: {e}")


@router.post("/ai/agent")
async def ai_agent(
    payload: AgentRequest,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
):
    """
    Campaign agent — streams SSE events for each reasoning step.
    Client should use EventSource or fetch with stream reading.
    """
    return StreamingResponse(
        run_campaign_agent(payload.goal, db),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",   # Disable nginx buffering
        },
    )


@router.post("/ai/agent/confirm", status_code=202)
async def ai_agent_confirm(
    payload: AgentConfirmRequest,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
):
    """
    Confirm and launch an agent-generated campaign.
    Creates segment (if no segment_id), creates campaign, dispatches launch.
    """
    from datetime import datetime, timezone

    # Create segment if no existing segment_id
    if not payload.segment_id and payload.filter_rules:
        segment = Segment(
            name=payload.name + " Audience",
            filter_rules=payload.filter_rules,
            created_by_ai=True,
        )
        db.add(segment)
        await db.flush()
        segment_id = str(segment.id)
    elif payload.segment_id:
        segment_id = payload.segment_id
        segment = await db.get(Segment, segment_id)
        if not segment:
            raise HTTPException(404, "Segment not found")
    else:
        raise HTTPException(400, "Must provide either segment_id or filter_rules")

    # Create campaign
    campaign = Campaign(
        name=payload.name,
        segment_id=segment_id,
        message=payload.message,
        channel=payload.channel,
        status="launching",
        launched_at=datetime.now(timezone.utc),
    )
    db.add(campaign)
    await db.commit()
    await db.refresh(campaign)

    # Get customer IDs and dispatch
    segment_obj = await db.get(Segment, segment_id)
    customer_ids = await get_segment_customer_ids(db, segment_obj.filter_rules)

    from app.workers.campaign_tasks import send_campaign_to_recipients
    send_campaign_to_recipients.delay(str(campaign.id), customer_ids)

    return {
        "status": "launching",
        "campaign_id": str(campaign.id),
        "recipient_count": len(customer_ids),
    }
