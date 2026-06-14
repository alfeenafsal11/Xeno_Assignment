"""
Celery task for campaign fan-out.

Note: Celery workers are synchronous by default. We use asyncio.run() to bridge
into our async database and HTTP code. Each task gets its own event loop.
"""
import asyncio
import logging
from app.core.celery_app import celery_app
from app.core.database import AsyncSessionLocal
from app.services.campaign_service import launch_campaign

logger = logging.getLogger(__name__)


@celery_app.task(name="app.workers.campaign_tasks.send_campaign_to_recipients", bind=True, max_retries=3)
def send_campaign_to_recipients(self, campaign_id: str, customer_ids: list):
    """
    Celery task: fan out campaign messages to all recipients.
    Runs synchronously but bridges into async via asyncio.run().
    """
    logger.info(f"Launching campaign {campaign_id} to {len(customer_ids)} recipients")

    async def _run():
        async with AsyncSessionLocal() as db:
            await launch_campaign(db, campaign_id, customer_ids)

    try:
        asyncio.run(_run())
        logger.info(f"Campaign {campaign_id} launched successfully")
    except Exception as exc:
        logger.error(f"Campaign {campaign_id} task failed: {exc}")
        raise self.retry(exc=exc, countdown=60)
