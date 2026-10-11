# Evidentia

Evidentia is an AI forensic investigation platform, built for the Hackinverse hackathon. An investigator opens a case, uploads its evidence and gets back a structured, source-linked record of what happened:

- Every file is stored with its SHA-256 hash and a chain-of-custody log.
- Gemini reads the evidence and proposes the people, vehicles, places, events and statements in it. Each proposal keeps the passage it came from and waits for an investigator to confirm or reject it.
- Conflicting statements are flagged for review.
- The case can be explored as a relationship graph, a timeline, a 3D reconstruction with competing scenarios, a geographic view and an anatomy view of the injuries.
- Questions about the evidence are answered with citations, and the case can be exported as a report.

Every view reads the same case records, so the graph, the timeline, the 3D scene and the report all point back to the same evidence.

> Evidentia reports what the evidence says and where accounts differ. It does not decide guilt, and its AI output is a proposal until an investigator confirms it.

## Features

| Area | What it does |
| --- | --- |
| Cases | Create and manage cases, assign investigators, track status and priority |
| Evidence | Upload documents, statements, photos, audio and video; preview originals; SHA-256 hashes and integrity checks |
| Chain of custody | Every item's custodian and an append-only history of its registration, handovers (accepted by the recipient), analyses and integrity checks |
| AI review | Text extraction, OCR and transcription; proposed records with their source passages, queued for review; conflicting statements |
| Ask the evidence | Case-scoped questions answered from the evidence, with cited passages |
| Canvas | Relationship graph of persons, vehicles, places and evidence |
| Timeline | Events with time ranges, precision and certainty, each linked to its source |
| Reconstruction | Competing scenarios, stage by stage, in a navigable 3D scene with a time slider, measurements, notes and saved views |
| Area and buildings | The incident in its real surroundings as photorealistic 3D (Google Photorealistic 3D Tiles in CesiumJS), with building inspection |
| Autopsy and medical | Injuries placed on a 3D anatomy model |
| Reports | A summary report assembled from the case records, with its hash |
| Dashboard | Case counts, review queue, storage, incident map on satellite or street tiles, alerts |

## Demo data

`python -m app.seed` loads five cases. The most complete is **FX-2026-0005, the red-light collision at Sahyadri Chowk**. It is built from the 13 evidence files in [docs/demo-case](docs/demo-case/README.md), with its records, conflicts, injuries, two competing reconstructions and a report already in place. Mock mode (`npm run dev:mock`) shows the same five cases without the backend; after changing `backend/app/seed_sahyadri.py`, regenerate its copy with `python scripts/export_mock_case.py` in `backend/`. All names, numbers and registrations in the demo data are invented.

## Run it

Needs Node.js 20 or later and Python 3.11 or later. Copy `.env.example` to `.env` at the repo root. The Gemini key is optional: without it, uploads are stored, hashed and searchable, but AI extraction and answers are off.

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

Delete `storage/` to start from an empty database.

### Configuration

All settings live in the root `.env` (see [.env.example](.env.example)):

| Variable | Used for |
| --- | --- |
| `DATABASE_URL` | SQLite database; defaults to `storage/evidentia.db` |
| `STORAGE_DIR` | Where uploaded originals are kept |
| `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_EMBED_MODEL` | AI extraction, OCR, transcription, embeddings and answers |
| `VITE_GOOGLE_MAPS_API_KEY` or `VITE_CESIUM_ION_TOKEN` | Optional. Either one turns the "Area & buildings" view into Google Photorealistic 3D Tiles, the textured 3D city of Google Earth. The Google key needs the Map Tiles API enabled; an ion token is free at [ion.cesium.com](https://ion.cesium.com/tokens). Without either, the view uses flat Esri satellite imagery |

The maps need no key: the dashboard uses Esri World Imagery (satellite) or OpenStreetMap tiles, credited on the map.

## Tests and checks

```sh
cd backend && pytest                       # API, pipeline, seed and reconstruction tests
cd frontend && npm run lint && npm run build
```

## Project layout

```text
backend/     FastAPI app, SQLAlchemy models, Alembic migrations, AI pipeline, seed data and tests
frontend/    React 19 + Vite app; one feature folder per workspace module
assets/      3D models, textures and scene layouts, served by the frontend
packages/    Standalone scene engine and planner packages (not used by the app)
docs/        Plan, task lists and the demo case
```

## Documentation

- [docs/PLAN.md](docs/PLAN.md): architecture, data model, API contract and milestones
- [docs/demo-case/README.md](docs/demo-case/README.md): the Sahyadri Chowk case and a run-through
- [docs/BACKEND_TASKS.md](docs/BACKEND_TASKS.md), [docs/FRONTEND_TASKS.md](docs/FRONTEND_TASKS.md), [docs/M5_ANATOMY.md](docs/M5_ANATOMY.md): task breakdowns
- [CONTRIBUTING.md](CONTRIBUTING.md) and [AGENTS.md](AGENTS.md): how to work in this repo, for people and AI agents
- [SECURITY.md](SECURITY.md): reporting a vulnerability, and handling real evidence
- [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md): licences of the assets, map tiles and key dependencies

## Licence

Evidentia's source code is released under the [MIT Licence](LICENSE). Bundled assets and some dependencies have their own licences; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
