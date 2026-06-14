# Xeno AI-Native Mini CRM
## Engineering Implementation Plan

---

## 1. Product Positioning

**Chosen Vision:** AI Marketing Copilot + Agent

**Why this framing wins:**
- Directly satisfies "AI woven into the product, not bolted on"
- Agent mode satisfies the highest bar in the rubric ("true AI agent that takes a broad goal and executes end to end")
- Copilot mode satisfies the assisted-marketer use case as a fallback
- Two modes in one product demonstrates range without overbuilding

**Positioning Statement (for video intro):**

> "An AI-Native Marketing Copilot that helps brands identify the right audience, generate personalized campaigns, intelligently choose communication channels, execute outreach through a simulated messaging infrastructure, and analyze campaign performance through an event-driven architecture."

---

## 2. Core User Persona

**Marketing Manager** at a D2C brand (fashion / beauty / coffee)

| Goal | Pain Today |
|------|------------|
| Increase repeat purchases | Manual segmentation |
| Recover churned customers | Generic, one-size campaigns |
| Promote new launches | Channel guesswork |
| Improve campaign ROI | No closed-loop analytics |

---

## 3. Target Workflow

```
Current:
Customer Data → Manual Analysis → Manual Segments → Manual Copy → Manual Channel → Launch → Review

Target:
Goal → AI Analysis → AI Segments → AI Copy → AI Channel → Launch → Automated Analytics
```

---

## 4. Product Scope

### Included

#### Customer & Order Management
- Customer ingestion API + bulk CSV seeding
- Customer attributes: city, loyalty tier, total spend, last purchase date
- Order history: amount, timestamp, product category

#### Audience Segmentation
- Rule-based filter builder (UI)
- AI-assisted natural language → filter translation
- Manual override of AI-suggested segments
- Audience preview (estimated reach count before saving)

#### Campaign Management
- Create, review, launch, archive campaigns
- Audience preview before launch
- Per-campaign message + channel configuration

#### Channel Service (Separate Microservice)
- Receives: recipient, message, channel
- Simulates: delivered / failed / opened / read / clicked
- Sends async callbacks to CRM receipt endpoint
- Retry logic, idempotency keys, dead-letter queue

#### Analytics
- Campaign-level: Sent, Delivered, Failed, Opened, Clicked
- Rates: Delivery Rate, Open Rate, Click Rate
- Audience-level breakdown
- Real-time metric refresh (5s polling)

#### AI Copilot (Assisted Mode)
- Natural language audience builder
- Message generation (audience + goal → copy)
- Channel recommendation with explanation

#### AI Agent Mode
- Single goal input → full campaign pipeline
- Step-by-step reasoning visible to user
- Human-in-the-loop confirmation before launch

---

### Explicitly Excluded (and Why)

| Excluded | Reason |
|----------|--------|
| Real messaging providers | Assignment constraint; stubs are more interesting to evaluate |
| Full authentication system | Demo credentials sufficient; RBAC is not CRM scope |
| Multi-tenant / RBAC | Enterprise complexity outside assignment scope |
| Sales CRM / pipeline | Out of scope per assignment brief |
| Billing | Not relevant to the evaluation |
| Mobile app | Web-first is sufficient for evaluation |
| Lead management / ticketing | Explicitly excluded in assignment |

---

## 5. AI Capabilities (Detailed)

### AI-1: Natural Language Audience Builder
```
Input:  "Customers who spent over ₹5000 but haven't bought in 60 days"
Output: { total_spent: { gt: 5000 }, days_since_last_order: { gt: 60 } }
```
- Structured JSON output via LLM with a typed filter schema
- Validate and preview audience size before saving
- User can edit generated filters manually

### AI-2: Message Generation
```
Input:  segment_description + campaign_goal + brand_tone
Output: Subject line + body copy (WhatsApp / Email / SMS variants)
```
- System prompt encodes brand voice
- User can regenerate or edit inline
- Returns channel-appropriate copy per selected channel

### AI-3: Channel Recommendation
```
Input:  audience_profile + campaign_objective + historical_engagement
Output: Ranked channels with reasoning (e.g. WhatsApp > Email > SMS)
```
- LLM prompt includes channel characteristic context
- Returns human-readable explanation the marketer can read
- Marketer can override recommendation

