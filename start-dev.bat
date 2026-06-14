@echo off
REM ============================================================
REM Xeno CRM Local Dev Quick Start (Windows)
REM ============================================================
REM Prerequisites:
REM   1. Docker Desktop running (for Postgres + Redis)
REM   2. Python 3.11+ installed
REM   3. Node.js 18+ installed
REM   4. .env file set up in backend/ with GEMINI_API_KEY
REM ============================================================

echo [1/6] Starting PostgreSQL and Redis...
docker run -d --name xeno-postgres -p 5432:5432 ^
  -e POSTGRES_DB=xeno_crm -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=password ^
  -v xeno_postgres_data:/var/lib/postgresql/data ^
  postgres:16-alpine 2>nul || echo Postgres already running

docker run -d --name xeno-redis -p 6379:6379 redis:7-alpine 2>nul || echo Redis already running

echo [2/6] Waiting for Postgres to be ready...
timeout /t 5 /nobreak > nul

echo [3/6] Running Alembic migrations...
cd backend
call .venv\Scripts\activate
alembic upgrade head

echo [4/6] Seeding demo data...
python seed/seed_data.py

echo [5/6] Starting backend services (uvicorn + celery + channel-service)...
REM Open separate terminals for each service
start "Xeno Backend" cmd /k "cd /d %~dp0backend && call .venv\Scripts\activate && uvicorn app.main:app --port 8000 --reload"
start "Xeno Celery" cmd /k "cd /d %~dp0backend && call .venv\Scripts\activate && celery -A app.core.celery_app worker --loglevel=info -Q campaigns -P solo"
start "Xeno Channel" cmd /k "cd /d %~dp0channel-service && python -m venv .venv && .venv\Scripts\pip install -r requirements.txt && .venv\Scripts\uvicorn app.main:app --port 8001"

echo [6/6] Starting frontend...
start "Xeno Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo ============================================================
echo All services starting in separate windows!
echo.
echo   Backend API:      http://localhost:8000
echo   API Docs:         http://localhost:8000/docs
echo   Channel Service:  http://localhost:8001
echo   Frontend:         http://localhost:3000
echo.
echo   Login: demo@xeno.ai / demo123
echo ============================================================
