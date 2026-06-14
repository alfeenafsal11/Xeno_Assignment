# AGENT GUIDE — Xeno AI-Native Mini CRM
## Antigravity Agent Implementation Reference

> **CRITICAL INSTRUCTION:** Before writing any code, read this entire file and `IMPLEMENTATION_PLAN.md` fully. Every implementation decision must align with both documents. When in doubt, refer back here first.

---

## 0. How to Use This File

This document is your step-by-step mentor. It tells you:
1. **What to build** — in exact order
2. **How to authenticate** — every credential, env var, and secret
3. **How to verify** — acceptance test for each module
4. **What to do when things fail** — fallback and troubleshooting at each stage

Work through sections in order. Do not skip ahead. Each module depends on the previous one being verified working.

---

## 1. Environment & Credentials Setup

### 1.1 Required Environment Variables

Create a `.env` file at the repo root and a `.env` in `backend/` and `channel-service/`. Never commit these files.

```env
# ── Database ──────────────────────────────────────────────────────────
DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5432/xeno_crm
# For Railway production:
# DATABASE_URL=<Railway Postgres connection string — copy from Railway dashboard>

# ── Redis ─────────────────────────────────────────────────────────────
REDIS_URL=redis://localhost:6379/0
# For Railway production:
# REDIS_URL=<Railway Redis connection string>

# ── LLM (use ONE of these) ────────────────────────────────────────────
OPENAI_API_KEY=sk-...
# OR
GEMINI_API_KEY=AIza...

# Preferred model — use this exact string
LLM_MODEL=gpt-4o
# OR if using Gemini:
# LLM_MODEL=gemini-1.5-pro

# ── Channel Service ────────────────────────────────────────────────────
# URL of the running Channel Service (used by CRM backend to send messages)
CHANNEL_SERVICE_URL=http://localhost:8001
# Production:
# CHANNEL_SERVICE_URL=https://xeno-channel-service.railway.app

# ── CRM Receipt URL (used by Channel Service to send callbacks) ────────
CRM_RECEIPT_URL=http://localhost:8000/api/receipt
# Production:
# CRM_RECEIPT_URL=https://xeno-crm-backend.railway.app/api/receipt

# ── Demo Auth (no real auth system needed) ────────────────────────────
DEMO_EMAIL=demo@xeno.ai
DEMO_PASSWORD=demo123
DEMO_SECRET_KEY=xeno-demo-jwt-secret-change-in-prod

# ── App Settings ──────────────────────────────────────────────────────
ENVIRONMENT=development
# production | development
```

### 1.2 Railway Production Setup

When deploying, set all env vars in the Railway dashboard under each service's **Variables** tab. Do not use `.env` files in production.

Railway services to create:
1. `xeno-crm-backend` — FastAPI CRM (PORT=8000)
2. `xeno-channel-service` — FastAPI Channel Service (PORT=8001)
3. `xeno-postgres` — Railway managed PostgreSQL plugin
4. `xeno-redis` — Railway managed Redis plugin

After deploying, set `CHANNEL_SERVICE_URL` in `xeno-crm-backend` to the Railway URL of `xeno-channel-service`, and vice versa for `CRM_RECEIPT_URL`.

### 1.3 Vercel (Frontend)

Set these in Vercel project Settings → Environment Variables:
```env
NEXT_PUBLIC_API_URL=https://xeno-crm-backend.railway.app
```

### 1.4 Local Development (Docker Compose)

```yaml
# docker-compose.yml handles:
# - postgres on port 5432
# - redis on port 6379
# - backend on port 8000
# - channel-service on port 8001
# - frontend on port 3000
```

Run with: `docker-compose up --build`

---

## 2. Module 1 — Project Scaffold

### 2.1 What to Build
Initialize the repository structure exactly as specified in `IMPLEMENTATION_PLAN.md` Section 7.

### 2.2 Steps

```bash
# 1. Create repo root
mkdir xeno-crm && cd xeno-crm
git init

# 2. Backend scaffold
mkdir -p backend/app/{api,services,models,schemas,ai,workers,core}
mkdir -p backend/{migrations,seed}
touch backend/app/main.py
touch backend/app/core/{config.py,database.py,celery_app.py}
touch backend/requirements.txt
touch backend/Dockerfile

# 3. Channel service scaffold
mkdir -p channel-service/app
touch channel-service/app/{main.py,simulator.py,callbacks.py}
touch channel-service/requirements.txt
touch channel-service/Dockerfile

# 4. Frontend scaffold
npx create-next-app@latest frontend --typescript --tailwind --app --src-dir=false
cd frontend
npm install axios lucide-react

# 5. Root files
touch docker-compose.yml .env.example README.md
mkdir docs && touch docs/ai-workflow.md

# 6. Initial commit
git add . && git commit -m "chore: initial project scaffold"
```