### AI-4: Campaign Agent
```
User Input: "Recover inactive premium customers"

Agent Steps:
  1. Identify audience (NL → filter → SQL → customer list)
  2. Explain reasoning to user ("I found 843 customers who...")
  3. Draft message copy
  4. Recommend channel with justification
  5. Show campaign preview card
  6. Await user confirmation (human-in-the-loop)
  7. Launch campaign on approval
```
- Sequential LLM calls with state passed forward
- Each step rendered as a "thinking card" in the UI
- Streaming responses for perceived speed

---

## 6. System Architecture

```
┌────────────────────────────────────────────┐
│             Next.js Frontend               │
│  Dashboard | Segments | Campaigns | Agent  │
└──────────────────┬─────────────────────────┘
                   │ REST API
┌──────────────────▼─────────────────────────┐
│           FastAPI CRM Backend              │
│  Customers | Segments | Campaigns |        │
│  Analytics | AI Router | Receipt API       │
├────────────────────────────────────────────┤
│   PostgreSQL (primary)  │  Redis (queue)   │
│   Alembic migrations    │  Celery broker   │
└──────────────────┬─────────────────────────┘
                   │ HTTP /send
┌──────────────────▼─────────────────────────┐
│         Channel Service (FastAPI)          │
│   Delivery simulator + random outcomes     │
│   Async callback → CRM /receipt            │
└──────────────────┬─────────────────────────┘
                   │ LLM API calls
┌──────────────────▼─────────────────────────┐
│           OpenAI / Gemini                  │
└────────────────────────────────────────────┘
```

**Deployment:**
- CRM Backend → Railway service 1
- Channel Service → Railway service 2 (simulates true network boundary)
- Next.js Frontend → Vercel (or Railway service 3)
- PostgreSQL → Railway managed Postgres
- Redis → Railway managed Redis

---

## 7. Repository Structure

```
xeno-crm/
├── backend/                      # FastAPI CRM service
│   ├── app/
│   │   ├── api/                  # Route handlers (routers)
│   │   │   ├── customers.py
│   │   │   ├── orders.py
│   │   │   ├── segments.py
│   │   │   ├── campaigns.py
│   │   │   ├── analytics.py
│   │   │   ├── receipt.py        # Callback ingestion endpoint
│   │   │   └── ai.py             # All AI endpoints
│   │   ├── services/             # Business logic layer
│   │   │   ├── segment_engine.py
│   │   │   ├── campaign_service.py
│   │   │   ├── analytics_service.py
│   │   │   └── ai_service.py
│   │   ├── models/               # SQLAlchemy ORM models
│   │   ├── schemas/              # Pydantic request/response schemas
│   │   ├── ai/                   # LLM integration layer
│   │   │   ├── prompts.py        # All system prompts
│   │   │   ├── segment_ai.py
│   │   │   ├── message_ai.py
│   │   │   ├── channel_ai.py
│   │   │   └── agent.py          # Campaign agent orchestrator
│   │   ├── workers/              # Celery task definitions
│   │   │   └── campaign_tasks.py
│   │   └── core/
│   │       ├── config.py         # Settings / env vars
│   │       ├── database.py
│   │       └── celery_app.py
│   ├── migrations/               # Alembic migration files
│   ├── seed/
│   │   └── seed_data.py          # 500 customers, 2000 orders seeder
│   ├── requirements.txt
│   └── Dockerfile
├── channel-service/              # Stubbed channel microservice
│   ├── app/
│   │   ├── main.py
│   │   ├── simulator.py          # Delivery outcome simulator
│   │   └── callbacks.py          # Async CRM callback sender
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/                     # Next.js app
│   ├── app/
│   │   ├── dashboard/            # KPIs and overview
│   │   ├── customers/            # Customer table + import
│   │   ├── segments/             # Segment list + builder
│   │   ├── campaigns/            # Campaign list + builder + analytics
│   │   └── agent/                # AI Agent page
│   ├── components/
│   │   ├── ui/                   # Shared UI primitives
│   │   ├── segment-builder/      # Rule builder + NL input
│   │   ├── campaign-builder/     # Multi-step campaign creator
│   │   └── agent-chat/           # Step-reveal agent UX
│   └── lib/
│       └── api.ts                # API client
├── docs/
│   ├── architecture.png          # Architecture diagram image
│   └── ai-workflow.md            # AI usage during development log
├── docker-compose.yml            # Local dev: all services
├── .env.example
└── README.md
```

