"""The models a generated scene can use, shared by the planners (which may only pick
from this list), the compiler (which copies each used entry into the scene layout)
and the 3D viewer (which loads `url`, or draws `shape` when there is no file).

Sizes are length along the direction the model faces (a vehicle's length, a
sofa's or cupboard's depth), width across it and height, in metres.
Every file faces +x (east) with its origin on the ground at the centre of its
footprint. The viewer scales a file to its size here. Vehicles and the person
are built in code by frontend/scripts/crime-scene-models/; furniture and items
are Poly Haven models (CC0) prepared by props.mjs there.
"""

from dataclasses import asdict, dataclass, field
from typing import Literal

ModelKind = Literal["vehicle", "person", "item", "furniture", "fixture"]

LIBRARY = "/3d/crime-scenes/library"
PROPS = f"{LIBRARY}/props"


@dataclass(frozen=True)
class ModelSpec:
    kind: ModelKind
    name: str
    size: tuple[float, float, float]
    description: str = ""
    url: str | None = None
    # Drawn in code by the viewer when there is no url, or when the file fails.
    shape: str = "box"
    # "tile" repeats the file across its width to fill the size (shelving runs);
    # "stack" fills the size with copies in rows and layers (stacked boxes).
    fill: str | None = None
    # Height above the floor, for wall-mounted fittings.
    elevation: float = 0.0
    # Has the `paint` and `plate_*` materials the viewer restyles from the case record.
    restyle: bool = False
    tags: tuple[str, ...] = field(default=())

    def layout_entry(self) -> dict:
        entry = asdict(self)
        entry.pop("description")
        entry.pop("tags")
        entry["size"] = list(self.size)
        return {k: v for k, v in entry.items() if v not in (None, 0.0, False)}


def _vehicle(name: str, size, description: str, file: str, shape: str) -> ModelSpec:
    return ModelSpec("vehicle", name, size, description, url=f"{LIBRARY}/{file}", shape=shape, restyle=True)