### 2.3 Verification
- `ls -R` confirms all directories exist
- `git status` is clean after commit

### 2.4 Fallback / Troubleshooting
- If `create-next-app` fails: use `npx create-next-app@14` (pin version)
- If npm install fails: delete `node_modules`, clear npm cache with `npm cache clean --force`, retry

---

## 3. Module 2 — Backend Core (Config, Database, Models)

### 3.1 What to Build
FastAPI app with database connection, SQLAlchemy models, Alembic migrations, and Pydantic schemas.

### 3.2 Dependencies (`backend/requirements.txt`)
```
fastapi==0.111.0
uvicorn[standard]==0.29.0
sqlalchemy[asyncio]==2.0.30
asyncpg==0.29.0
alembic==1.13.1
pydantic==2.7.1
pydantic-settings==2.2.1
python-jose[cryptography]==3.3.0
python-multipart==0.0.9
celery==5.4.0
redis==5.0.4
httpx==0.27.0
openai==1.30.1
google-generativeai==0.7.2
faker==25.2.0
python-dotenv==1.0.1
psycopg2-binary==2.9.9
```

### 3.3 Key Files

**`backend/app/core/config.py`**
```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str
    REDIS_URL: str
    OPENAI_API_KEY: str = ""
    GEMINI_API_KEY: str = ""
    LLM_MODEL: str = "gpt-4o"
    CHANNEL_SERVICE_URL: str
    CRM_RECEIPT_URL: str
    DEMO_EMAIL: str = "demo@xeno.ai"
    DEMO_PASSWORD: str = "demo123"
    DEMO_SECRET_KEY: str = "xeno-demo-secret"
    ENVIRONMENT: str = "development"

    class Config:
        env_file = ".env"

settings = Settings()
```

**`backend/app/core/database.py`**
- Use `create_async_engine` with `asyncpg`
- Define `AsyncSessionLocal` and `get_db` dependency
- `Base = declarative_base()`

**`backend/app/models/`** — Create one file per table:
- `customer.py`, `order.py`, `segment.py`, `campaign.py`, `comm_event.py`, `dlq_event.py`
- All primary keys use `UUID` with `server_default=text("gen_random_uuid()")`
- `comm_events` has `UniqueConstraint("idempotency_key")`

**`backend/app/main.py`**
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import customers, orders, segments, campaigns, analytics, receipt, ai

