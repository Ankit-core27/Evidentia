"""Reconstruction routes. Task B4 in docs/BACKEND_TASKS.md implements:

- GET, POST /api/cases/{id}/reconstructions
- GET /api/reconstructions/{id}
- POST /api/reconstructions/{id}/stages
- PUT /api/stages/{id}/scene-objects
- GET, POST /api/reconstructions/{id}/annotations
"""

from fastapi import APIRouter

router = APIRouter(tags=["reconstruction"])
