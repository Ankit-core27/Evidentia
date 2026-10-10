"""Buildings routes (task B4 in docs/BACKEND_TASKS.md):

- GET /api/buildings/{id}

No route creates buildings yet; M6 adds them.
"""

from fastapi import APIRouter

from app.core.deps import DbSession
from app.core.records import get_or_404
from app.models import Building
from app.schemas.buildings import Building as BuildingOut

router = APIRouter(tags=["buildings"])


@router.get("/buildings/{building_id}", response_model=BuildingOut)
def get_building(building_id: int, db: DbSession):
    return get_or_404(db, Building, building_id)
