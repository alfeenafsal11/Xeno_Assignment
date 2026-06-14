#!/bin/sh

# Start channel-service on port 8001 in background
echo "Starting Channel Service on port 8001..."
cd /app/channel-service && uvicorn app.main:app --host 0.0.0.0 --port 8001 &

# Start Celery worker in background
echo "Starting Celery worker..."
cd /app && celery -A app.core.celery_app worker --loglevel=info -Q campaigns -P solo --concurrency=1 &

# Start backend CRM in foreground on $PORT
echo "Starting FastAPI Backend on port $PORT..."
cd /app && exec uvicorn app.main:app --host 0.0.0.0 --port $PORT
