# Multi-stage Dockerfile for AgentCourt

# Stage 1: Build frontend
FROM node:20-slim AS frontend-builder
WORKDIR /app/web
COPY web/package*.json ./
RUN npm install
COPY web/ ./
RUN npm run build

# Stage 2: Python Backend runtime
FROM python:3.12-slim AS runner
WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app/backend:/app \
    PORT=8000 \
    HOST=0.0.0.0

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r ./backend/requirements.txt

# Copy source code and built frontend
COPY backend/ ./backend/
COPY data/ ./data/
COPY scripts/ ./scripts/
COPY eval/ ./eval/
COPY --from=frontend-builder /app/web/dist ./web/dist

EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD sh -c "curl -f http://localhost:${PORT:-8000}/healthz || exit 1"

CMD ["sh", "-c", "python -m uvicorn backend.agentcourt.api.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
