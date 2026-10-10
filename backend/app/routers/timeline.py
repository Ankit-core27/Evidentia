"""Timeline routes. Task B3 in docs/BACKEND_TASKS.md implements:

- GET, POST /api/cases/{id}/events?category=
- PATCH, DELETE /api/events/{id}
"""

from fastapi import APIRouter

router = APIRouter(tags=["timeline"])
