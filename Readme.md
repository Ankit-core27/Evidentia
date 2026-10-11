# Evidentia

AI forensic investigation platform built for Hackinverse. [docs/PLAN.md](docs/PLAN.md) has the architecture and API contract; [docs/FRONTEND_TASKS.md](docs/FRONTEND_TASKS.md) and [docs/BACKEND_TASKS.md](docs/BACKEND_TASKS.md) split the work. Contributors and AI agents: read [AGENTS.md](AGENTS.md) first.

## Run it

Needs Node.js 20+ and Python 3.11+. Copy `.env.example` to `.env` at the repo root; the Gemini key is optional.

```sh
# Backend on http://localhost:8000 (API docs at /docs)
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\Activate.ps1
pip install -e ".[dev]"
alembic upgrade head               # creates storage/evidentia.db
python -m app.seed                 # loads the demo cases; --reset to start over
uvicorn app.main:app --reload --port 8000

# Frontend on http://localhost:3000, in a second terminal
cd frontend
npm install
npm run dev                        # or `npm run dev:mock` to run without the backend
```

Delete `storage/` to start from an empty database. Run the backend tests with `pytest` in `backend/`.
