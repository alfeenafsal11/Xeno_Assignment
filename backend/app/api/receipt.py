"""
Receipt endpoint — receives delivery callbacks from Channel Service.
Implements:
  1. Idempotency via INSERT ... ON CONFLICT DO NOTHING
  2. State machine transition validation
  3. Silent discard of invalid/duplicate events
"""
import logging
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.core.database import get_db
from app.schemas.receipt import ReceiptPayload

router = APIRouter(tags=["receipt"])
logger = logging.getLogger(__name__)

# Valid state machine transitions
VALID_TRANSITIONS = {
    "sent": {"delivered", "failed"},
    "delivered": {"opened"},
    "opened": {"clicked"},
    "failed": set(),
    "clicked": set(),
}


def is_valid_transition(current_status: str, new_status: str) -> bool:
    allowed = VALID_TRANSITIONS.get(current_status, set())
    return new_status in allowed


@router.post("/receipt")
async def receive_callback(payload: ReceiptPayload, db: AsyncSession = Depends(get_db)):
    """
    Process a delivery callback from Channel Service.

    Uses INSERT ... ON CONFLICT DO NOTHING for idempotency.
    Validates state machine transition before inserting.
    """
    # Find the current latest status for this campaign+customer combo
    current_status_sql = text(
        """
        SELECT status FROM comm_events
        WHERE campaign_id = :campaign_id AND customer_id = :customer_id
        ORDER BY event_at DESC
        LIMIT 1
        """
    )
    result = await db.execute(current_status_sql, {
        "campaign_id": payload.campaign_id,
        "customer_id": payload.customer_id,
    })
    row = result.fetchone()
    current_status = row[0] if row else None

    # Validate state machine transition
    if current_status is None:
        # No prior event — only 'sent' status should come first (from Celery task)
        # But we accept delivered/failed if sent event doesn't exist yet (race condition)
        if payload.status not in ("sent", "delivered", "failed"):
            logger.warning(
                f"Invalid initial status {payload.status} for "
                f"campaign={payload.campaign_id} customer={payload.customer_id}"
            )
            return {"status": "invalid_transition_ignored"}
    else:
        if not is_valid_transition(current_status, payload.status):
            logger.info(
                f"Invalid transition {current_status} → {payload.status} for "
                f"campaign={payload.campaign_id} customer={payload.customer_id}"
            )
            return {"status": "invalid_transition_ignored"}

    # INSERT with ON CONFLICT DO NOTHING for idempotency
    insert_sql = text(
        """
        INSERT INTO comm_events (campaign_id, customer_id, channel, status, idempotency_key, event_at)
        VALUES (:campaign_id, :customer_id, :channel, :status, :idempotency_key, NOW())
        ON CONFLICT (idempotency_key) DO NOTHING
        """
    )
    result = await db.execute(insert_sql, {
        "campaign_id": payload.campaign_id,
        "customer_id": payload.customer_id,
        "channel": payload.channel,
        "status": payload.status,
        "idempotency_key": payload.idempotency_key,
    })
    await db.commit()

    if result.rowcount == 0:
        logger.debug(f"Duplicate event ignored: {payload.idempotency_key}")
        return {"status": "duplicate_ignored"}

    return {"status": "ok"}