---

## 8. Data Model

```sql
-- customers
CREATE TABLE customers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(255) NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL,
  phone         VARCHAR(20),
  city          VARCHAR(100),
  loyalty_tier  VARCHAR(20) CHECK (loyalty_tier IN ('bronze','silver','gold','platinum')),
  total_spent   NUMERIC(12,2) DEFAULT 0,
  last_order_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- orders
CREATE TABLE orders (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id      UUID REFERENCES customers(id) ON DELETE CASCADE,
  amount           NUMERIC(10,2) NOT NULL,
  product_category VARCHAR(100),
  ordered_at       TIMESTAMPTZ NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- segments
CREATE TABLE segments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           VARCHAR(255) NOT NULL,
  filter_rules   JSONB NOT NULL,
  created_by_ai  BOOLEAN DEFAULT FALSE,
  nl_query       TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- campaigns
CREATE TABLE campaigns (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(255) NOT NULL,
  segment_id  UUID REFERENCES segments(id),
  message     TEXT NOT NULL,
  channel     VARCHAR(20) CHECK (channel IN ('whatsapp','email','sms','rcs')),
  status      VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft','launching','active','completed')),
  launched_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- comm_events
CREATE TABLE comm_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id      UUID REFERENCES campaigns(id),
  customer_id      UUID REFERENCES customers(id),
  channel          VARCHAR(20),
  status           VARCHAR(20) DEFAULT 'sent',
  idempotency_key  VARCHAR(255) UNIQUE NOT NULL,
  event_at         TIMESTAMPTZ DEFAULT NOW(),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- dlq_events (dead-letter queue for failed callbacks)
CREATE TABLE dlq_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payload     JSONB NOT NULL,
  error       TEXT,
  retry_count INT DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

**Idempotency Key Pattern:** `{campaign_id}:{customer_id}:{event_type}`

**Status State Machine:**
```
sent → delivered → opened → clicked
     ↘ failed
```
Backwards transitions are rejected at the receipt endpoint.

---

## 9. Channel Service — Callback Design (Critical)

This is explicitly evaluated for volume, ordering, retries, and failures.

### Send Flow
```
CRM launches campaign
→ Celery task fans out: one sub-task per recipient
→ Each sub-task POSTs to Channel Service /send
→ Channel Service schedules async callback (random 1–10s delay)
→ Channel Service POSTs to CRM /receipt with event payload
→ CRM upserts comm_events with idempotency check
→ CRM updates campaign aggregate metrics
```

### Delivery Outcome Simulation
```python
OUTCOME_PROBABILITIES = {
    "delivered": 0.70,
    "failed":    0.10,
    # After delivered:
    "opened":    0.50,  # 50% of delivered
    "clicked":   0.20,  # 20% of opened
}
```

### Retry Strategy
- Max retries: 3
- Backoff: exponential — 2s, 4s, 8s
- After 3 failures → write to `dlq_events` table

### Idempotency
- `comm_events.idempotency_key` has UNIQUE constraint
- Receipt endpoint uses `INSERT ... ON CONFLICT DO NOTHING`
- Prevents duplicate processing from retry storms

### Out-of-Order Handling
- All events timestamped by Channel Service
- Receipt endpoint enforces state machine transitions
- Invalid transitions (e.g. `clicked` before `delivered`) are logged and discarded

---

## 10. API Design

```
# Customer & Order Ingestion
POST   /api/customers
POST   /api/customers/bulk
POST   /api/orders

# Segments
POST   /api/segments
GET    /api/segments
GET    /api/segments/{id}
GET    /api/segments/{id}/preview      ← returns audience count + sample

# Campaigns
POST   /api/campaigns
GET    /api/campaigns
GET    /api/campaigns/{id}
POST   /api/campaigns/{id}/launch
GET    /api/campaigns/{id}/analytics

