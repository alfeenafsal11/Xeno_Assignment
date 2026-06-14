from pydantic import BaseModel


class ReceiptPayload(BaseModel):
    campaign_id: str
    customer_id: str
    status: str       # delivered, failed, opened, clicked
    channel: str
    idempotency_key: str
