"""Cases routes. Task B1 in docs/BACKEND_TASKS.md implements:

- GET /api/investigators
- GET, POST /api/cases?q=&status=&priority=
- GET, PATCH /api/cases/{id}
- GET /api/cases/{id}/workspace
"""

from fastapi import APIRouter

router = APIRouter(tags=["cases"])
