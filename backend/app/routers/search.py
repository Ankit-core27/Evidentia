"""Search routes. Task A2 in docs/BACKEND_TASKS.md implements:

- POST /api/cases/{id}/ask
- GET /api/cases/{id}/search?q=
"""

from fastapi import APIRouter

router = APIRouter(tags=["search"])
