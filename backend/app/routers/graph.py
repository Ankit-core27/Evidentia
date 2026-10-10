"""Graph routes. Task B3 in docs/BACKEND_TASKS.md implements:

- GET /api/cases/{id}/graph
- POST /api/cases/{id}/relationships
- PATCH, DELETE /api/relationships/{id}
"""

from fastapi import APIRouter

router = APIRouter(tags=["graph"])
