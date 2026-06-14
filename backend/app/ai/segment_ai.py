"""AI-1: Natural Language Segment Builder."""
import logging
from fastapi import HTTPException

from app.ai.prompts import SEGMENT_SYSTEM_PROMPT
from app.ai.llm_client import call_llm, parse_json_response, validate_segment_rules

logger = logging.getLogger(__name__)

CORRECTION_PROMPT = (
    "The previous response contained invalid field names. "
    "Return ONLY valid JSON using ONLY these fields: "
    "total_spent, days_since_last_order, loyalty_tier, city, created_days_ago. "
    "No other fields allowed."
)


async def nl_to_segment(query: str) -> dict:
    """
    Convert natural language query to filter_rules JSON.
    Validates output against whitelist. Re-prompts once on invalid output.
    """
    try:
        raw = await call_llm(SEGMENT_SYSTEM_PROMPT, query)
        rules = parse_json_response(raw)
    except ValueError as e:
        raise HTTPException(502, f"LLM returned invalid JSON: {e}")

    is_valid, errors = validate_segment_rules(rules)

    if not is_valid:
        logger.warning(f"LLM returned invalid fields: {errors}. Re-prompting...")
        correction_query = f"{CORRECTION_PROMPT}\n\nOriginal request: {query}"
        try:
            raw2 = await call_llm(SEGMENT_SYSTEM_PROMPT, correction_query)
            rules = parse_json_response(raw2)
        except ValueError as e:
            raise HTTPException(502, f"LLM correction failed: {e}")

        is_valid2, errors2 = validate_segment_rules(rules)
        if not is_valid2:
            raise HTTPException(422, f"LLM returned invalid segment fields after correction: {errors2}")

    suggested_name = rules.pop("suggested_name", "AI Generated Segment")
    reasoning = rules.pop("reasoning", "")

    return {
        "filter_rules": {
            "operator": rules.get("operator", "AND"),
            "conditions": rules.get("conditions", []),
        },
        "suggested_name": suggested_name,
        "reasoning": reasoning,
    }
