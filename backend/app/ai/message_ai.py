"""AI-2: Message Generation."""
import logging
from fastapi import HTTPException

from app.ai.prompts import MESSAGE_SYSTEM_PROMPT
from app.ai.llm_client import call_llm, parse_json_response

logger = logging.getLogger(__name__)


async def generate_message(segment_description: str, goal: str, channel: str) -> dict:
    """Generate personalized campaign message for a given segment and channel."""
    user_prompt = (
        f"Audience: {segment_description}\n"
        f"Campaign goal: {goal}\n"
        f"Channel: {channel}\n\n"
        f"Write the campaign message for this channel."
    )

    try:
        raw = await call_llm(MESSAGE_SYSTEM_PROMPT, user_prompt)
        result = parse_json_response(raw)
    except ValueError as e:
        raise HTTPException(502, f"Message generation failed: {e}")

    return {
        "message": result.get("message", ""),
        "subject": result.get("subject"),
    }
