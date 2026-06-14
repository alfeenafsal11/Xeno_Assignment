"""AI-3: Channel Recommendation."""
import logging
from fastapi import HTTPException

from app.ai.prompts import CHANNEL_SYSTEM_PROMPT
from app.ai.llm_client import call_llm, parse_json_response

logger = logging.getLogger(__name__)


async def recommend_channel(segment_description: str, goal: str, audience_size: int) -> dict:
    """Recommend the best channel for a campaign based on audience and goal."""
    user_prompt = (
        f"Audience description: {segment_description}\n"
        f"Campaign goal: {goal}\n"
        f"Audience size: {audience_size} customers\n\n"
        f"Which channel should this campaign use?"
    )

    try:
        raw = await call_llm(CHANNEL_SYSTEM_PROMPT, user_prompt)
        result = parse_json_response(raw)
    except ValueError as e:
        raise HTTPException(502, f"Channel recommendation failed: {e}")

    return {
        "recommended": result.get("recommended", "email"),
        "ranking": result.get("ranking", ["email", "whatsapp", "sms", "rcs"]),
        "reasoning": result.get("reasoning", ""),
    }
