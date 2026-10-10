"""Review routes. Task B3 in docs/BACKEND_TASKS.md implements:

- GET /api/cases/{id}/observations?status=
- PATCH /api/observations/{id}
- GET /api/cases/{id}/conflicts
- PATCH /api/conflicts/{id}
"""

from fastapi import APIRouter

router = APIRouter(tags=["review"])
