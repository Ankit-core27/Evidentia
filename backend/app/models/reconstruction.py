from sqlalchemy import JSON, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Reconstruction(Base):
    """One scenario of what may have happened, such as "van ran the red"."""

    __tablename__ = "reconstructions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    case_id: Mapped[int] = mapped_column(ForeignKey("cases.id", ondelete="CASCADE"), index=True)
    scenario: Mapped[str] = mapped_column(String(300))
    version: Mapped[int] = mapped_column(Integer, default=1)
    assumptions: Mapped[str] = mapped_column(Text, default="")
    # Authored layout under assets/3d/crime-scenes/scenes/.
    scene_file: Mapped[str | None] = mapped_column(String(300))


class ReconstructionStage(Base):
    __tablename__ = "reconstruction_stages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    reconstruction_id: Mapped[int] = mapped_column(ForeignKey("reconstructions.id", ondelete="CASCADE"), index=True)
    stage_order: Mapped[int] = mapped_column(Integer, default=0)
    label: Mapped[str] = mapped_column(String(200))
    event_ids: Mapped[list[int]] = mapped_column(JSON, default=list)


class SceneObject(Base):
    """A placed model at one stage. Transforms are in metres and radians."""

    __tablename__ = "scene_objects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    stage_id: Mapped[int] = mapped_column(ForeignKey("reconstruction_stages.id", ondelete="CASCADE"), index=True)
    # Model in the GLB library, such as "hatchback".
    model_id: Mapped[str] = mapped_column(String(100))
    # The vehicle or item record this model stands for.
    object_id: Mapped[int | None] = mapped_column(ForeignKey("objects.id", ondelete="SET NULL"))
    label: Mapped[str] = mapped_column(String(200), default="")
    position: Mapped[list[float]] = mapped_column(JSON, default=lambda: [0.0, 0.0, 0.0])
    rotation: Mapped[list[float]] = mapped_column(JSON, default=lambda: [0.0, 0.0, 0.0])
    scale: Mapped[list[float]] = mapped_column(JSON, default=lambda: [1.0, 1.0, 1.0])


class SceneAnnotation(Base):
    __tablename__ = "scene_annotations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    reconstruction_id: Mapped[int] = mapped_column(ForeignKey("reconstructions.id", ondelete="CASCADE"), index=True)
    # Null for annotations that apply to every stage.
    stage_id: Mapped[int | None] = mapped_column(ForeignKey("reconstruction_stages.id", ondelete="CASCADE"))
    kind: Mapped[str] = mapped_column(String(16))
    data: Mapped[dict] = mapped_column(JSON, default=dict)


class Building(Base):
    """Building models for the geographic and building viewers (M6, M7)."""

    __tablename__ = "buildings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    geo_building_id: Mapped[str | None] = mapped_column(String(100))
    name: Mapped[str] = mapped_column(String(200))
    model_url: Mapped[str | None] = mapped_column(String(500))
    # floors, rooms, doors, windows, entrances
    floors: Mapped[list | dict] = mapped_column(JSON, default=list)
    description: Mapped[str] = mapped_column(Text, default="")
