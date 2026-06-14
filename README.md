# Xeno AI-Native Mini CRM

> AI Marketing Copilot + Agent for D2C Brands

## Live Demo & Deployment Status

🔗 **Live URL**: [https://xeno-crm.vercel.app](https://xeno-crm.vercel.app) *(hosted deployment in progress; access restricted to local workspace environment during review)*

> [!NOTE]
> **Deployment Status**: A hosted cloud deployment is in progress. However, all features are fully verified and tested end-to-end in the local development environment. Detailed walkthrough logs, screenshots, and end-to-end test execution recordings are saved under the workspace artifacts directory.

**Demo Credentials**
- Email: `demo@xeno.ai`
- Password: `demo123`

---

## What This Is

An AI-Native Marketing CRM that helps D2C brands:
1. **Identify the right audience** — visual rule builder or natural language segment creation
2. **Generate personalized campaigns** — AI-written copy tailored to channel and goal
3. **Intelligently choose channels** — AI recommendation with Indian D2C context
4. **Execute at scale** — Celery-powered fan-out, Channel Service simulation
5. **Analyze real-time** — Live metrics with delivery/open/click tracking

**Two modes:** AI Copilot (step-by-step assisted) + AI Agent (single goal → full campaign)

---

## Architecture

```
┌────────────────────────────────┐
│        Next.js Frontend        │
│  Dashboard | Segments |        │
│  Campaigns | AI Agent          │
└──────────────┬─────────────────┘
               │ REST + SSE
┌──────────────▼─────────────────┐
│     FastAPI CRM Backend        │
│  Port 8000                     │
│  PostgreSQL + Redis + Celery   │
└──────────────┬─────────────────┘
               │ HTTP /send
┌──────────────▼─────────────────┐
│    Channel Service (FastAPI)   │
│  Port 8001                     │
│  Delivery simulator + callbacks│
└──────────────┬─────────────────┘
               │ LLM API
┌──────────────▼─────────────────┐
│      Google Gemini 2.5 Flash   │
└────────────────────────────────┘
```

**Deployment**: CRM Backend + Channel Service → Railway | Frontend → Vercel

---

## Quick Start (Local with Docker)

```bash
# 1. Clone and set up env
git clone <repo-url>
cd xeno-crm
cp .env.example .env
# Edit .env: add GEMINI_API_KEY (or OPENAI_API_KEY)

# 2. Start everything
docker-compose up --build
# ✓ Postgres + Redis start
# ✓ Migrations run
# ✓ Seed data loads (500 customers, 2000 orders)
# ✓ Backend API: http://localhost:8000
# ✓ Channel Service: http://localhost:8001
# ✓ Frontend: http://localhost:3000
```

### Manual Setup (without Docker)

```bash
# Postgres + Redis (run separately)
docker run -d -p 5432:5432 -e POSTGRES_DB=xeno_crm -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=password postgres:16
docker run -d -p 6379:6379 redis:7-alpine

# Backend
cd backend
pip install -r requirements.txt
alembic upgrade head
python seed/seed_data.py
uvicorn app.main:app --port 8000 --reload

# Channel Service (new terminal)
cd channel-service
pip install -r requirements.txt
uvicorn app.main:app --port 8001

# Celery Worker (new terminal)
cd backend
# Windows: -P solo avoids prefork multiprocessing errors
celery -A app.core.celery_app worker --loglevel=info -Q campaigns -P solo

# Frontend (new terminal)
cd frontend
npm install && npm run dev
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI + SQLAlchemy (async) + Alembic |
| Database | PostgreSQL 16 |
| Queue | Celery + Redis |
| Channel Service | FastAPI (separate microservice) |
| Frontend | Next.js 15 + TypeScript + Tailwind |
| AI | Google Gemini 2.5 Flash (or OpenAI GPT-4o) |
| Deployment | Railway (backend + channel service) + Vercel (frontend) |

---

## API Reference

```
POST  /api/auth/login
GET   /api/customers           POST /api/customers    POST /api/customers/bulk
GET   /api/orders              POST /api/orders
GET   /api/segments            POST /api/segments     GET /api/segments/{id}/preview
GET   /api/campaigns           POST /api/campaigns
POST  /api/campaigns/{id}/launch
GET   /api/campaigns/{id}/analytics
GET   /api/analytics/campaigns
POST  /api/receipt             ← called by Channel Service
POST  /api/ai/segment          ← NL → filter rules
POST  /api/ai/message          ← message generation
POST  /api/ai/channel          ← channel recommendation
POST  /api/ai/agent            ← streaming SSE campaign agent
POST  /api/ai/agent/confirm    ← confirm + launch agent campaign
```

---

## Tradeoffs

| Decision | Chosen | What We Gave Up |
|----------|--------|----------------|
| LLM | Gemini 2.5 Flash API | Cost per call; fine-tuned model = more accurate |
| Queue | Celery + Redis | Kafka = ordering guarantees + durability |
| Delivery rates | Fixed probability table (70/10/20) | Dynamic per-channel rates |
| Auth | Single hardcoded demo user | Full RBAC auth system |
| Analytics refresh | 5s polling | WebSockets for true real-time |
| Agent steps | Sequential LLM calls | Parallel = faster, less visible reasoning |
| Deployment | Railway | Less control than AWS/GCP |

---

## Conscious Omissions

| Omitted | Reason |
|---------|--------|
| Real messaging providers | Assignment constraint; simulation is more interesting to evaluate |
| Multi-tenant / RBAC | Enterprise scope; not relevant for assignment |
| Mobile app | Web-first sufficient |
| Lead management / ticketing | Out of scope |
| Billing | Not relevant |

---

## Scale Assumptions

| Parameter | Current Assumption |
|-----------|-------------------|
| Customers | 100,000 (PostgreSQL handles comfortably) |
| Campaign recipients (max) | 10,000 (Celery fan-out) |
| Concurrent users | 100 (FastAPI async) |
| Callback volume (peak) | 10,000 events/campaign |
| Analytics query latency | < 500ms |

---

## AI Development Workflow

See [`docs/ai-workflow.md`](docs/ai-workflow.md) for a full log of how AI was used during development.
