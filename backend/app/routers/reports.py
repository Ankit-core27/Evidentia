"""Reports routes. Task B5 in docs/BACKEND_TASKS.md implements:

- POST /api/cases/{id}/reports
- GET /api/cases/{id}/reports
- GET /api/reports/{id}
- GET /api/cases/{id}/audit
"""

from fastapi import APIRouter

router = APIRouter(tags=["reports"])
