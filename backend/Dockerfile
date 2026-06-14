FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies from backend
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source code to /app
COPY backend/ .

# Copy channel-service source code to /app/channel-service
COPY channel-service/ ./channel-service/

# Make start script executable
RUN chmod +x /app/start.sh

EXPOSE 8000
EXPOSE 8001

CMD ["/app/start.sh"]
