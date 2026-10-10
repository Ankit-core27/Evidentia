from typing import Any

from app.schemas.common import OrmModel


class Building(OrmModel):
    """GET /api/buildings/{id} (M6, M7)."""

    id: int
    geo_building_id: str | None
    name: str
    model_url: str | None
    floors: list[Any] | dict[str, Any]
    description: str
