"""LLM client factory — supports OpenAI and Google Gemini."""
import json
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)

# Valid fields whitelist for segment validation
VALID_FIELDS = {"total_spent", "days_since_last_order", "loyalty_tier", "city", "created_days_ago"}
VALID_OPS = {"gt", "lt", "gte", "lte", "eq", "neq", "in", "not_in"}


async def call_llm(system_prompt: str, user_message: str, expect_json: bool = True) -> str:
    """
    Unified LLM call. Uses Gemini if GEMINI_API_KEY is set, else OpenAI.
    Returns the raw response text.
    """
    if settings.GEMINI_API_KEY:
        return await _call_gemini(system_prompt, user_message)
    elif settings.OPENAI_API_KEY:
        return await _call_openai(system_prompt, user_message)
    else:
        raise ValueError("No LLM API key configured. Set GEMINI_API_KEY or OPENAI_API_KEY in .env")


async def _call_gemini(system_prompt: str, user_message: str) -> str:
    """Call Google Gemini API."""
    import google.generativeai as genai
    genai.configure(api_key=settings.GEMINI_API_KEY)
    model = genai.GenerativeModel(
        model_name=settings.LLM_MODEL,
        system_instruction=system_prompt,
    )
    response = model.generate_content(user_message)
    text = response.text.strip()
    # Strip markdown code fences if Gemini wraps JSON in them
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1])
    return text


async def _call_openai(system_prompt: str, user_message: str) -> str:
    """Call OpenAI API."""
    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    response = await client.chat.completions.create(
        model=settings.LLM_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
        response_format={"type": "json_object"},
        temperature=0.2,
    )
    return response.choices[0].message.content


def parse_json_response(text: str) -> dict:
    """Parse JSON from LLM response, handling common formatting issues."""
    text = text.strip()
    # Remove markdown code fences
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1]).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse LLM JSON: {text[:200]}")
        raise ValueError(f"LLM returned invalid JSON: {e}")


def validate_segment_rules(rules: dict) -> tuple[bool, list[str]]:
    """
    Validate that all fields and operators in filter_rules are in the whitelist.
    Returns (is_valid, list_of_errors).
    """
    errors = []
    if "conditions" not in rules:
        return False, ["Missing 'conditions' key"]
    for i, cond in enumerate(rules["conditions"]):
        if cond.get("field") not in VALID_FIELDS:
            errors.append(f"Condition {i}: invalid field '{cond.get('field')}'")
        if cond.get("op") not in VALID_OPS:
            errors.append(f"Condition {i}: invalid operator '{cond.get('op')}'")
    return len(errors) == 0, errors
