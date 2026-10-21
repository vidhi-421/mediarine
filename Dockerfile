# Multi-stage build: Frontend + Backend unified image
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM python:3.11-slim
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r ./backend/requirements.txt

COPY backend/ ./backend/
COPY --from=frontend-builder /app/dist ./dist

EXPOSE 8000
ENV PORT=8000
CMD python -m uvicorn backend.main:app --host 0.0.0.0 --port $PORT
