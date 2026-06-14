"""AI-4: Campaign Agent — sequential LLM steps with SSE streaming."""
import json
import logging
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.prompts import AGENT_AUDIENCE_PROMPT, AGENT_SYNTHESIS_PROMPT
from app.ai.llm_client import call_llm, parse_json_response, validate_segment_rules
from app.services.segment_engine import evaluate_segment

logger = logging.getLogger(__name__)


def _sse_event(event_type: str, data: dict) -> str:
    """Format a Server-Sent Event string."""
    return f"event: {event_type}\ndata: {json.dumps(data)}\n\n"


async def run_campaign_agent(goal: str, db: AsyncSession) -> AsyncGenerator[str, None]:
    """
    Campaign Agent — produces SSE stream of step events.

    Steps:
    1. audience_finding   → LLM builds segment rules from goal
    2. audience_result    → evaluate segment, show count + reasoning
    3. message_draft      → LLM generates message copy
    4. channel_rec        → LLM recommends channel
    5. campaign_preview   → full campaign preview card
    6. awaiting_confirmation → human-in-the-loop pause
    """

    # Step 1: Announce audience analysis
    yield _sse_event("step", {
        "step": 1,
        "type": "audience_finding",
        "message": f"Analyzing your goal: \"{goal}\"..."
    })

    # Step 2: LLM builds segment rules
    try:
        audience_raw = await call_llm(AGENT_AUDIENCE_PROMPT, f"Campaign goal: {goal}")
        audience_data = parse_json_response(audience_raw)
    except Exception as e:
        yield _sse_event("error", {"message": f"Failed to analyze audience: {e}"})
        return

    suggested_name = audience_data.pop("suggested_name", "AI Segment")
    reasoning = audience_data.pop("reasoning", "")
    filter_rules = {
        "operator": audience_data.get("operator", "AND"),
        "conditions": audience_data.get("conditions", []),
    }

    # Validate fields
    is_valid, errors = validate_segment_rules(filter_rules)
    if not is_valid:
        yield _sse_event("error", {"message": f"Invalid segment fields: {errors}"})
        return

    # Evaluate segment size
    try:
        count, sample = await evaluate_segment(db, filter_rules)
    except Exception as e:
        yield _sse_event("error", {"message": f"Segment evaluation failed: {e}"})
        return

    yield _sse_event("step", {
        "step": 2,
        "type": "audience_result",
        "segment": {"name": suggested_name, "filter_rules": filter_rules},
        "count": count,
        "sample": sample,
        "reasoning": reasoning or f"Found {count} customers matching your goal criteria.",
    })

    # Step 3: Message generation
    yield _sse_event("step", {
        "step": 3,
        "type": "message_generating",
        "message": "Drafting personalized campaign message..."
    })

    segment_description = f"{suggested_name} ({count} customers)"
    synthesis_prompt = (
        f"Campaign goal: {goal}\n"
        f"Audience: {segment_description}\n"
        f"Audience filter: {json.dumps(filter_rules)}\n"
        f"Generate the campaign message and channel recommendation."
    )

    try:
        synthesis_raw = await call_llm(AGENT_SYNTHESIS_PROMPT, synthesis_prompt)
        synthesis = parse_json_response(synthesis_raw)
    except Exception as e:
        yield _sse_event("error", {"message": f"Message generation failed: {e}"})
        return

    message = synthesis.get("message_body", "")
    subject = synthesis.get("subject")
    channel = synthesis.get("channel_recommendation", "email")
    channel_reasoning = synthesis.get("channel_reasoning", "")

    yield _sse_event("step", {
        "step": 3,
        "type": "message_draft",
        "message": message,
        "subject": subject,
    })

    # Step 4: Channel recommendation
    yield _sse_event("step", {
        "step": 4,
        "type": "channel_recommendation",
        "channel": channel,
        "reasoning": channel_reasoning,
    })

    # Step 5: Campaign preview
    campaign_preview = {
        "name": f"{goal[:50]} Campaign",
        "segment_name": suggested_name,
        "filter_rules": filter_rules,
        "audience_count": count,
        "message": message,
        "subject": subject,
        "channel": channel,
    }

    yield _sse_event("step", {
        "step": 5,
        "type": "campaign_preview",
        "campaign": campaign_preview,
    })

    # Step 6: Await human confirmation
    yield _sse_event("awaiting_confirmation", {
        "message": f"Ready to launch campaign to {count} customers. Confirm to proceed.",
        "campaign": campaign_preview,
    })
