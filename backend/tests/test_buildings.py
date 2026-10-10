"""Tests for the buildings route (task B4)."""

from app.models import Building


def make_building(db, **fields) -> Building:
    values = {"name": "Ring Road Mall", "geo_building_id": "osm-123", "model_url": "/models/mall.glb"}
    building = Building(**(values | fields))
    db.add(building)
    db.commit()
    db.refresh(building)
    return building


def test_get_building(client, db):
    floors = [{"level": 0, "rooms": [{"id": "lobby", "name": "Lobby"}], "entrances": ["north"]}]
    building = make_building(db, floors=floors, description="Three floors over a basement car park.")

    response = client.get(f"/api/buildings/{building.id}")

    assert response.status_code == 200
    assert response.json() == {
        "id": building.id,
        "geo_building_id": "osm-123",
        "name": "Ring Road Mall",
        "model_url": "/models/mall.glb",
        "floors": floors,
        "description": "Three floors over a basement car park.",
    }


def test_get_building_with_defaults(client, db):
    building = make_building(db, geo_building_id=None, model_url=None)

    response = client.get(f"/api/buildings/{building.id}")

    assert response.status_code == 200
    assert response.json()["floors"] == []
    assert response.json()["description"] == ""
    assert response.json()["model_url"] is None


def test_get_unknown_building_is_404(client):
    response = client.get("/api/buildings/99")
    assert response.status_code == 404
    assert response.json() == {"detail": "Building not found"}
