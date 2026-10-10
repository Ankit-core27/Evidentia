"""Injuries routes. Task B4 in docs/BACKEND_TASKS.md implements:

- GET, POST /api/cases/{id}/injuries
- PATCH /api/injuries/{id}
"""

from fastapi import APIRouter

router = APIRouter(tags=["injuries"])