# Channel Receipt (called by Channel Service)
POST   /api/receipt

# Analytics
GET    /api/analytics/campaigns        ← aggregate stats

# AI Endpoints
POST   /api/ai/segment                 ← NL query → filter rules JSON
POST   /api/ai/message                 ← audience + goal → message copy
POST   /api/ai/channel                 ← audience profile → channel recommendation
POST   /api/ai/agent                   ← goal → full campaign pipeline (streaming SSE)
```

---

## 11. Frontend Screen Inventory

| Screen | Route | Purpose |
|--------|-------|---------|
| Dashboard | `/dashboard` | KPIs: total customers, active campaigns, avg open rate |
| Customers | `/customers` | Searchable table, import CSV button |
| Segments | `/segments` | List + create (rule builder tab + NL query tab) |
| Campaign Builder | `/campaigns/new` | Select segment → generate message → pick channel → preview → launch |
| Campaign Detail | `/campaigns/[id]` | Per-campaign analytics with live metric refresh (5s) |
| AI Agent | `/agent` | Goal input → step-by-step agent reasoning cards → confirmation → launch |

---

## 12. Demo Data Strategy

### Seed Script generates:
- **500 customers** with realistic Indian names, cities, loyalty tiers, spend history
- **2,000 orders** distributed across last 180 days, varied product categories
- **3 pre-built segments:** "High Value (Gold+)", "Churned (90d inactive)", "New Customers (30d)"
- **2 pre-launched campaigns** with complete simulated analytics (for immediate dashboard display)

### Demo Credentials (hardcoded, no real auth):
```
Email:    demo@xeno.ai
Password: demo123
```
Single middleware check. Returns a session token. No database users table needed.

---

## 13. Scale Assumptions

| Parameter | Assumed Value | Notes |
|-----------|--------------|-------|
| Customers | 100,000 | PostgreSQL handles comfortably |
| Orders | 1,000,000 | Indexed on customer_id, ordered_at |
| Campaign recipients (max) | 10,000 | Celery fan-out per campaign |
| Concurrent users | 100 | FastAPI async handles well |
| Callback volume (peak) | 10,000 events/campaign | Redis queue absorbs burst |
| Analytics query latency | < 500ms | Aggregate materialized per campaign |

### Horizontal Scale Path (Future)
- Celery workers are stateless → scale by adding worker replicas
- Redis queue absorbs burst load
- PostgreSQL read replica for analytics queries
- Current: single worker thread pool (acceptable for demo)

---

## 14. Tradeoffs (Explicit)

| Decision | Chosen | What We Gave Up |
|----------|--------|----------------|
| LLM for all AI features | OpenAI / Gemini API | Cost per call; fine-tuned model would be more accurate |
| Celery + Redis | Simple, well-known queue | Kafka would give ordering guarantees + durability |
| Hardcoded delivery rates | Fixed probability table | Dynamic rates per channel/time would be more realistic |
| Single-tenant architecture | Simplified auth | Not production-ready for multiple brands |
| 5s polling for analytics | Simple to implement | SSE or WebSockets would be more real-time |
| Sequential agent steps | Clearer UX reasoning flow | Parallel steps would be faster |
| Railway for deployment | Fast setup, managed infra | Less control than AWS/GCP |

---

## 15. AI-Native Development Documentation

The assignment evaluates *how AI was used while building*, not just AI in the product.

Maintain `docs/ai-workflow.md` capturing:
- Which modules were AI-scaffolded vs. hand-written
- Key prompts used for code generation
- Where AI output was reviewed, modified, or rejected
- Product decisions influenced by AI suggestion
- Mistakes caught during AI output review

This document is the foundation for the "AI-Native Workflow" segment of the walkthrough video.

---

## 16. Development Milestones

### Day 1 — Foundation
- PostgreSQL schema + Alembic migrations
- FastAPI app skeleton with all routers registered
- Customer + Order ingestion endpoints (POST /customers, /orders)
- Seed script: 500 customers, 2,000 orders
- Basic Next.js scaffold with routing

### Day 2 — Segmentation + Campaign Engine
- Rule-based segment evaluation (JSONB filter → SQL WHERE clause)
- Segment preview endpoint (audience count)
- Campaign creation + launch API
- Celery app setup with Redis broker
- Campaign fan-out task (one sub-task per recipient)

### Day 3 — Channel Service + Callbacks
- Channel service: `/send` endpoint
- Delivery outcome simulator (probability-weighted)
- Async callback to CRM `/receipt` with 1–10s delay
- Receipt endpoint with idempotency key check
- State machine transition enforcement
- Retry queue: 3× exponential backoff
- Dead-letter table for exhausted retries

### Day 4 — AI Features
- AI-1: NL segment builder (structured JSON output)
- AI-2: Message generation (channel-aware variants)
- AI-3: Channel recommendation with explanation
- AI-4: Campaign agent (sequential steps, streaming SSE)
- All prompts in `backend/app/ai/prompts.py`

### Day 5 — Frontend + Analytics
- All 6 screens implemented
- Campaign analytics with 5s polling refresh
- AI Agent page with step-reveal card UX
- Rule builder UI component
- Demo data seeding finalized and verified

### Day 6 — Deployment + Hardening
- Backend + Channel Service deployed to Railway
- Frontend deployed to Vercel
- PostgreSQL + Redis provisioned on Railway
- Environment variables configured in Railway dashboard
- End-to-end smoke test: seed → segment → campaign → analytics
- Demo credentials verified from public URL

### Day 7 — Video + Documentation
- Record 5–6 minute walkthrough video
- Finalize README with tradeoffs, omissions, setup instructions
- Finalize `docs/ai-workflow.md`
- Final submission: URL + GitHub + Video

---

## 17. Walkthrough Video Structure

| Segment | Duration | Content |
|---------|----------|---------|
| Product Intro | ~0:30 | What was built and why this vision was chosen |
| Functional Demo | ~1:30 | End-to-end: NL segment → AI message → launch → live analytics |
| Technical Architecture | ~1:00 | Diagram: two services, callback loop, Celery queue, retry design |
| Code Walkthrough | ~1:00 | Repo structure, key files, AI layer, idempotency implementation |
| AI-Native Workflow | ~1:00 | `ai-workflow.md` highlights: what AI built, what was directed/rejected |

---

## 18. README Requirements

```markdown
# Xeno AI-Native Mini CRM

