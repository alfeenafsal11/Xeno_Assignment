"""
Channel Service simulator — simulates message delivery and fires async callbacks.

Delivery probabilities:
  70% delivered
  10% failed
  20% pending (no callback — treated as lost)

After delivered:
  50% opened
  20% of opened → clicked

Retry logic:
  Max 3 retries with exponential backoff (2s, 4s, 8s)
  After 3 failures → log to DLQ (printed; can be persisted to CRM DLQ endpoint)
"""
import asyncio
import random
import logging
import httpx

logger = logging.getLogger(__name__)

DELIVERY_OUTCOMES = ["delivered"] * 70 + ["failed"] * 10 + ["pending"] * 20


async def simulate_delivery(payload: dict, crm_receipt_url: str):
    """
    Simulate delivery of a single message.
    Fires callbacks asynchronously for each delivery event.
    """
    await asyncio.sleep(random.uniform(1, 10))  # Simulate network delay

    outcome = random.choice(DELIVERY_OUTCOMES)
    logger.info(f"Delivery outcome for {payload.get('customer_id', 'unknown')}: {outcome}")

    if outcome == "pending":
        return  # No callback — message is lost

    await send_callback(crm_receipt_url, payload, outcome)

    if outcome == "delivered":
        if random.random() < 0.50:  # 50% open rate
            await asyncio.sleep(random.uniform(5, 30))
            await send_callback(crm_receipt_url, payload, "opened")

            if random.random() < 0.20:  # 20% click rate from opened
                await asyncio.sleep(random.uniform(2, 10))
                await send_callback(crm_receipt_url, payload, "clicked")


async def send_callback(url: str, payload: dict, status: str, retry: int = 0):
    """
    Send a delivery status callback to the CRM receipt endpoint.
    Implements exponential backoff retry with max 3 retries.
    After exhausting retries, logs to DLQ.
    """
    idempotency_key = f"{payload['campaign_id']}:{payload['customer_id']}:{status}"

    callback_payload = {
        "campaign_id": payload["campaign_id"],
        "customer_id": payload["customer_id"],
        "status": status,
        "channel": payload.get("channel", "unknown"),
        "idempotency_key": idempotency_key,
    }

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.post(url, json=callback_payload)
            response.raise_for_status()
            logger.debug(f"Callback sent: {idempotency_key} → {response.status_code}")
    except Exception as e:
        if retry < 3:
            backoff = 2 ** (retry + 1)  # 2s, 4s, 8s
            logger.warning(f"Callback failed (retry {retry + 1}/3) for {idempotency_key}: {e}. Retrying in {backoff}s...")
            await asyncio.sleep(backoff)
            await send_callback(url, payload, status, retry + 1)
        else:
            logger.error(f"DLQ: Callback permanently failed for {idempotency_key} after 3 retries: {e}")
            # In production, this would be written to the dlq_events table
            # For now, log it — the CRM has its own DLQ table
