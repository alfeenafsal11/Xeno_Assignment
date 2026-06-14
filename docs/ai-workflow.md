# AI-Native Development Workflow

## How AI (Antigravity/Gemini) Was Used While Building

### Code Generation

| Module | What AI Generated | What Was Modified |
|--------|------------------|-------------------|
| Module 2 — Models | SQLAlchemy model scaffolding | Added UniqueConstraint + Index on comm_events idempotency_key |
| Module 4 — Segment Engine | JSONB→SQL translator skeleton | Added field whitelist validation to prevent SQL injection |
| Module 5 — Celery | Task signature + asyncio.run() bridge | Added retry logic and proper error propagation |
| Module 6 — Channel Service | Delivery simulator | Tuned probability weights (70/10/20 split) and backoff timing |
| Module 7 — Receipt | Idempotency check logic | Replaced check-then-insert with INSERT ON CONFLICT DO NOTHING to eliminate race condition |
| Module 9 — AI Features | LLM prompt drafts | Refined channel recommendation prompt with India-specific context; added re-prompt correction loop |
| Module 11 — Frontend | Next.js component structure | Rewrote analytics polling, SSE event stream handling, and agent step-reveal UX |

---

## Real Debugging Story — Issues Found in Smoke Testing

### Bug 1 — Gemini Model Name Mismatch (API 404)

**What happened:** The `/api/ai/segment` endpoint and AI agent SSE endpoint both returned 404 errors
from the Gemini API. The error message was: `models/gemini-1.5-pro is not found for API version v1beta`.

**Root cause:** The codebase was built referencing `gemini-1.5-pro` (the model name used during
initial development), but the API key provided only has access to `gemini-2.5-flash`. The model
name was hardcoded as the default in three places:
- `backend/app/core/config.py` → `LLM_MODEL: str = "gemini-1.5-pro"` (the Pydantic default)
- `backend/.env` → `LLM_MODEL=gemini-1.5-pro` (the runtime value)
- `.env.example` → `LLM_MODEL=gemini-1.5-pro` (the template)

**Fix applied:** Replaced all three with `gemini-2.5-flash`. The `llm_client.py` already correctly
read `settings.LLM_MODEL` dynamically — no change needed there.

**AI review note:** The diagnostic agent correctly identified this as a model availability issue
rather than an authentication issue. The API key was valid; only the model name was wrong.

---

### Bug 2 — Celery Worker Registered Zero Tasks

**What happened:** After launching a campaign, the Celery worker log showed the task being received
and queued, but the worker processed nothing. The channel service received zero `/send` calls.
Analytics stayed at all-zeros after 35 seconds.

**Root cause:** `celery_app.py` configured routing (`task_routes`) for `app.workers.*` but never
explicitly imported the task module. Without the import, Celery has no tasks to register in its
`[tasks]` table — they never get discovered.

Confirmed via worker startup log:
```
[tasks]
(empty)
```

**Fix applied:** Added one line to `backend/app/core/celery_app.py`:
```python
celery_app.conf.imports = ["app.workers.campaign_tasks"]
```

After fix, worker startup shows:
```
[tasks]
  . app.workers.campaign_tasks.send_campaign_to_recipients
```

**AI review note:** This is a subtle Celery configuration gotcha on Windows. The `autodiscover_tasks`
approach (which would have discovered tasks automatically) requires the app to be installed as a
package. The explicit `conf.imports` is the correct fix for a non-installed dev environment.

Also relevant: Celery's default pool (`prefork` via `billiard`) fails on Windows with
`OSError: [WinError 6] The handle is invalid`. The `-P solo` flag bypasses this by running tasks
in the main process, which works correctly for a dev/demo environment.

---

### Bug 3 — Frontend JSX Compile Error

**What happened:** `npm run dev` failed to compile `frontend/app/segments/page.tsx` with a
JSX parse error at line 351.

**Root cause:** The textarea placeholder attribute used single quotes as the JSX delimiter,
then tried to embed an apostrophe by escaping it with a backslash:

```tsx
placeholder='e.g. "Customers who haven\'t bought in 90 days"'
```

JSX does not support backslash-escaping inside attribute string literals. The `\'` caused
the parser to see the attribute as ending at the `\`, producing a malformed JSX token.

**Fix applied:** Changed the attribute delimiter to double quotes. The apostrophe in `haven't`
is then a plain character requiring no escaping:

```tsx
placeholder="e.g. \"Customers who haven't bought in 90 days\""
```

