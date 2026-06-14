"""Channel Service — separate FastAPI microservice for message delivery simulation."""
import os
import logging
from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware

from app.simulator import simulate_delivery

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Xeno Channel Service", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

CRM_RECEIPT_URL = os.getenv("CRM_RECEIPT_URL", "http://localhost:8000/api/receipt")


@app.post("/send")
async def send_message(payload: dict, background_tasks: BackgroundTasks):
    """
    Accept a message send request and schedule async delivery simulation.
    Returns immediately — delivery callbacks arrive asynchronously.
    """
    logger.info(
        f"Queued message for campaign={payload.get('campaign_id')} "
        f"customer={payload.get('customer_id')} channel={payload.get('channel')}"
    )
    background_tasks.add_task(simulate_delivery, payload, CRM_RECEIPT_URL)
    return {"status": "queued"}


@app.get("/health")
def health():
    return {"status": "ok", "service": "channel-service"}


@app.get("/")
def root():
    return {"service": "Xeno Channel Service", "version": "1.0.0"}