MODELS: dict[str, ModelSpec] = {
    # Vehicles, built by frontend/scripts/crime-scene-models/
    "hatchback": _vehicle("Hatchback car", (3.85, 1.74, 1.53), "Small car such as a Maruti Swift, Hyundai i20 or VW Polo.", "hatchback.glb", "car"),
    "sedan": _vehicle("Sedan car", (4.55, 1.75, 1.49), "Saloon car such as a Honda City or Hyundai Verna; also use for SUVs.", "sedan.glb", "car"),
    "delivery-van": _vehicle("Mini truck or delivery van", (3.8, 1.58, 2.12), "Light goods vehicle with a cargo box, such as a Tata Ace; also vans.", "delivery-van.glb", "van"),
    "truck": _vehicle("Truck", (8.5, 2.5, 3.4), "Heavy goods vehicle or lorry.", "truck.glb", "truck"),
    "bus": _vehicle("Bus", (11.5, 2.55, 3.2), "City or route bus.", "bus.glb", "bus"),
    "auto-rickshaw": _vehicle("Auto-rickshaw", (2.65, 1.3, 1.75), "Three-wheeled taxi.", "auto-rickshaw.glb", "auto"),
    "motorcycle": _vehicle("Motorcycle or scooter", (2.05, 0.75, 1.1), "Motorcycle, scooter or moped.", "motorcycle.glb", "motorcycle"),
    "bicycle": _vehicle("Bicycle", (1.75, 0.6, 1.05), "Pedal cycle.", "bicycle.glb", "bicycle"),
    # People
    "person": ModelSpec(
        "person", "Person", (0.3, 0.5, 1.72),
        "Any person: driver outside a vehicle, pedestrian, witness, victim or suspect. Pose comes from the placement. "
        "A cyclist or motorcyclist is a person entity with the bicycle or motorcycle model.",
        url=f"{LIBRARY}/person.glb", shape="person",
    ),
    # Items that matter to the case (Poly Haven, CC0)
    "knife": ModelSpec("item", "Knife", (0.216, 0.016, 0.029), url=f"{PROPS}/knife.glb", shape="knife"),
    "firearm": ModelSpec("item", "Handgun", (0.222, 0.129, 0.032), "Pistol or other firearm.", url=f"{PROPS}/pistol.glb"),
    "blunt-object": ModelSpec("item", "Bat", (0.913, 0.064, 0.064), "Bat, stick, rod or pipe.", url=f"{PROPS}/bat.glb", shape="rod"),
    "crowbar": ModelSpec("item", "Crowbar", (0.555, 0.128, 0.04), "Crowbar or other prying tool.", url=f"{PROPS}/crowbar.glb", shape="rod"),
    "phone": ModelSpec("item", "Phone", (0.16, 0.075, 0.009), shape="phone"),
    "bottle": ModelSpec("item", "Bottle", (0.08, 0.08, 0.3), shape="bottle"),
    "document": ModelSpec("item", "Papers", (1.1, 0.66, 0.022), "Papers, letters, notes or ID.", url=f"{PROPS}/papers.glb"),
    "bag": ModelSpec("item", "Suitcase or bag", (0.239, 0.694, 0.568), "Bag, suitcase or backpack.", url=f"{PROPS}/suitcase.glb", shape="bag"),
    "jewellery-box": ModelSpec("item", "Jewellery box", (0.25, 0.18, 0.1), "Jewellery, cash box or small valuables.", shape="jewellery"),
    "debris": ModelSpec("item", "Debris", (0.8, 0.6, 0.05), "Broken vehicle parts, glass or fragments.", shape="debris"),
    "traffic-cone": ModelSpec("item", "Traffic cone", (0.36, 0.36, 0.7), shape="cone"),
    # Furniture and fittings, for rooms (Poly Haven, CC0)
    "bed": ModelSpec("furniture", "Bed", (2.0, 0.905, 1.2), url=f"{PROPS}/bed-frame.glb", shape="bed"),
    "sofa": ModelSpec("furniture", "Sofa", (0.925, 2.731, 1.118), url=f"{PROPS}/sofa.glb", shape="sofa"),
    "table": ModelSpec("furniture", "Table", (1.6, 0.99, 0.78), "Dining table, desk or counter.", url=f"{PROPS}/table.glb", shape="table"),
    "chair": ModelSpec("furniture", "Chair", (0.576, 0.434, 0.973), url=f"{PROPS}/chair.glb", shape="chair"),
    "plastic-chair": ModelSpec("furniture", "Plastic chair", (0.628, 0.642, 0.88), url=f"{PROPS}/plastic-chair.glb", shape="chair"),
    "cupboard": ModelSpec("furniture", "Cupboard", (0.488, 1.141, 1.881), "Cupboard, wardrobe, almirah or chest of drawers.", url=f"{PROPS}/cupboard.glb", shape="cabinet"),
    "nightstand": ModelSpec("furniture", "Bedside table", (0.424, 0.568, 0.7), url=f"{PROPS}/nightstand.glb", shape="cabinet"),
    "bookshelf": ModelSpec("furniture", "Bookshelf", (0.581, 1.374, 2.063), url=f"{PROPS}/bookshelf.glb", shape="shelf"),
    "television": ModelSpec("furniture", "Television", (0.35, 0.4, 0.411), url=f"{PROPS}/television.glb", shape="box"),
    "shelf": ModelSpec("furniture", "Steel shelving", (0.502, 2.4, 2.142), "Steel racks, as in a store or warehouse.", url=f"{PROPS}/shelf.glb", shape="shelf", fill="tile"),
    "electrical-panel": ModelSpec("fixture", "Electrical panel", (0.399, 0.461, 0.503), "Distribution board or meter box, wall-mounted.", url=f"{PROPS}/electrical-panel.glb", shape="panel", elevation=1.3),
    "utility-box": ModelSpec("fixture", "Utility cabinet", (0.432, 0.52, 1.12), "Street-side electrical or signal controller cabinet.", url=f"{PROPS}/utility-box.glb", shape="cabinet"),
    "pallet-stack": ModelSpec("fixture", "Stacked boxes", (1.0, 1.2, 1.4), "Cartons, bales or stored goods.", url=f"{PROPS}/cardboard-box.glb", shape="crates", fill="stack"),
    "crate": ModelSpec("fixture", "Wooden crate", (0.825, 0.409, 0.35), url=f"{PROPS}/crate.glb", shape="crates"),
    "machine": ModelSpec("fixture", "Generator", (0.564, 0.818, 0.577), "Generator, compressor or other machine.", url=f"{PROPS}/generator.glb", shape="box"),
}

# Scene items the viewer draws from the layout rather than from MODELS.
LANDMARK_KINDS = ("building", "shop", "bus_stop", "tree", "streetlight", "signal", "wall", "parked_vehicle", "furniture")
TRACE_KINDS = (
    "skid_marks",
    "debris",
    "glass",
    "blood",
    "impact_point",
    "fire_origin",
    "burn_area",
    "forced_entry",
    "footprints",
    "evidence_marker",
)


def default_model(kind: str) -> str:
    """The model to use when a planner names one that isn't in MODELS."""
    return {"vehicle": "sedan", "person": "person"}.get(kind, "document")


def catalogue_prompt() -> str:
    """The catalogue as prompt lines: id, size and use."""
    lines = []
    for model_id, spec in MODELS.items():
        size = " x ".join(f"{v:g}" for v in spec.size)
        lines.append(f"- {model_id} ({spec.kind}, {size} m): {spec.name}. {spec.description}".rstrip())
    return "\n".join(lines)
