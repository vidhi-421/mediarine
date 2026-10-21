# Medarina — Healthcare Claims Investigation Platform

## Architecture

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite 8 + Tailwind CSS v4 |
| Backend | Python 3.13, FastAPI, Pydantic v2 |
| Database | Supabase PostgreSQL (in-memory fallback for dev) |
| AI | Google Gemini 1.5 Flash (free tier) |
| Evidence | TinyFish live-web retrieval (server-side proxy) |

---

## Quick Start (Windows PowerShell)

### 1 — Prerequisites

- Python 3.13 installed (`py --version`)
- Node.js 20+ and pnpm installed (`pnpm --version`)

### 2 — Configure environment

```powershell
# From the project root:
Copy-Item backend\.env.example backend\.env
# Open backend\.env in an editor and fill in credentials (see below)
notepad backend\.env
```

### 3 — Install dependencies

```powershell
# Backend
py -m pip install -r backend\requirements.txt

# Frontend (already in place via Figma Make)
pnpm install
```

### 4 — Apply database schema (Supabase only)

1. Open [supabase.com](https://supabase.com) → Your project → SQL Editor
2. Paste and run the contents of `backend\migrations\001_initial_schema.sql`

> Skip this step if you want to run with the in-memory store (no Supabase credentials needed).

### 5 — Start the backend

```powershell
# Option A — from the backend/ directory (recommended):
Set-Location backend
py -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# Option B — from the project root:
py -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

Backend API docs: http://localhost:8000/docs

### 6 — Start the frontend

```powershell
# From the project root (new PowerShell window):
pnpm dev
```

Frontend: http://localhost:5173 (or the port Vite selects)

### 7 — Frontend Integration & Backend Connection

The frontend connects directly to the FastAPI backend at `VITE_API_URL` (configured in `.env`, default: `http://localhost:8000`).
- Investigations, evidence, status updates, and saved reports persist directly to the backend.
- If the backend is unreachable, the frontend gracefully falls back to local browser demo mode with a clear visual notice and a one-click retry button.
- Check backend connectivity and service statuses anytime under **Settings → FastAPI Backend Service**.

---

## Environment Variables (`backend\.env`)

| Variable | Description | Required |
|---|---|---|
| `SUPABASE_URL` | Supabase project URL | Optional (in-memory fallback) |
| `SUPABASE_SERVICE_KEY` | Service-role key — server-side only | Optional |
| `GEMINI_API_KEY` | Google AI Studio key | Optional (rule-based fallback) |
| `GEMINI_MODEL` | Gemini model name (default: `gemini-1.5-flash`) | No |
| `TINYFISH_ENDPOINT` | TinyFish retrieval endpoint | Optional |
| `TINYFISH_API_KEY` | TinyFish API key | Optional |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins | No |
| `PORT` | Server port (default: 8000) | No |

---

## Backend API Reference

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `GET` | `/api/investigations` | List investigations (filter, search, paginate) |
| `POST` | `/api/investigations` | Create investigation |
| `GET` | `/api/investigations/{id}` | Get single investigation |
| `PATCH` | `/api/investigations/{id}` | Update investigation (any fields) |
| `DELETE` | `/api/investigations/{id}` | Delete investigation |
| `POST` | `/api/investigations/{id}/evidence` | Add evidence manually |
| `POST` | `/api/investigations/{id}/retrieve` | Trigger TinyFish retrieval |
| `POST` | `/api/investigations/{id}/analyse` | Run Gemini AI analysis |
| `POST` | `/api/investigations/{id}/reports` | Save point-in-time report |
| `GET` | `/api/investigations/{id}/reports` | List reports for an investigation |
| `GET` | `/api/reports` | List all saved reports |
| `GET` | `/api/reports/{id}` | Get single report |
| `POST` | `/api/tinyfish/test` | Test TinyFish connection |
| `POST` | `/api/tinyfish/retrieve` | TinyFish proxy (frontend retrieval endpoint) |

Interactive API docs: **http://localhost:8000/docs**

---

## Running Tests

```powershell
py -m pytest backend\tests\ -v
```

All 17 tests run without any external services (uses in-memory store).

---

## Connecting TinyFish via the Backend Proxy

The safest way to use TinyFish is to point the frontend's **Settings → Service endpoint URL** to the backend proxy:

```
http://localhost:8000/api/tinyfish/retrieve
```

This keeps your TinyFish API key in `backend\.env` — never in the browser.

---

## AI Integration (Gemini)

Add your free Gemini API key to `backend\.env`:

```
GEMINI_API_KEY=your-key-here
```

The backend then:
1. Generates claim-specific verification questions on `/api/investigations/{id}/analyse`
2. Analyses retrieved evidence and produces explainable findings
3. Falls back to deterministic rule-based logic if the key is not configured

Gemini **never fabricates URLs, declares fraud, or assigns probability scores.**

---

## Database (Supabase)

The schema creates two tables:
- `investigations` — all claim fields, evidence (JSONB), risk indicators
- `saved_reports` — point-in-time snapshots linked to investigations

Row-Level Security is enabled; the service-role key bypasses it for server access.

Free-tier Supabase limits: 500 MB database, 50 000 rows, 2 GB storage.

---

## File Structure

```
Medarina Healthcare Platform Redesign/
├── src/                    # Frontend (React + Vite, unchanged)
│   ├── lib/
│   │   ├── api.ts          # NEW — typed client for the FastAPI backend
│   │   ├── store.ts        # Original localStorage store (unchanged)
│   │   └── tinyfish.ts     # Original frontend TinyFish client (unchanged)
│   └── pages/              # All pages unchanged
├── backend/
│   ├── main.py             # FastAPI app + all endpoints
│   ├── models.py           # Pydantic models (mirrors store.ts)
│   ├── database.py         # Supabase / in-memory data layer
│   ├── gemini_service.py   # Gemini AI integration
│   ├── tinyfish_service.py # TinyFish server-side proxy
│   ├── requirements.txt
│   ├── .env.example        # Template — copy to .env and fill in
│   ├── migrations/
│   │   └── 001_initial_schema.sql
│   └── tests/
│       └── test_api.py     # 17 pytest tests
└── README.md
```

---

## Remaining Setup (requires credentials)

| Feature | What to do |
|---|---|
| Persistent database | Set `SUPABASE_URL` + `SUPABASE_SERVICE_KEY`, run SQL migration |
| AI analysis | Set `GEMINI_API_KEY` in `backend\.env` |
| Live evidence retrieval | Set `TINYFISH_ENDPOINT` + `TINYFISH_API_KEY` |
| Frontend → backend | Set `VITE_API_URL=http://localhost:8000` in `.env.local` |

> All credentials are free-tier where available. No paid plan is required to run Medarina.
