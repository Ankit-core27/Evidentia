import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import * as Cesium from 'cesium';
import { SATELLITE } from '@/lib/basemaps';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import type { Location } from '@/types/api';
import type { AreaSelection, CameraPose } from '@/stores/area';
import { BuildingEntry, distanceMetres, footprintCorners, offsetLatLng } from './buildingRegistry';

// vite.config.ts defines CESIUM_BASE_URL; setting it on window too covers pre-bundled deps.
declare global {
  interface Window {
    CESIUM_BASE_URL?: string;
  }
}
window.CESIUM_BASE_URL ??= '/cesium';

const ION_TOKEN = (import.meta.env.VITE_CESIUM_ION_TOKEN as string | undefined)?.trim() || '';
const GOOGLE_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined)?.trim() || '';
/**
 * Google Photorealistic 3D Tiles: the textured photogrammetry of Google Earth (buildings,
 * trees, roads and terrain in one mesh). Streamed straight from Google with a Maps
 * Platform key (Map Tiles API enabled), or through Cesium ion with an ion token.
 */
const PHOTOREALISTIC = Boolean(GOOGLE_KEY || ION_TOKEN);

const COLOURS = {
  incident: Cesium.Color.fromCssColorString('#f07a72'),
  accent: Cesium.Color.fromCssColorString('#37aebd'),
  // Over the photorealistic mesh, authored buildings are tinted glass, so the real
  // building shows through.
  modelled: Cesium.Color.fromCssColorString('#8a9aa6').withAlpha(PHOTOREALISTIC ? 0.3 : 0.95),
  footprint: Cesium.Color.fromCssColorString('#4d5861').withAlpha(PHOTOREALISTIC ? 0.25 : 0.9),
  location: {
    witness_position: Cesium.Color.fromCssColorString('#8eaef0'),
    vehicle_position: Cesium.Color.fromCssColorString('#6cc7a8'),
    zone: Cesium.Color.fromCssColorString('#e0a37a'),
    boundary: Cesium.Color.fromCssColorString('#e0a37a'),
    incident_site: Cesium.Color.fromCssColorString('#f07a72')
  } as Record<string, Cesium.Color>
};

export interface AreaStatus {
  terrain: 'loading' | 'world' | 'ellipsoid' | 'photorealistic' | 'photorealistic-failed' | 'failed';
  buildings: 'loading' | 'osm' | 'photorealistic' | 'authored-only' | 'failed';
  imagery: 'ion' | 'esri' | 'google';
}

export interface AreaViewerHandle {
  flyToOverview: () => void;
  flyToIncident: () => void;
  flyToBuilding: (id: string) => void;
  cameraPose: () => CameraPose | null;
}

/** A reconstruction scene object on the map, where the time slider puts it. */
export interface MapActor {
  key: string;
  sceneObjectId: number;
  label: string;
  lat: number;
  lng: number;
  /** Compass bearing it faces, in radians clockwise from north. */
  bearing: number;
  kind: 'vehicle' | 'person' | 'item';
  /** GLB to draw it with; people and items without one are drawn as markers. */
  modelUrl?: string;
  selected: boolean;
}

/** A reconstruction measurement on the ground, such as skid marks. */
export interface MapLine {
  key: string;
  label: string;
  from: { lat: number; lng: number };
  to: { lat: number; lng: number };
}

interface Props {
  incident: { lat: number; lng: number; label: string } | null;
  /** The active reconstruction stage, synced with the reconstruction panel's time slider. */
  actors: MapActor[];
  lines: MapLine[];
  onPickActor: (sceneObjectId: number | null) => void;
  locations: Location[];
  buildings: BuildingEntry[];
  radiusM: number;
  selection: AreaSelection | null;
  initialCamera: CameraPose | null;
  /** True while the building inspector covers the map: stops Cesium's render loop. */
  paused: boolean;
  onPick: (selection: AreaSelection | null) => void;
  onPickLocation: (id: number | null) => void;
  onStatus: (status: AreaStatus) => void;
}

const BUILDING_PREFIX = 'building:';
const ACTOR_PREFIX = 'actor:';
const LOCATION_PREFIX = 'location:';

