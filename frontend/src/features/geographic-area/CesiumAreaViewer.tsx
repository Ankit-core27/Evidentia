import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
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

const COLOURS = {
  incident: Cesium.Color.fromCssColorString('#f07a72'),
  accent: Cesium.Color.fromCssColorString('#37aebd'),
  modelled: Cesium.Color.fromCssColorString('#8a9aa6').withAlpha(0.95),
  footprint: Cesium.Color.fromCssColorString('#4d5861').withAlpha(0.9),
  location: {
    witness_position: Cesium.Color.fromCssColorString('#8eaef0'),
    vehicle_position: Cesium.Color.fromCssColorString('#6cc7a8'),
    zone: Cesium.Color.fromCssColorString('#e0a37a'),
    boundary: Cesium.Color.fromCssColorString('#e0a37a'),
    incident_site: Cesium.Color.fromCssColorString('#f07a72')
  } as Record<string, Cesium.Color>
};

export interface AreaStatus {
  terrain: 'loading' | 'world' | 'ellipsoid' | 'failed';
  buildings: 'loading' | 'osm' | 'authored-only' | 'failed';
  imagery: 'ion' | 'esri';
}

export interface AreaViewerHandle {
  flyToOverview: () => void;
  flyToIncident: () => void;
  flyToBuilding: (id: string) => void;
  cameraPose: () => CameraPose | null;
}

interface Props {
  incident: { lat: number; lng: number; label: string } | null;
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
    const status: AreaStatus = {
      terrain: ION_TOKEN ? 'loading' : 'ellipsoid',
      buildings: ION_TOKEN ? 'loading' : 'authored-only',
      imagery: ION_TOKEN ? 'ion' : 'esri'
    };
    const report = () => latest.current.onStatus({ ...status });

    const terrain = ION_TOKEN ? Cesium.Terrain.fromWorldTerrain({ requestVertexNormals: true }) : undefined;
    const viewer = new Cesium.Viewer(el, {
      baseLayer: ION_TOKEN
        ? Cesium.ImageryLayer.fromWorldImagery({})
        : // Without an ion token: Esri's satellite imagery, the same as the dashboard map's.
          new Cesium.ImageryLayer(
            new Cesium.UrlTemplateImageryProvider({ url: SATELLITE.url, maximumLevel: SATELLITE.maxZoom, credit: SATELLITE.attribution })
          ),
      terrain,
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
    scene.globe.depthTestAgainstTerrain = Boolean(ION_TOKEN);
    if (ION_TOKEN && scene.globe.imageryLayers.length > 0) {
      // Darken satellite imagery towards the interface.
      const layer = scene.globe.imageryLayers.get(0);
      layer.brightness = 0.55;
      layer.saturation = 0.6;
    }
    viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
    report();

    let disposed = false;
    if (terrain) {
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
    }
    if (ION_TOKEN) {
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
      if (id?.startsWith(BUILDING_PREFIX)) {
        onPick({ source: 'manifest', id: id.slice(BUILDING_PREFIX.length) });
        onPickLocation(null);
      } else if (id?.startsWith(LOCATION_PREFIX)) {
        onPickLocation(Number(id.slice(LOCATION_PREFIX.length)));
      } else {
        onPick(null);
        onPickLocation(null);
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    let lastHover = 0;
    handler.setInputAction((e: Cesium.ScreenSpaceEventHandler.MotionEvent) => {
      const now = performance.now();
      if (now - lastHover < 80) return;
      lastHover = now;
      const picked = scene.pick(e.endPosition);
      const pickable = picked instanceof Cesium.Cesium3DTileFeature || (picked?.id instanceof Cesium.Entity && /^(building|location):/.test(picked.id.id));
      scene.canvas.style.cursor = pickable ? 'pointer' : '';
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    return () => {
      disposed = true;
      handler.destroy();
      viewer.destroy();
      viewerRef.current = null;
      osmPick.current = null;
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
      return viewer.entities.add({
        id: `${BUILDING_PREFIX}${b.id}`,
        name: b.name,
        polygon: {
          hierarchy: new Cesium.PolygonHierarchy(corners.map((c) => Cesium.Cartesian3.fromDegrees(c.lng, c.lat))),
          height: 0,
          heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
          extrudedHeight: b.height_m,
          extrudedHeightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
          material: b.model ? COLOURS.modelled : COLOURS.footprint
        },
        position: Cesium.Cartesian3.fromDegrees(b.anchor.lng, b.anchor.lat, b.height_m + 4),
        label: {
          text: b.model ? b.name : b.name.replace(/ \(footprint only\)$/, ''),
          font: '500 12px "IBM Plex Sans", sans-serif',
          fillColor: Cesium.Color.fromCssColorString('#e7e9eb'),
          outlineColor: Cesium.Color.fromCssColorString('#0b0d0e'),
          outlineWidth: 3,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
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
  }, [props.buildings]);

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
      entity.polygon.material = new Cesium.ColorMaterialProperty(selected ? COLOURS.accent.withAlpha(0.85) : b.model ? COLOURS.modelled : COLOURS.footprint);
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