app = FastAPI(title="Xeno CRM API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

app.include_router(customers.router, prefix="/api")
app.include_router(orders.router, prefix="/api")
app.include_router(segments.router, prefix="/api")
app.include_router(campaigns.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")
app.include_router(receipt.router, prefix="/api")
app.include_router(ai.router, prefix="/api")
```

### 3.4 Alembic Setup
```bash
cd backend
alembic init migrations
# Edit migrations/env.py:
# - Import Base from app.models
# - Set target_metadata = Base.metadata
# - Use async engine

alembic revision --autogenerate -m "initial schema"
alembic upgrade head
```

### 3.5 Verification
```bash
# Start the backend
uvicorn app.main:app --reload --port 8000

# Test health
curl http://localhost:8000/docs
# Should load FastAPI Swagger UI

# Test DB connection
curl http://localhost:8000/api/customers
# Should return empty list, not 500
```

### 3.6 Fallback / Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `asyncpg.exceptions.ConnectionRefusedError` | Postgres not running | `docker-compose up postgres` |
| `ModuleNotFoundError: app` | Wrong working directory | Run uvicorn from `backend/` directory |
| `alembic.util.exc.CommandError: Can't locate revision` | Migration conflict | `alembic stamp head`, then re-run `upgrade head` |
| `pydantic_core.ValidationError` on startup | Missing env var | Check `.env` exists and all required vars are set |
| UUID column errors on Postgres < 13 | Old Postgres | Add `CREATE EXTENSION IF NOT EXISTS "pgcrypto"` to migrations |

---

## 4. Module 3 — Customer & Order Ingestion

### 4.1 What to Build
POST endpoints for customer and order creation, plus bulk import and seed script.

### 4.2 Endpoints
```
POST /api/customers          — create one customer
POST /api/customers/bulk     — create many (accepts list)
GET  /api/customers          — list with pagination + search
POST /api/orders             — create one order
```

### 4.3 Seed Script (`backend/seed/seed_data.py`)
Use `Faker` with Indian locale:
```python
from faker import Faker
fake = Faker("en_IN")
```
Generate:
- 500 customers with realistic `total_spent` (₹500–₹50,000), `loyalty_tier` based on spend
- 2,000 orders distributed over 180 days with category variety
- After inserting all orders, run an UPDATE to compute `total_spent` and `last_order_at` per customer
- 3 pre-built segments (insert directly into segments table as JSON rules)
- 2 campaigns with status `completed` and pre-populated `comm_events`

Run with: `python seed/seed_data.py`

### 4.4 Verification
```bash
python seed/seed_data.py
# Should print: "Seeded 500 customers, 2000 orders"

curl http://localhost:8000/api/customers?limit=5
# Should return 5 customer objects with all fields
```

### 4.5 Fallback / Troubleshooting

| Error | Fix |
|-------|-----|
| `UniqueViolation` on email | Seed script ran twice — truncate tables first: `TRUNCATE customers CASCADE` |
| Seed takes > 60s | Use `execute_many` / bulk insert instead of loop |
| `Faker` locale error | `pip install Faker --upgrade` |

---

## 5. Module 4 — Segment Engine

### 5.1 What to Build
Rule-based segment evaluation — JSONB filter rules translated to SQL WHERE clause.

### 5.2 Filter Rule Schema (JSONB)
```json
{
  "operator": "AND",
  "conditions": [
    { "field": "total_spent", "op": "gt", "value": 5000 },
    { "field": "days_since_last_order", "op": "gt", "value": 60 },
    { "field": "loyalty_tier", "op": "in", "value": ["gold", "platinum"] }
  ]
}
```

### 5.3 Supported Fields
| Field | SQL Column / Expression |
|-------|------------------------|
| `total_spent` | `customers.total_spent` |
| `days_since_last_order` | `EXTRACT(DAY FROM NOW() - customers.last_order_at)` |
| `loyalty_tier` | `customers.loyalty_tier` |
| `city` | `customers.city` |
| `created_days_ago` | `EXTRACT(DAY FROM NOW() - customers.created_at)` |

### 5.4 Supported Operators
`gt`, `lt`, `gte`, `lte`, `eq`, `neq`, `in`, `not_in`

### 5.5 Segment Preview Endpoint
`GET /api/segments/{id}/preview` → returns `{ count: 843, sample: [...5 customers] }`

### 5.6 Verification
```bash
# Create segment
curl -X POST http://localhost:8000/api/segments \
  -H "Content-Type: application/json" \
  -d '{"name":"High Spenders","filter_rules":{"operator":"AND","conditions":[{"field":"total_spent","op":"gt","value":5000}]}}'

# Preview it
curl http://localhost:8000/api/segments/{id}/preview
# Should return count > 0
```

### 5.7 Fallback / Troubleshooting

| Error | Fix |
|-------|-----|
| `KeyError` on unknown field | Add field validation in `segment_engine.py` with a whitelist |
| Count returns 0 unexpectedly | Check `total_spent` was actually computed by seed script |
| SQL injection risk on dynamic fields | Always use whitelist — never interpolate user field names directly |

---

## 6. Module 5 — Campaign Engine + Celery

### 6.1 What to Build
Campaign CRUD, launch endpoint, and Celery fan-out task that calls Channel Service per recipient.

### 6.2 Campaign Launch Flow
```
POST /api/campaigns/{id}/launch
  → Set campaign.status = "launching"
  → Resolve segment → get customer list
  → Dispatch Celery task: send_campaign_to_recipients.delay(campaign_id, customer_ids)
  → Return 202 Accepted immediately

Celery task:
  → For each customer_id:
      POST channel-service/send { recipient, message, channel, campaign_id, customer_id }
      Create comm_event with status="sent", idempotency_key="{campaign_id}:{customer_id}:sent"
  → Set campaign.status = "active"
```

### 6.3 Celery Configuration (`backend/app/core/celery_app.py`)
```python
from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "xeno_crm",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)
celery_app.conf.task_routes = {"app.workers.*": {"queue": "campaigns"}}
```

Start worker: `celery -A app.core.celery_app worker --loglevel=info -Q campaigns`

### 6.4 Verification
```bash
# Launch a campaign
curl -X POST http://localhost:8000/api/campaigns/{id}/launch

# Check campaign status changed
curl http://localhost:8000/api/campaigns/{id}
# status should be "active"

# Check comm_events were created
# SELECT COUNT(*) FROM comm_events WHERE campaign_id = '{id}';
# Should equal number of customers in segment
```

### 6.5 Fallback / Troubleshooting

| Error | Fix |
|-------|-----|
| Celery task not executing | Check Redis is running; check worker is started |
| `kombu.exceptions.OperationalError` | Redis URL wrong or Redis not running |
| Tasks queued but not consumed | Worker is not connected to correct queue — check `-Q campaigns` flag |
| Channel Service connection refused | Channel Service not running — start it on port 8001 |

---

## 7. Module 6 — Channel Service

### 7.1 What to Build
Separate FastAPI service that accepts send requests and fires async delivery callbacks to CRM.

### 7.2 Channel Service Main Endpoints
```
POST /send     — receive message, schedule async callback
GET  /health   — health check
```

### 7.3 `channel-service/app/simulator.py`
```python
import random
import asyncio
import httpx

DELIVERY_OUTCOMES = ["delivered"] * 70 + ["failed"] * 10 + ["pending"] * 20

async def simulate_delivery(payload: dict, crm_receipt_url: str):
    await asyncio.sleep(random.uniform(1, 10))  # simulate network delay
    
    outcome = random.choice(DELIVERY_OUTCOMES)
    await send_callback(crm_receipt_url, payload, outcome)
    
    if outcome == "delivered":
        if random.random() < 0.50:  # 50% open rate
            await asyncio.sleep(random.uniform(5, 30))
            await send_callback(crm_receipt_url, payload, "opened")
            
            if random.random() < 0.20:  # 20% click rate
                await asyncio.sleep(random.uniform(2, 10))
                await send_callback(crm_receipt_url, payload, "clicked")

async def send_callback(url: str, payload: dict, status: str, retry=0):
    try:
        async with httpx.AsyncClient() as client:
            await client.post(url, json={
                "campaign_id": payload["campaign_id"],
                "customer_id": payload["customer_id"],
                "status": status,
                "channel": payload["channel"],
                "idempotency_key": f"{payload['campaign_id']}:{payload['customer_id']}:{status}"
            }, timeout=5.0)
    except Exception as e:
        if retry < 3:
            await asyncio.sleep(2 ** retry)  # exponential backoff: 1s, 2s, 4s
            await send_callback(url, payload, status, retry + 1)
        else:
            # Log to DLQ via separate endpoint or write to file
            print(f"DLQ: Failed after 3 retries — {payload} — {status} — {e}")
```

### 7.4 `channel-service/app/main.py`
```python
from fastapi import FastAPI, BackgroundTasks
from app.simulator import simulate_delivery
import os

app = FastAPI(title="Xeno Channel Service")
CRM_RECEIPT_URL = os.getenv("CRM_RECEIPT_URL", "http://localhost:8000/api/receipt")

@app.post("/send")
async def send_message(payload: dict, background_tasks: BackgroundTasks):
    background_tasks.add_task(simulate_delivery, payload, CRM_RECEIPT_URL)
    return {"status": "queued"}

@app.get("/health")
def health():
    return {"status": "ok"}
```

### 7.5 Verification
```bash
# Start channel service
cd channel-service
uvicorn app.main:app --port 8001

# Test send endpoint
curl -X POST http://localhost:8001/send \
  -H "Content-Type: application/json" \
  -d '{"campaign_id":"test","customer_id":"test","channel":"email","message":"Hi"}'
# Should return {"status": "queued"}

# Watch CRM receipt endpoint logs for incoming callbacks
# Should see callbacks arriving within 1-10 seconds
```

### 7.6 Fallback / Troubleshooting

| Error | Fix |
|-------|-----|
| Callbacks not reaching CRM | Check `CRM_RECEIPT_URL` env var is correct |
| `httpx.ConnectError` | CRM backend not running; check port 8000 |
| `asyncio` event loop errors | Use `asyncio.create_task` instead of `background_tasks` if issues arise |
| Port 8001 already in use | `lsof -i :8001` then kill the conflicting process |

---

## 8. Module 7 — Receipt Endpoint + State Machine

### 8.1 What to Build
`POST /api/receipt` — receives callbacks from Channel Service and updates `comm_events`.

### 8.2 State Machine
```
Valid transitions:
  sent      → delivered
  sent      → failed
  delivered → opened
  opened    → clicked

Invalid transitions are silently discarded (log them, don't error).
```

### 8.3 Receipt Logic
```python
@router.post("/receipt")
async def receive_callback(payload: ReceiptPayload, db: AsyncSession = Depends(get_db)):
    # 1. Idempotency check
    existing = await db.execute(
        select(CommEvent).where(CommEvent.idempotency_key == payload.idempotency_key)
    )
    if existing.scalar_one_or_none():
        return {"status": "duplicate_ignored"}
    
    # 2. Find the "sent" event to validate transition
    current = await get_current_status(db, payload.campaign_id, payload.customer_id)
    if not is_valid_transition(current, payload.status):
        return {"status": "invalid_transition_ignored"}
    
    # 3. Insert new event
    event = CommEvent(
        campaign_id=payload.campaign_id,
        customer_id=payload.customer_id,
        channel=payload.channel,
        status=payload.status,
        idempotency_key=payload.idempotency_key,
    )
    db.add(event)
    await db.commit()
    return {"status": "ok"}
```

### 8.4 Verification
```bash
# Launch a real campaign, then poll analytics
curl http://localhost:8000/api/campaigns/{id}/analytics
# delivered_count, failed_count, opened_count, clicked_count should increase over 10-30s

# Direct test of receipt idempotency
curl -X POST http://localhost:8000/api/receipt \
  -H "Content-Type: application/json" \
  -d '{"campaign_id":"x","customer_id":"y","status":"delivered","channel":"email","idempotency_key":"x:y:delivered"}'
# First call: {"status": "ok"}
# Second identical call: {"status": "duplicate_ignored"}
```

### 8.5 Fallback / Troubleshooting

| Error | Fix |
|-------|-----|
| `UniqueViolation` despite idempotency check | Race condition — use `INSERT ... ON CONFLICT DO NOTHING` instead of check-then-insert |
| Analytics not updating | Receipt endpoint returning errors — check logs |
| `422 Unprocessable Entity` on receipt | Pydantic schema mismatch — verify Channel Service payload matches `ReceiptPayload` schema |

---

## 9. Module 8 — Analytics

### 9.1 What to Build
Per-campaign analytics endpoint that aggregates `comm_events`.

### 9.2 Analytics Query
```sql
SELECT
  COUNT(*) FILTER (WHERE status = 'sent')      AS sent,
  COUNT(*) FILTER (WHERE status = 'delivered') AS delivered,
  COUNT(*) FILTER (WHERE status = 'failed')    AS failed,
  COUNT(*) FILTER (WHERE status = 'opened')    AS opened,
  COUNT(*) FILTER (WHERE status = 'clicked')   AS clicked
FROM comm_events
WHERE campaign_id = :campaign_id
```

### 9.3 Compute Rates in Service Layer
```python
delivery_rate = delivered / sent if sent > 0 else 0
open_rate = opened / delivered if delivered > 0 else 0
click_rate = clicked / opened if opened > 0 else 0
```

### 9.4 Verification
```bash
curl http://localhost:8000/api/campaigns/{id}/analytics
# Should return non-zero counts if campaign was launched
```

### 9.5 Fallback / Troubleshooting

| Error | Fix |
|-------|-----|
| All counts are 0 after launch | Check comm_events table is populated; check receipt endpoint is being called |
| Slow analytics query | Add index: `CREATE INDEX ON comm_events (campaign_id, status)` |

---

## 10. Module 9 — AI Features

### 10.1 General LLM Setup (`backend/app/ai/prompts.py`)

All system prompts live in one file. Never hardcode prompts inside endpoint handlers.

```python
SEGMENT_SYSTEM_PROMPT = """
You are an audience segmentation assistant for a D2C marketing CRM.
Convert natural language audience descriptions into structured JSON filter rules.

Respond ONLY with valid JSON. No explanation. No markdown. Just the JSON object.

Schema:
{
  "operator": "AND" | "OR",
  "conditions": [
    { "field": "<field_name>", "op": "<operator>", "value": <value> }
  ]
}

Valid fields: total_spent, days_since_last_order, loyalty_tier, city, created_days_ago
Valid operators: gt, lt, gte, lte, eq, neq, in, not_in
"""
```

### 10.2 AI-1: NL Segment Builder

**Endpoint:** `POST /api/ai/segment`
**Input:** `{ "query": "customers who spent over 5000 but haven't bought in 60 days" }`
**Output:** Filter rules JSON + segment name suggestion

**Implementation:**
```python
response = await openai_client.chat.completions.create(
    model=settings.LLM_MODEL,
    messages=[
        {"role": "system", "content": SEGMENT_SYSTEM_PROMPT},
        {"role": "user", "content": query}
    ],
    response_format={"type": "json_object"},
    temperature=0.1  # Low temp for structured output
)
rules = json.loads(response.choices[0].message.content)
```

**Validation:** After parsing JSON, validate all fields are in the whitelist. If invalid field returned, re-prompt once with correction instruction. If still invalid, return 422.

### 10.3 AI-2: Message Generation

**Endpoint:** `POST /api/ai/message`
**Input:** `{ "segment_description": "...", "goal": "win-back", "channel": "whatsapp" }`
**Output:** `{ "message": "...", "subject": "..." (if email) }`

**System prompt** encodes:
- Brand tone: friendly, professional, Indian D2C context
- Channel-specific length limits (WhatsApp: 160 chars body; Email: up to 300 words; SMS: 160 chars)
- Personalization placeholder: `{name}` for customer name

### 10.4 AI-3: Channel Recommendation

**Endpoint:** `POST /api/ai/channel`
**Input:** `{ "segment_description": "...", "goal": "...", "audience_size": 843 }`
**Output:** `{ "recommended": "whatsapp", "ranking": ["whatsapp", "email", "sms"], "reasoning": "..." }`

**System prompt** includes channel characteristics:
```
WhatsApp: high open rate (~90%), best for urgent/personal, works best < 5000 recipients
Email: best for detailed content, promotions, newsletters; lower open rate ~25%
SMS: highest deliverability, no internet required, best for simple alerts
RCS: rich media, Android-heavy India audience, lower penetration than WhatsApp
```

### 10.5 AI-4: Campaign Agent

**Endpoint:** `POST /api/ai/agent` (streaming SSE)
**Input:** `{ "goal": "Recover inactive premium customers" }`
**Output:** Server-Sent Events stream, one event per agent step

**Agent Steps & SSE Events:**
```
event: step
data: {"step": 1, "type": "audience_finding", "message": "Analyzing your goal..."}

event: step
data: {"step": 2, "type": "audience_result", "segment": {...}, "count": 843, "reasoning": "I found 843 gold/platinum customers who haven't purchased in 90+ days..."}

event: step
data: {"step": 3, "type": "message_draft", "message": "Hey {name}, we miss you!..."}

event: step
data: {"step": 4, "type": "channel_recommendation", "channel": "whatsapp", "reasoning": "..."}

event: step
data: {"step": 5, "type": "campaign_preview", "campaign": {...}}

event: awaiting_confirmation
data: {"message": "Ready to launch. Confirm?"}
```

After user sends `POST /api/ai/agent/confirm` with the campaign data → create and launch campaign.

**Implementation note:** Use FastAPI `StreamingResponse` with `text/event-stream` media type.

### 10.6 AI Error Handling

```python
try:
    response = await llm_call(...)
except openai.RateLimitError:
    # Retry after 60s or switch to Gemini
    raise HTTPException(429, "AI rate limit hit, try again in 60s")
except openai.APIError as e:
    raise HTTPException(502, f"AI service error: {str(e)}")
except json.JSONDecodeError:
    # LLM returned invalid JSON
    # Re-prompt once with: "Return ONLY valid JSON, nothing else."
    response = await llm_call_with_json_correction(...)
```

### 10.7 Verification
```bash
# Test NL segment
curl -X POST http://localhost:8000/api/ai/segment \
  -H "Content-Type: application/json" \
  -d '{"query": "customers who spent more than 5000 and are gold or platinum tier"}'
# Should return valid filter_rules JSON

# Test message generation
curl -X POST http://localhost:8000/api/ai/message \
  -H "Content-Type: application/json" \
  -d '{"segment_description":"inactive premium customers","goal":"win-back","channel":"whatsapp"}'
# Should return a reasonable WhatsApp message

# Test agent (use curl or SSE client)
curl -N http://localhost:8000/api/ai/agent \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"goal":"Recover inactive premium customers"}'
# Should stream step events
```

### 10.8 Fallback / Troubleshooting

| Error | Fix |
|-------|-----|
| `openai.AuthenticationError` | Check `OPENAI_API_KEY` in `.env` |
| `json.JSONDecodeError` on LLM response | Add `response_format={"type":"json_object"}` to OpenAI call |
| Agent SSE not streaming in browser | Ensure `Content-Type: text/event-stream` header is set; disable buffering in nginx |
| Gemini returns markdown-wrapped JSON | Strip ` ```json ` and ` ``` ` before parsing |
| LLM returns fields outside whitelist | Validate output against whitelist, re-prompt or strip invalid conditions |

---

## 11. Module 10 — Demo Auth Middleware

### 11.1 What to Build
Simple JWT-based demo auth. Single hardcoded user. No database.

### 11.2 Implementation

**`backend/app/api/auth.py`**
```python
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from app.core.config import settings

router = APIRouter()
security = HTTPBearer()

@router.post("/api/auth/login")
def login(email: str, password: str):
    if email != settings.DEMO_EMAIL or password != settings.DEMO_PASSWORD:
        raise HTTPException(401, "Invalid credentials")
    token = jwt.encode({"sub": email}, settings.DEMO_SECRET_KEY, algorithm="HS256")
    return {"access_token": token, "token_type": "bearer"}

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        jwt.decode(credentials.credentials, settings.DEMO_SECRET_KEY, algorithms=["HS256"])
        return "demo_user"
    except JWTError:
        raise HTTPException(401, "Invalid token")
```

Add `Depends(get_current_user)` to any protected endpoint.

For the demo, protect: campaign launch, AI endpoints. Leave GET endpoints public so evaluators can view data.

### 11.3 Verification
```bash
# Login
curl -X POST http://localhost:8000/api/auth/login \
  -d "email=demo@xeno.ai&password=demo123"
# Returns {"access_token": "..."}

# Use token
curl http://localhost:8000/api/campaigns \
  -H "Authorization: Bearer <token>"
```

---

## 12. Module 11 — Frontend Implementation

### 12.1 Build Order
Build pages in this order (each depends on the previous):
1. API client (`lib/api.ts`)
2. Dashboard page
3. Customers page
4. Segments page (rule builder + NL tab)
5. Campaign builder (multi-step)
6. Campaign detail with analytics
7. AI Agent page

### 12.2 API Client (`frontend/lib/api.ts`)
```typescript
const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const api = {
  get: (path: string) => fetch(`${BASE}${path}`).then(r => r.json()),
  post: (path: string, body: unknown) =>
    fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(r => r.json()),
};
```

### 12.3 Key UI/UX Requirements

**Dashboard:**
- KPI cards: Total Customers, Active Campaigns, Avg Delivery Rate, Avg Open Rate
- Recent campaigns list with status badges

**Segment Builder:**
- Two tabs: "Rule Builder" (visual) and "Ask AI" (NL input)
- Rule Builder: dropdown for field, operator, value input; AND/OR toggle
- After NL input: show generated rules, allow editing before saving
- Always show audience preview count before saving

**Campaign Builder (multi-step):**
- Step 1: Select/create segment
- Step 2: Review audience (count + sample names)
- Step 3: Write/generate message (Generate with AI button)
- Step 4: Select channel (with AI recommendation shown)
- Step 5: Preview card → Launch

**Campaign Analytics:**
- Live metrics (5s polling via `setInterval`)
- Progress bars for delivery/open/click rates
- Show "Analytics updating..." spinner while campaign is active

**AI Agent:**
- Single goal textarea at top
- Step cards appear one by one as SSE events arrive
- Each card shows step title + reasoning + result
- Final card: Campaign Preview with "Launch" button
- Loading spinner while agent is thinking between steps

### 12.4 Verification
```bash
cd frontend && npm run dev
# Open http://localhost:3000
# Navigate through all pages
# Launch a campaign end-to-end
# Verify analytics update in real-time
```

### 12.5 Fallback / Troubleshooting

| Error | Fix |
|-------|-----|
| CORS error in browser | Check FastAPI CORS middleware is set to `allow_origins=["*"]` |
| SSE not working in Next.js | Use native `EventSource` API, not fetch, for SSE |
| `fetch` returning HTML (nginx proxy issue) | Add `NEXT_PUBLIC_API_URL` correctly in Vercel env vars |
| Hydration mismatch errors | Wrap dynamic content in `useEffect` or use `"use client"` directive |

---

## 13. Module 12 — Deployment

### 13.1 Deployment Order
Deploy in this exact order — each step is blocked until the previous is confirmed.

```
1. PostgreSQL plugin on Railway
2. Redis plugin on Railway
3. Backend CRM service on Railway
4. Run Alembic migrations
5. Run seed script
6. Channel Service on Railway
7. Set cross-service env vars
8. Frontend on Vercel
9. End-to-end smoke test
```

### 13.2 Step-by-Step

**Step 1-2: Railway Plugins**
- Create new Railway project
- Add PostgreSQL plugin → copy `DATABASE_URL` from Railway dashboard
- Add Redis plugin → copy `REDIS_URL`

**Step 3: Backend CRM**
- Connect GitHub repo to Railway
- Set root directory: `backend/`
- Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Set all env vars from Section 1.1

**Step 4: Migrations (one-time)**
```bash
# SSH into Railway service or use Railway CLI
railway run alembic upgrade head
```

**Step 5: Seed Data**
```bash
railway run python seed/seed_data.py
```

**Step 6: Channel Service**
- Add new Railway service in same project
- Root directory: `channel-service/`
- Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Set `CRM_RECEIPT_URL` to backend Railway URL

**Step 7: Cross-service vars**
- In CRM backend service vars: set `CHANNEL_SERVICE_URL` to channel service Railway URL
- Redeploy CRM backend after setting this

**Step 8: Vercel Frontend**
- Import GitHub repo into Vercel
- Root directory: `frontend/`
- Framework: Next.js
- Set `NEXT_PUBLIC_API_URL` to CRM backend Railway URL

**Step 9: Smoke Test Checklist**
```
□ https://xeno-crm.vercel.app loads
□ Dashboard shows seeded customer count (500)
□ Segments page shows 3 pre-built segments
□ Create new segment with rule builder → preview shows count
□ Create campaign → launch it
□ Analytics page shows metrics updating within 30s
□ AI Segment NL query returns valid filters
□ AI Agent goal → campaign preview → launch works end-to-end
□ Login with demo@xeno.ai / demo123 works
```

### 13.3 Fallback / Troubleshooting

| Error | Fix |
|-------|-----|
| Railway build fails | Check `requirements.txt` has no git+ dependencies; pin all versions |
| `DATABASE_URL` asyncpg scheme error on Railway | Railway provides `postgresql://` URL; change to `postgresql+asyncpg://` |
| Celery worker not running on Railway | Add a separate Railway service for the Celery worker with start command: `celery -A app.core.celery_app worker --loglevel=info` |
| CORS errors in production | Ensure CORS middleware `allow_origins` includes Vercel domain |
| Cold start timeout | Railway free tier sleeps — use paid tier or configure always-on |

---

## 14. Module 13 — Docker Compose (Local Dev)

```yaml
version: "3.9"

services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: xeno_crm
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql+asyncpg://postgres:password@postgres:5432/xeno_crm
      REDIS_URL: redis://redis:6379/0
      CHANNEL_SERVICE_URL: http://channel-service:8001
      CRM_RECEIPT_URL: http://backend:8000/api/receipt
    env_file: .env
    depends_on:
      - postgres
      - redis
    command: >
      sh -c "alembic upgrade head &&
             python seed/seed_data.py &&
             uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

  celery-worker:
    build: ./backend
    environment:
      DATABASE_URL: postgresql+asyncpg://postgres:password@postgres:5432/xeno_crm
      REDIS_URL: redis://redis:6379/0
    env_file: .env
    depends_on:
      - postgres
      - redis
    command: celery -A app.core.celery_app worker --loglevel=info -Q campaigns

  channel-service:
    build: ./channel-service
    ports:
      - "8001:8001"
    environment:
      CRM_RECEIPT_URL: http://backend:8000/api/receipt
    command: uvicorn app.main:app --host 0.0.0.0 --port 8001

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:8000
    depends_on:
      - backend

volumes:
  postgres_data:
```

---

## 15. Quality Checklist (Before Submission)

### Code Quality
```
□ No hardcoded API keys anywhere in committed code
□ All business logic in services/, not in API handlers
□ All LLM prompts in ai/prompts.py, not scattered
□ Pydantic schemas for all request/response bodies
□ Async throughout (no sync DB calls in async handlers)
□ Error handling on all external calls (LLM, Channel Service)
□ Idempotency implemented and tested
□ State machine transitions enforced
```

### Product Quality
```
□ Dashboard loads with data on first visit (seeded)
□ NL segment builder works end-to-end
□ Campaign can be launched and analytics appear
□ AI Agent can take a goal and produce a launchable campaign
□ All 5 analytics metrics appear (sent/delivered/failed/opened/clicked)
□ Demo credentials work on public URL
```

### Documentation
```
□ README.md has: live URL, demo creds, architecture diagram, tradeoffs table, omissions table
□ docs/ai-workflow.md is filled in
□ .env.example has all required variables (no real values)
□ docker-compose.yml starts full local stack
```

---

## 16. `docs/ai-workflow.md` Template

Fill this in as you build. It is a required deliverable for the walkthrough video.

```markdown
# AI-Native Development Workflow

## How AI Was Used While Building

### Code Generation
- [Module] — What was prompted, what was generated, what was modified

### Decisions Influenced by AI
- [Decision] — What AI suggested, what was accepted/rejected and why

### Prompts That Worked Well
- [Prompt context] — Key insight or technique

### Where AI Output Was Rejected
- [Context] — What AI got wrong and what was done instead

### AI Integration in the Product
- Segment NL builder: [notes on quality of output]
- Message generation: [notes on quality]
- Channel recommendation: [notes]
- Campaign agent: [notes on agent flow quality]
```

---

## 17. Final Pre-Submission Checklist

```
□ Public URL is live and accessible without VPN
□ Demo credentials work: demo@xeno.ai / demo123
□ GitHub repository is public
□ Walkthrough video is recorded (5-6 min, matches structure in IMPLEMENTATION_PLAN.md Section 17)
□ README is complete
□ docs/ai-workflow.md is complete
□ All explicit tradeoffs are documented
□ All explicit omissions are documented with reasoning
□ docker-compose up --build works from clean clone
□ End-to-end flow works: seed → segment → campaign → analytics
□ AI Agent mode produces a complete campaign from a single goal
□ Submitted before 15 June 2026, 12:00 PM
```

---

> **Remember:** The evaluators will ask detailed questions about every line of code. If AI generated a module, you must be able to explain exactly how it works, why decisions were made, and what the tradeoffs are. Own every line.
