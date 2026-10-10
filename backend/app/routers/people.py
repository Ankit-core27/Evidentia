"""People routes. Task B1 in docs/BACKEND_TASKS.md implements:

- GET, POST /api/cases/{id}/persons | objects | locations
- PATCH, DELETE /api/persons/{id} | objects/{id} | locations/{id}
"""

from fastapi import APIRouter

router = APIRouter(tags=["people"])
