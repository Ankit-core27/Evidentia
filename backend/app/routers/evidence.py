"""Evidence routes. Task B2 in docs/BACKEND_TASKS.md implements:

- GET /api/evidence?q=&type=
- POST, GET /api/cases/{id}/evidence
- GET, PATCH /api/evidence/{id}
- GET /api/evidence/{id}/file
- POST /api/evidence/{id}/reprocess
- POST /api/evidence-links
- DELETE /api/evidence-links/{id}
- POST /api/cases/{id}/verify
"""

from fastapi import APIRouter

router = APIRouter(tags=["evidence"])