**AI review note:** This is a JSX-specific quirk — it differs from HTML (which allows `\'` in
single-quoted attributes) and from JavaScript template literals. The fix is trivial once
identified, but the error message (`Unexpected token`) doesn't point clearly to the cause.

---

### Bug 4 — segment_engine.py AttributeError on Non-Dict Conditions

**What happened:** If a client sent malformed filter rules where `conditions` contained non-dict
items (e.g., a list of strings instead of objects), `validate_filter_rules` would crash with:
`AttributeError: 'str' object has no attribute 'get'`

**Root cause:** The validation loop called `cond.get("field")` without first checking that `cond`
was actually a dict.

**Fix applied:** Added a type guard at the top of the loop:
```python
for cond in rules["conditions"]:
    if not isinstance(cond, dict):
        raise ValueError("Each condition must be an object with field, op, value")
    if cond.get("field") not in FIELD_MAP:
        ...
```

**AI review note:** This is a defensive programming fix. The LLM-generated filter rules are always
well-formed, but the API is public and any client could send malformed data. The `ValueError` is
caught by the API layer and returned as a 422 response.

---

## Smoke Test Results After All 4 Fixes

| Step | Test | Result |
|------|------|--------|
| A | POST /api/ai/segment — NL → filter rules | ✅ PASS — Gemini returned valid JSON with correct fields |
| B | POST /api/segments + GET /preview | ✅ PASS — Segment created, preview returned count=100 |
| C | POST /api/campaigns + POST /launch | ✅ PASS — Campaign launched to 100 recipients |
| D | Celery worker task registry | ✅ PASS — `[tasks]` shows `send_campaign_to_recipients` |
| E | Channel service /send calls | ✅ PASS — 100× HTTP 200 logged in worker |
| F | /api/campaigns/{id}/analytics | ✅ PASS — sent=100, delivered=76, failed=8, opened=8 |
| G | AI Agent SSE stream | ✅ PASS — All 5 steps streamed, campaign preview generated |

---

## Decisions Influenced by AI

- **INSERT ON CONFLICT DO NOTHING**: AI suggested this is safer than check-then-insert (avoids TOCTOU race condition under concurrent callbacks). Accepted.
- **Gemini markdown stripping**: AI noted that Gemini models frequently wrap JSON in code fences — added pre-processing to strip them before `json.loads()`.
- **Segment field whitelist**: AI correctly identified that directly interpolating user-provided field names into SQL is a SQL injection risk, even with a schema. Added explicit whitelist.

## Prompts That Worked Well

- **Segment system prompt**: Adding "Respond ONLY with valid JSON. No explanation. No markdown." dramatically reduced parse failures.
- **Channel recommendation context**: Providing explicit open rates (WhatsApp 85-90%, Email 20-25%) in the prompt produced more reasoned, contextually accurate recommendations.
- **Agent synthesis in one call**: Combining message generation + channel recommendation into a single LLM call (step 3/4) reduced latency while maintaining reasoning quality.

## Where AI Output Was Rejected

- **Alembic env.py**: AI initially generated a sync version. Rejected — the guide explicitly requires async engine. Rewrote using `async_engine_from_config`.
- **State machine in receipt endpoint**: AI initially used `if-elif` chain. Replaced with transition table (`VALID_TRANSITIONS` dict) for clarity and extensibility.
- **Celery task sync/async bridge**: AI initially proposed using `loop.run_until_complete()`. Rejected in favor of `asyncio.run()` which creates a fresh event loop per task (safer for Celery worker isolation).

## AI Integration in the Product

- **Segment NL Builder**: Gemini 2.5 Flash correctly interprets complex queries like "inactive premium customers who haven't bought in 90 days" → valid JSONB filter rules. Includes re-prompt fallback if invalid fields returned.
- **Message Generation**: Channel-aware prompting produces appropriately sized copy (160 chars for SMS, longer for email) with Indian D2C brand voice and `{name}` personalization.
- **Channel Recommendation**: India-specific context in prompt (WhatsApp penetration, tier-2 city SMS preference) produces recommendations that align with real D2C marketing practice.
- **Campaign Agent**: 5-step SSE streaming with human-in-the-loop confirmation. Each step's reasoning is visible, making the agent's logic transparent to the marketer.

## Known Limitations

- Gemini can occasionally return partial JSON on very large prompts — handled by the json parse → re-prompt correction loop.
- Agent steps are sequential (1 LLM call at a time) for clearer reasoning visibility, at the cost of slightly higher latency (~3-5s per step).
- Celery runs in `-P solo` mode on Windows (no multiprocessing pool). For production Linux deployment this is not needed — standard prefork pool works correctly.