/** Inside the investigation radius if any part of the footprint is. */
function withinRadius(b: BuildingEntry, incident: Props['incident'], radiusM: number) {
  if (!incident) return true;
  const half = Math.hypot(b.footprint.width_m, b.footprint.depth_m) / 2;
  return distanceMetres(incident, b.anchor) - half <= radiusM;
}

function circle(lat: number, lng: number, radiusM: number, segments = 96) {
  const pts: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const p = offsetLatLng(lat, lng, Math.cos(a) * radiusM, Math.sin(a) * radiusM);
    pts.push(p.lng, p.lat);
  }
  return Cesium.Cartesian3.fromDegreesArray(pts);
}

export const CesiumAreaViewer = forwardRef<AreaViewerHandle, Props>(function CesiumAreaViewer(props, ref) {
  const container = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const groundRef = useRef(0);
  // Ground height of the photorealistic mesh at each authored building, once sampled.
  // The mesh hides the globe, so buildings are drawn at these heights instead of
  // relative to a globe surface that is no longer the ground.
  const [meshGround, setMeshGround] = useState<Map<string, number> | null>(null);
  const actorEntities = useRef(new Map<string, Cesium.Entity>());
  const osmPick = useRef<{ feature: Cesium.Cesium3DTileFeature; colour: Cesium.Color; position: Cesium.Cartesian3 | undefined } | null>(null);
  const latest = useRef(props);
  latest.current = props;

  const center = () => {
    const { incident, buildings } = latest.current;
    if (incident) return incident;
    if (buildings.length === 0) return null;
    return {
      lat: buildings.reduce((a, b) => a + b.anchor.lat, 0) / buildings.length,
      lng: buildings.reduce((a, b) => a + b.anchor.lng, 0) / buildings.length
    };
  };

  const fly = (sphere: Cesium.BoundingSphere, heading: number, pitch: number, range: number, duration = 1.6) => {
    viewerRef.current?.camera.flyToBoundingSphere(sphere, {
      offset: new Cesium.HeadingPitchRange(Cesium.Math.toRadians(heading), Cesium.Math.toRadians(pitch), range),
      duration
    });
  };

  const flyToOverview = (duration = 1.6) => {
    const c = center();
    if (!c) return;
    const r = latest.current.radiusM;
    fly(new Cesium.BoundingSphere(Cesium.Cartesian3.fromDegrees(c.lng, c.lat, groundRef.current), r), 20, -48, r * 2.6, duration);
  };

  const flyToBuilding = (id: string) => {
    const b = latest.current.buildings.find((x) => x.id === id);
    if (!b) return;
    const size = Math.max(b.footprint.width_m, b.footprint.depth_m, b.height_m);
    const pos = Cesium.Cartesian3.fromDegrees(b.anchor.lng, b.anchor.lat, groundRef.current + b.height_m / 2);
    fly(new Cesium.BoundingSphere(pos, size * 0.8), b.anchor.heading_deg + 35, -32, size * 5.5);
  };

  useImperativeHandle(ref, () => ({
    flyToOverview: () => flyToOverview(),
    flyToIncident: () => {
      const i = latest.current.incident;
      if (i) fly(new Cesium.BoundingSphere(Cesium.Cartesian3.fromDegrees(i.lng, i.lat, groundRef.current), 20), 0, -35, 110);
    },
    flyToBuilding: (id) => {
      const sel = latest.current.selection;
      if (sel?.source === 'osm' && sel.id === id && osmPick.current?.position) {
        fly(new Cesium.BoundingSphere(osmPick.current.position, 25), 30, -30, 120);
      } else {
        flyToBuilding(id);
      }
    },
    cameraPose: () => {
      const cam = viewerRef.current?.camera;
      if (!cam) return null;
      return { position: [cam.position.x, cam.position.y, cam.position.z], heading: cam.heading, pitch: cam.pitch, roll: cam.roll };
    }
  }));

  // Create the viewer once. Terrain, imagery and OSM buildings stream by level of detail.
  useEffect(() => {
    const el = container.current;
    if (!el) return;
    if (ION_TOKEN) Cesium.Ion.defaultAccessToken = ION_TOKEN;
    if (GOOGLE_KEY) Cesium.GoogleMaps.defaultApiKey = GOOGLE_KEY;
    const status: AreaStatus = {
      terrain: PHOTOREALISTIC ? 'loading' : 'ellipsoid',
      buildings: PHOTOREALISTIC ? 'loading' : 'authored-only',
      imagery: PHOTOREALISTIC ? 'google' : 'esri'
    };
    const report = () => latest.current.onStatus({ ...status });

    const viewer = new Cesium.Viewer(el, {
      baseLayer: ION_TOKEN
        ? Cesium.ImageryLayer.fromWorldImagery({})
        : // Without an ion token: Esri's satellite imagery, the same as the dashboard map's.
          new Cesium.ImageryLayer(
            new Cesium.UrlTemplateImageryProvider({ url: SATELLITE.url, maximumLevel: SATELLITE.maxZoom, credit: SATELLITE.attribution })
          ),
      animation: false,
      timeline: false,
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      fullscreenButton: false,
      infoBox: false,
      selectionIndicator: false,
      requestRenderMode: true,
      maximumRenderTimeChange: Infinity
    });
    viewerRef.current = viewer;
    const scene = viewer.scene;
    scene.backgroundColor = Cesium.Color.fromCssColorString('#0b0d0e');
    scene.globe.baseColor = Cesium.Color.fromCssColorString('#0f1113');
    scene.globe.depthTestAgainstTerrain = true;
    viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
    report();

    let disposed = false;
    // Without the photorealistic mesh, the globe shows satellite imagery; with an ion
    // token it also gets world terrain and OSM buildings.
    const flatFallback = () => {
      scene.globe.show = true;
      if (!ION_TOKEN) {
        status.terrain = PHOTOREALISTIC ? 'photorealistic-failed' : 'ellipsoid';
        status.buildings = 'authored-only';
        status.imagery = 'esri';
        report();
        return;
      }
      status.imagery = 'ion';
      status.terrain = 'loading';
      status.buildings = 'loading';
      const terrain = Cesium.Terrain.fromWorldTerrain({ requestVertexNormals: true });
      scene.setTerrain(terrain);
      terrain.readyEvent.addEventListener(async (provider) => {
        status.terrain = 'world';
        report();
        const c = center();
        if (!c) return;
        try {
          const [sample] = await Cesium.sampleTerrainMostDetailed(provider, [Cesium.Cartographic.fromDegrees(c.lng, c.lat)]);
          if (!disposed) {
            groundRef.current = sample.height ?? 0;
            if (!latest.current.initialCamera) flyToOverview(0);
          }
        } catch {
          // Keep the ellipsoid height; markers are clamped to the ground anyway.
        }
      });
      terrain.errorEvent.addEventListener(() => {
        status.terrain = 'failed';
        report();
      });
      Cesium.createOsmBuildingsAsync({ style: new Cesium.Cesium3DTileStyle({ color: "color('#3a4148', 0.92)" }) })
        .then((tileset) => {
          if (disposed) return;
          scene.primitives.add(tileset);
          status.buildings = 'osm';
          report();
        })
        .catch(() => {
          status.buildings = 'failed';
          report();
        });
      report();
    };

    if (PHOTOREALISTIC) {
      Cesium.createGooglePhotorealistic3DTileset(GOOGLE_KEY ? { key: GOOGLE_KEY } : undefined, {
        // Google's terms ask for its credits on screen, which Cesium shows by default.
        showCreditsOnScreen: true,
        maximumScreenSpaceError: 8
      })
        .then(async (tileset) => {
          if (disposed) return;
          scene.primitives.add(tileset);
          // The mesh is the ground; hiding the globe keeps it from showing through.
          scene.globe.show = false;
          status.terrain = 'photorealistic';
          status.buildings = 'photorealistic';
          report();
          // Find the real ground height at the incident and at each authored building, so
          // the camera, markers and buildings sit on the mesh.
          const c = center();
          const { buildings } = latest.current;
          const points = [...(c ? [c] : []), ...buildings.map((b) => b.anchor)];
          if (!points.length) return;
          try {
            const samples = await scene.sampleHeightMostDetailed(points.map((p) => Cesium.Cartographic.fromDegrees(p.lng, p.lat)), [tileset]);
            if (disposed) return;
            const heights = samples.map((s) => s.height);
            if (c && heights[0] !== undefined) {
              groundRef.current = heights[0];
              if (!latest.current.initialCamera) flyToOverview(0);
            }
            const offset = c ? 1 : 0;
            setMeshGround(new Map(buildings.map((b, i) => [b.id, heights[i + offset] ?? groundRef.current])));
          } catch {
            // Keep the ellipsoid height; markers are clamped to the mesh anyway.
          }
        })
        .catch(() => {
          if (disposed) return;
          flatFallback();
        });
    } else {
      flatFallback();
    }

    const initial = latest.current.initialCamera;
    if (initial) {
      viewer.camera.setView({
        destination: new Cesium.Cartesian3(...initial.position),
        orientation: { heading: initial.heading, pitch: initial.pitch, roll: initial.roll }
      });
    } else {
      flyToOverview(0);
    }

    const handler = new Cesium.ScreenSpaceEventHandler(scene.canvas);
    handler.setInputAction((e: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
      const picked = scene.pick(e.position);
      const { onPick, onPickLocation, buildings } = latest.current;
      if (picked instanceof Cesium.Cesium3DTileFeature) {
        const properties: Record<string, string> = {};
        for (const key of picked.getPropertyIds()) {
          const value = picked.getProperty(key);
          if (value !== undefined && value !== null && value !== '') properties[key] = String(value);
        }
        const elementId = properties.elementId ?? String(picked.featureId);
        const mapped = buildings.find((b) => b.geo_building_id === `osm:${elementId}`);
        if (mapped) {
          onPick({ source: 'manifest', id: mapped.id });
        } else {
          if (osmPick.current) osmPick.current.feature.color = osmPick.current.colour;
          osmPick.current = { feature: picked, colour: Cesium.Color.clone(picked.color), position: scene.pickPositionSupported ? scene.pickPosition(e.position) : undefined };
          onPick({ source: 'osm', id: elementId, name: properties.name ?? `OSM building ${elementId}`, properties });
        }
        onPickLocation(null);
        return;
      }
      const id = picked?.id instanceof Cesium.Entity ? picked.id.id : null;
      if (id?.startsWith(ACTOR_PREFIX)) {
        latest.current.onPickActor(Number(picked.id.properties?.sceneObjectId?.getValue()));
        return;
      }
      if (id?.startsWith(BUILDING_PREFIX)) {
        onPick({ source: 'manifest', id: id.slice(BUILDING_PREFIX.length) });
        onPickLocation(null);
      } else if (id?.startsWith(LOCATION_PREFIX)) {
        onPickLocation(Number(id.slice(LOCATION_PREFIX.length)));
      } else {
        onPick(null);
        onPickLocation(null);
        latest.current.onPickActor(null);
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    let lastHover = 0;
    handler.setInputAction((e: Cesium.ScreenSpaceEventHandler.MotionEvent) => {
      const now = performance.now();
      if (now - lastHover < 80) return;
      lastHover = now;
      const picked = scene.pick(e.endPosition);
      const pickable = picked instanceof Cesium.Cesium3DTileFeature || (picked?.id instanceof Cesium.Entity && /^(building|location|actor):/.test(picked.id.id));
      scene.canvas.style.cursor = pickable ? 'pointer' : '';
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    return () => {
      disposed = true;
      handler.destroy();
      viewer.destroy();
      viewerRef.current = null;
      osmPick.current = null;
      actorEntities.current.clear();
    };
    // The viewer is created once; later prop changes are applied by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Authored building footprints, extruded to their recorded height.
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const entities = props.buildings.map((b) => {
      const corners = footprintCorners(b);
      // On the photorealistic mesh: absolute heights from the sampled ground. Otherwise
      // relative to the globe's terrain.
      const ground = meshGround?.get(b.id);
      const onMesh = ground !== undefined;
      const relative = onMesh ? Cesium.HeightReference.NONE : Cesium.HeightReference.RELATIVE_TO_GROUND;
      return viewer.entities.add({
        id: `${BUILDING_PREFIX}${b.id}`,
        name: b.name,
        polygon: {
          hierarchy: new Cesium.PolygonHierarchy(corners.map((c) => Cesium.Cartesian3.fromDegrees(c.lng, c.lat))),
          height: onMesh ? ground : 0,
          heightReference: relative,
          extrudedHeight: (onMesh ? ground : 0) + b.height_m,
          extrudedHeightReference: relative,
          material: b.model ? COLOURS.modelled : COLOURS.footprint
        },
        position: Cesium.Cartesian3.fromDegrees(b.anchor.lng, b.anchor.lat, (onMesh ? ground : 0) + b.height_m + 4),
        label: {
          text: b.model ? b.name : b.name.replace(/ \(footprint only\)$/, ''),
          font: '500 12px "IBM Plex Sans", sans-serif',
          fillColor: Cesium.Color.fromCssColorString('#e7e9eb'),
          outlineColor: Cesium.Color.fromCssColorString('#0b0d0e'),
          outlineWidth: 3,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          heightReference: relative,
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 650),
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        }
      });
    });
    viewer.scene.requestRender();
    return () => {
      if (viewer.isDestroyed()) return;
      entities.forEach((e) => viewer.entities.remove(e));
    };
  }, [props.buildings, meshGround]);

  // The reconstruction's scene objects at the time slider's position. Entities are kept
  // and moved, not rebuilt, so playback stays smooth.
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const seen = new Set<string>();
    for (const a of props.actors) {
      seen.add(a.key);
      const position = Cesium.Cartesian3.fromDegrees(a.lng, a.lat);
      const orientation = Cesium.Transforms.headingPitchRollQuaternion(position, new Cesium.HeadingPitchRoll(a.bearing, 0, 0));
      let entity = actorEntities.current.get(a.key);
      if (!entity) {
        entity = viewer.entities.add({
          id: `${ACTOR_PREFIX}${a.key}`,
          name: a.label,
          properties: { sceneObjectId: a.sceneObjectId },
          ...(a.modelUrl
            ? { model: { uri: a.modelUrl, heightReference: Cesium.HeightReference.CLAMP_TO_GROUND, minimumPixelSize: 28, maximumScale: 40 } }
            : {
                point: {
                  pixelSize: a.kind === 'person' ? 10 : 8,
                  color: COLOURS.accent,
                  outlineColor: Cesium.Color.fromCssColorString('#0b0d0e'),
                  outlineWidth: 2,
                  heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                  disableDepthTestDistance: Number.POSITIVE_INFINITY
                }
              }),
          label: {
            text: a.label,
            font: '500 11px "IBM Plex Sans", sans-serif',
            pixelOffset: new Cesium.Cartesian2(0, -26),
            fillColor: Cesium.Color.fromCssColorString('#e7e9eb'),
            outlineColor: Cesium.Color.fromCssColorString('#0b0d0e'),
            outlineWidth: 3,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 400),
            disableDepthTestDistance: Number.POSITIVE_INFINITY
          }
        });
        actorEntities.current.set(a.key, entity);
      }
      entity.position = new Cesium.ConstantPositionProperty(position);
      entity.orientation = new Cesium.ConstantProperty(orientation);
      if (entity.model) entity.model.silhouetteSize = new Cesium.ConstantProperty(a.selected ? 2 : 0);
      if (entity.model) entity.model.silhouetteColor = new Cesium.ConstantProperty(COLOURS.accent);
      if (entity.label) entity.label.fillColor = new Cesium.ConstantProperty(Cesium.Color.fromCssColorString(a.selected ? '#5ec4cf' : '#e7e9eb'));
    }
    for (const [key, entity] of actorEntities.current) {
      if (seen.has(key)) continue;
      viewer.entities.remove(entity);
      actorEntities.current.delete(key);
    }
    viewer.scene.requestRender();
  }, [props.actors]);

  // Measurements of the active stage, such as skid marks, on the ground.
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const added = props.lines.map((l) =>
      viewer.entities.add({
        id: `line:${l.key}`,
        polyline: {
          positions: Cesium.Cartesian3.fromDegreesArray([l.from.lng, l.from.lat, l.to.lng, l.to.lat]),
          width: 4,
          clampToGround: true,
          material: Cesium.Color.fromCssColorString('#e2b155')
        },
        position: Cesium.Cartesian3.fromDegrees((l.from.lng + l.to.lng) / 2, (l.from.lat + l.to.lat) / 2),
        label: {
          text: l.label,
          font: '500 11px "IBM Plex Mono", monospace',
          fillColor: Cesium.Color.fromCssColorString('#e2b155'),
          outlineColor: Cesium.Color.fromCssColorString('#0b0d0e'),
          outlineWidth: 3,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(0, -14),
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 300),
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        }
      })
    );
    viewer.scene.requestRender();
    return () => {
      if (viewer.isDestroyed()) return;
      added.forEach((e) => viewer.entities.remove(e));
    };
  }, [props.lines]);

  // Incident marker, investigation radius and the case's recorded locations.
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const added: Cesium.Entity[] = [];
    const { incident, radiusM, locations } = props;
    if (incident) {
      const pin = new Cesium.PinBuilder().fromText('!', COLOURS.incident, 52).toDataURL();
      added.push(
        viewer.entities.add({
          id: 'incident',
          position: Cesium.Cartesian3.fromDegrees(incident.lng, incident.lat),
          billboard: { image: pin, verticalOrigin: Cesium.VerticalOrigin.BOTTOM, heightReference: Cesium.HeightReference.CLAMP_TO_GROUND, disableDepthTestDistance: Number.POSITIVE_INFINITY },
          label: {
            text: incident.label,
            font: '600 12px "IBM Plex Sans", sans-serif',
            pixelOffset: new Cesium.Cartesian2(0, -62),
            fillColor: Cesium.Color.fromCssColorString('#e7e9eb'),
            outlineColor: Cesium.Color.fromCssColorString('#0b0d0e'),
            outlineWidth: 3,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            disableDepthTestDistance: Number.POSITIVE_INFINITY
          }
        }),
        viewer.entities.add({
          id: 'radius-fill',
          position: Cesium.Cartesian3.fromDegrees(incident.lng, incident.lat),
          ellipse: { semiMajorAxis: radiusM, semiMinorAxis: radiusM, height: 0, material: COLOURS.accent.withAlpha(0.06), heightReference: Cesium.HeightReference.CLAMP_TO_GROUND }
        }),
        viewer.entities.add({
          id: 'radius-ring',
          polyline: { positions: circle(incident.lat, incident.lng, radiusM), width: 2, clampToGround: true, material: new Cesium.PolylineDashMaterialProperty({ color: COLOURS.accent.withAlpha(0.9), dashLength: 14 }) }
        })
      );
    }
    for (const l of locations) {
      if (l.lat === null || l.lng === null || l.kind === 'incident_site' || l.review_status === 'rejected') continue;
      added.push(
        viewer.entities.add({
          id: `${LOCATION_PREFIX}${l.id}`,
          name: l.address,
          position: Cesium.Cartesian3.fromDegrees(l.lng, l.lat),
          point: {
            pixelSize: 11,
            color: COLOURS.location[l.kind] ?? COLOURS.accent,
            outlineColor: Cesium.Color.fromCssColorString('#0b0d0e'),
            outlineWidth: 2,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            disableDepthTestDistance: Number.POSITIVE_INFINITY
          }
        })
      );
    }
    viewer.scene.requestRender();
    return () => {
      if (viewer.isDestroyed()) return;
      added.forEach((e) => viewer.entities.remove(e));
    };
  }, [props.incident, props.radiusM, props.locations]);

  // Selection highlight and the radius filter on authored buildings.
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const { selection, buildings, incident, radiusM } = props;
    for (const b of buildings) {
      const entity = viewer.entities.getById(`${BUILDING_PREFIX}${b.id}`);
      if (!entity?.polygon) continue;
      const selected = selection?.source === 'manifest' && selection.id === b.id;
      entity.show = selected || withinRadius(b, incident, radiusM);
      entity.polygon.material = new Cesium.ColorMaterialProperty(selected ? COLOURS.accent.withAlpha(PHOTOREALISTIC ? 0.45 : 0.85) : b.model ? COLOURS.modelled : COLOURS.footprint);
    }
    const osm = osmPick.current;
    if (osm) {
      const stillSelected = selection?.source === 'osm';
      try {
        osm.feature.color = stillSelected ? COLOURS.accent : osm.colour;
      } catch {
        // The tile holding the feature was unloaded; nothing to restore.
      }
      if (!stillSelected) osmPick.current = null;
    }
    viewer.scene.requestRender();
  }, [props.selection, props.buildings, props.incident, props.radiusM]);

  // Stop rendering while the building inspector covers the map; resume where it was.
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    viewer.useDefaultRenderLoop = !props.paused;
    if (!props.paused) {
      viewer.resize();
      viewer.scene.requestRender();
    }
  }, [props.paused]);

  return <div ref={container} className="absolute inset-0 evidentia-cesium" data-testid="cesium-area" />;
});
