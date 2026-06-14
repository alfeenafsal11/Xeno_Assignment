"""Campaign service — business logic for campaign launch."""
import httpx
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text

from app.models.campaign import Campaign
from app.models.comm_event import CommEvent
from app.core.config import settings

logger = logging.getLogger(__name__)


async def launch_campaign(db: AsyncSession, campaign_id: str, customer_ids: list[str]):
    """
    Fan-out: for each customer, POST to channel service and create a 'sent' comm_event.
    Called from the Celery task (which uses a sync DB session).
    This async version is used when called from the API directly.
    """
    campaign = await db.get(Campaign, campaign_id)
    if not campaign:
        logger.error(f"Campaign {campaign_id} not found during launch")
        return

    async with httpx.AsyncClient(timeout=10.0) as client:
        for customer_id in customer_ids:
            idempotency_key = f"{campaign_id}:{customer_id}:sent"

            # Create comm_event with status=sent
            event = CommEvent(
                campaign_id=campaign_id,
                customer_id=customer_id,
                channel=campaign.channel,
                status="sent",
                idempotency_key=idempotency_key,
            )
            db.add(event)

            # POST to channel service (fire and forget — callbacks come via /receipt)
            try:
                await client.post(
                    f"{settings.CHANNEL_SERVICE_URL}/send",
                    json={
                        "campaign_id": campaign_id,
                        "customer_id": customer_id,
                        "channel": campaign.channel,
                        "message": campaign.message,
                    },
                )
            except Exception as e:
                logger.warning(f"Channel service unavailable for {customer_id}: {e}")

    await db.commit()

    # Mark campaign as active
    campaign.status = "active"
    from datetime import datetime, timezone
    campaign.launched_at = datetime.now(timezone.utc)
    await db.commit()