## Live Demo
[URL] — Login: demo@xeno.ai / demo123

## What This Is
AI Marketing Copilot + Agent for D2C brands.

## Architecture
[architecture diagram image]

## Quick Start (Local)
docker-compose up --build
# Seeds demo data automatically on first run

## Tech Stack
- Backend: FastAPI + PostgreSQL + Redis + Celery
- Frontend: Next.js
- Channel Service: FastAPI (separate)
- AI: OpenAI GPT-4o / Gemini
- Deployment: Railway + Vercel

## Tradeoffs
[table]

## Conscious Omissions
[table]

## Scale Assumptions
[table]

## AI Development Workflow
See docs/ai-workflow.md
```

---

## 19. Future Scale Path

| Current | Production Path |
|---------|----------------|
| Celery + Redis | Apache Kafka — ordered, durable, replay-capable |
| Monolith CRM service | Domain microservices (segments, campaigns, analytics) |
| Single tenant | Multi-tenant with org isolation + RBAC |
| 5s polling analytics | Stream processing (Flink / ksqlDB) |
| Sequential agent steps | Agent orchestration framework (LangGraph / CrewAI) |
| Railway | AWS ECS / GKE for horizontal autoscaling |

---

## 20. Final Evaluation Alignment Check

| Rubric Item | How This Plan Addresses It |
|-------------|---------------------------|
| **Build & Deploy** | Railway + Vercel, public URL, demo credentials, docker-compose for local |
| **Creativity in Scoping** | Copilot + Agent dual mode; explicit inclusion/exclusion tables with rationale |
| **AI-Native Development** | 4 AI capabilities in product + `ai-workflow.md` documenting build process |
| **Code Quality** | Layered FastAPI (router → service → model), Pydantic schemas, Alembic migrations |
| **System Design** | Two-service event-driven architecture; retry/idempotency/DLQ explicitly designed |
| **Thought Clarity** | README tradeoff tables + video structure + explicit omissions |
