import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Box, Building2, ChevronLeft, ChevronRight, Crosshair, Maximize2, ScanSearch, X } from 'lucide-react';
import { ErrorState, LoadingState } from '@/components/shared/QueryState';
import { iconButtonClass, inlineSelectClass, linkClass, primaryButtonClass, smallButtonClass } from '@/components/shared/formStyles';
import { SCENE_ROOT, SceneFile, modelSpec, modelVariant } from '@/features/crime-scene/case-scene/sceneFile';
import { placedAt, usePlaybackStore } from '@/features/reconstruction/playback';
import { StageTimeSlider } from '@/features/reconstruction/StageTimeSlider';
import { useCaseScenario } from '@/features/reconstruction/useCaseScenario';
import { casePath } from '@/lib/caseModules';
import { useStageStore } from '@/stores/stage';
import { humanize } from '@/lib/format';
import { useAreaStore } from '@/stores/area';
import type { CaseWorkspace, ReconstructionDetail, Vec3 } from '@/types/api';
import { buildingMarkers, linkedEvidence } from '@/features/building-viewer/buildingMarkers';
import { BuildingEntry, distanceMetres, offsetLatLng, useBuildingManifest } from './buildingRegistry';
import { AreaStatus, AreaViewerHandle, CesiumAreaViewer, MapActor, MapLine } from './CesiumAreaViewer';

const BuildingInspector = lazy(() => import('@/features/building-viewer/BuildingInspector').then((m) => ({ default: m.BuildingInspector })));

const RADIUS_MIN = 50;
const RADIUS_MAX = 500;

const STATUS_TEXT: Record<string, string> = {
  'terrain:loading': 'Terrain loading',
  'terrain:world': 'World terrain',
  'terrain:ellipsoid': 'Flat satellite · set VITE_GOOGLE_MAPS_API_KEY or VITE_CESIUM_ION_TOKEN for 3D',
  'terrain:photorealistic': 'Google Photorealistic 3D',
  'terrain:photorealistic-failed': 'Photorealistic 3D didn’t load (check the key and Map Tiles API) · flat satellite',
  'terrain:failed': 'Terrain unavailable',
  'buildings:loading': 'OSM buildings loading',
  'buildings:osm': 'OSM 3D buildings',
  'buildings:authored-only': 'Authored buildings only',
  'buildings:photorealistic': 'Real buildings from Google',
  'buildings:failed': 'OSM buildings unavailable'
};

/** A reconstruction's layout: its generated scene, or its authored scene file. */
function useScene(detail: ReconstructionDetail | undefined) {
  const generated = (detail?.scene ?? null) as unknown as SceneFile | null;
  const file = useQuery({
    queryKey: ['scene-file', detail?.scene_file],
    enabled: !!detail && !generated && !!detail.scene_file,
    staleTime: Infinity,
    queryFn: async ({ signal }) => {
      const res = await fetch(`${SCENE_ROOT}/scenes/${detail!.scene_file}`, { signal });
      if (!res.ok) throw new Error(`Scene file ${detail!.scene_file} could not be loaded (${res.status}).`);
      return (await res.json()) as SceneFile;
    }
  });
  return generated ?? file.data;
}

/**
 * Area overview → building selection → focus → detailed model → dissection → back.
 * The Cesium viewer stays mounted (paused) under the building inspector, so returning
 * lands on the same camera; the pose is also kept per case for when the tab is reopened.
 */
export const AreaModule: React.FC<{ workspace: CaseWorkspace }> = ({ workspace }) => {
  const caseId = workspace.case.id;
  const manifest = useBuildingManifest();
  const { view, selection, radiusM, cameras, bindCase, select, setRadius, openBuilding, returnToArea, saveCamera } = useAreaStore();
  const viewer = useRef<AreaViewerHandle>(null);
  const [status, setStatus] = useState<AreaStatus | null>(null);
  const [pickedLocation, setPickedLocation] = useState<number | null>(null);
  const [initialCamera] = useState(() => cameras[caseId] ?? null);
  // The reconstruction, synced with the reconstruction panel: same scenario, stage and playhead.
  const scenario = useCaseScenario(caseId);
  const position = usePlaybackStore((s) => s.position);
  const { stageId, sceneObjectId, selectSceneObject } = useStageStore();
  const scene = useScene(scenario.detail);

  useEffect(() => bindCase(caseId), [bindCase, caseId]);
  // Keep the camera for this case when the tab is left.
  useEffect(() => () => {
    const pose = viewer.current?.cameraPose();
    if (pose) saveCamera(caseId, pose);
  }, [caseId, saveCamera]);

  const locations = useMemo(() => workspace.locations.filter((l) => l.review_status !== 'rejected'), [workspace.locations]);
  const incidentRecord = locations.find((l) => l.kind === 'incident_site' && l.lat !== null && l.lng !== null) ?? null;
  const incident = useMemo(
    () => (incidentRecord ? { lat: incidentRecord.lat as number, lng: incidentRecord.lng as number, label: 'Incident site' } : null),
    [incidentRecord]
  );

  // Scene metres (x east, z south) are measured from the incident site, the origin of
  // every reconstruction scene, so they map onto the area around it.
  const toMap = useCallback(
    (x: number, z: number) => (incident ? offsetLatLng(incident.lat, incident.lng, x, -z) : null),
    [incident]
  );
  const actors = useMemo<MapActor[]>(() => {
    if (!scenario.detail || !incident) return [];
    return placedAt(scenario.detail.stages, stageId, position).flatMap((p) => {
      const at = toMap(p.x, p.z);
      if (!at) return [];
      const spec = modelSpec(scene, p.object.model_id);
      const kind = spec?.kind === 'person' ? 'person' : spec?.kind === 'item' ? 'item' : 'vehicle';
      const upright = !['lying', 'fallen'].includes(modelVariant(p.object.model_id));
      return [{
        key: p.key,
        sceneObjectId: p.object.id,
        label: p.object.label,
        ...at,
        // Scene headings turn anticlockwise from east; bearings clockwise from north.
        bearing: Math.PI / 2 - p.heading,
        kind,
        modelUrl: kind === 'vehicle' && upright ? spec?.url ?? `${SCENE_ROOT}/library/${p.object.model_id.split(':')[0]}.glb` : undefined,
        selected: p.object.id === sceneObjectId
      }];
    });
  }, [scenario.detail, incident, stageId, position, toMap, scene, sceneObjectId]);
  const lines = useMemo<MapLine[]>(() => {
    if (!scenario.detail) return [];
    return scenario.detail.annotations.flatMap((a) => {
      if (a.kind !== 'measurement' || (a.stage_id !== null && a.stage_id !== stageId)) return [];
      const from = a.data.from as Vec3 | undefined;
      const to = a.data.to as Vec3 | undefined;
      const f = from && toMap(from[0], from[2]);
      const t = to && toMap(to[0], to[2]);
      if (!f || !t) return [];
      const length = typeof a.data.length_m === 'number' ? ` ${a.data.length_m} m` : '';
      return [{ key: String(a.id), label: `${String(a.data.label || 'Measurement')}${length}`, from: f, to: t }];
    });
  }, [scenario.detail, stageId, toMap]);
  const selectedActor = actors.find((a) => a.selected);

  const buildings = manifest.data?.buildings;
  const allBuildings = useMemo(() => buildings ?? [], [buildings]);
  const nearby = useMemo(() => {
    const within = (b: BuildingEntry) => !incident || distanceMetres(incident, b.anchor) - Math.hypot(b.footprint.width_m, b.footprint.depth_m) / 2 <= radiusM;
    return allBuildings.filter(within).sort((a, b) => (incident ? distanceMetres(incident, a.anchor) - distanceMetres(incident, b.anchor) : 0));
  }, [allBuildings, incident, radiusM]);

  const selectedEntry = selection?.source === 'manifest' ? allBuildings.find((b) => b.id === selection.id) ?? null : null;
  const markers = useMemo(() => (selectedEntry ? buildingMarkers(workspace, selectedEntry) : []), [workspace, selectedEntry]);

  const onPick = useCallback((s: typeof selection) => {
    select(s);
    if (s) viewer.current?.flyToBuilding(s.id);
  }, [select]);

  const step = (delta: number) => {
    if (nearby.length === 0) return;
    const i = selection?.source === 'manifest' ? nearby.findIndex((b) => b.id === selection.id) : -1;
    const next = nearby[(i + delta + nearby.length) % nearby.length];
    onPick({ source: 'manifest', id: next.id });
  };

  const open = () => {
    if (!selectedEntry?.model) return;
    openBuilding(caseId, viewer.current?.cameraPose() ?? null);
  };

  const location = pickedLocation !== null ? locations.find((l) => l.id === pickedLocation) ?? null : null;
  const inspecting = view === 'building' && selectedEntry?.model;

  if (manifest.isError) return <ErrorState error={manifest.error} onRetry={() => manifest.refetch()} />;

  return (
    <section aria-label="Area model and buildings" className="space-y-2">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="font-mono text-xs uppercase tracking-wider text-ink-muted">Geographic context · M6</p>
          <h2 className="mt-0.5 text-lg font-semibold text-ink">Area & buildings</h2>
        </div>
        <p className="text-xs text-ink-muted">{incidentRecord?.address ?? manifest.data?.area.name}</p>
      </div>

      <div className="relative h-[calc(100dvh-19.5rem)] min-h-[520px] overflow-hidden rounded-md border border-line bg-well">
        {manifest.isPending ? <LoadingState label="Loading area…" /> : (
          <CesiumAreaViewer ref={viewer} incident={incident} locations={locations} buildings={allBuildings} radiusM={radiusM}
            actors={actors} lines={lines} onPickActor={selectSceneObject}
            selection={selection} initialCamera={initialCamera} paused={Boolean(inspecting)}
            onPick={onPick} onPickLocation={setPickedLocation} onStatus={setStatus} />
        )}

        {/* Compact navigation toolbar. */}
        {!inspecting && (
          <div className="absolute left-2 top-2 z-10 flex flex-wrap items-center gap-1 rounded border border-line bg-surface/95 p-1 shadow-overlay">
            <button className={smallButtonClass} onClick={() => { select(null); viewer.current?.flyToOverview(); }}><Maximize2 className="size-3.5" aria-hidden />Overview</button>
            <button className={smallButtonClass} disabled={!incident} onClick={() => viewer.current?.flyToIncident()}><Crosshair className="size-3.5" aria-hidden />Incident</button>
            <span className="mx-1 h-5 w-px bg-line" aria-hidden />
            <button className={iconButtonClass} aria-label="Previous building" disabled={nearby.length === 0} onClick={() => step(-1)}><ChevronLeft className="size-4" /></button>
            <span className="min-w-20 text-center font-mono text-2xs text-ink-soft"><Building2 className="mr-1 inline size-3.5 align-[-3px]" aria-hidden />{nearby.length} in radius</span>
            <button className={iconButtonClass} aria-label="Next building" disabled={nearby.length === 0} onClick={() => step(1)}><ChevronRight className="size-4" /></button>
            <span className="mx-1 h-5 w-px bg-line" aria-hidden />
            <label className="flex items-center gap-2 px-1 font-mono text-2xs text-ink-muted">
              Radius
              <input type="range" min={RADIUS_MIN} max={RADIUS_MAX} step={10} value={radiusM} onChange={(e) => setRadius(Number(e.target.value))}
                className="w-24 accent-[var(--color-accent)]" aria-label="Investigation radius in metres" />
              <span className="w-10 text-ink-soft">{radiusM} m</span>
            </label>
          </div>
        )}

        {!inspecting && status && (
          <div className="pointer-events-none absolute left-2 top-14 z-10 flex flex-wrap gap-1 font-mono text-2xs">
            {(['terrain', 'buildings'] as const).map((k) => (
              <span key={k} className={`rounded bg-surface/90 px-1.5 py-0.5 ${/failed$/.test(status[k]) ? 'text-warn' : 'text-ink-muted'}`}>{STATUS_TEXT[`${k}:${status[k]}`]}</span>
            ))}
          </div>
        )}

        {!inspecting && !incident && !manifest.isPending && (
          <div className="absolute left-1/2 top-14 z-10 -translate-x-1/2 rounded border border-warn/40 bg-surface/95 px-3 py-1.5 text-xs text-warn">
            This case has no incident site with coordinates, so the radius is not shown.
          </div>
        )}

        {/* Selected building. */}
        {!inspecting && selection && (
          <aside className="absolute right-2 top-2 z-10 w-72 rounded border border-line bg-surface/95 p-3 shadow-overlay" aria-label="Selected building">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-mono text-2xs uppercase tracking-wider text-ink-muted">Building</div>
                <div className="mt-0.5 truncate text-body font-medium text-ink">{selectedEntry?.name ?? (selection.source === 'osm' ? selection.name : '')}</div>
              </div>
              <button className={iconButtonClass} aria-label="Clear selection" onClick={() => select(null)}><X className="size-4" /></button>
            </div>
            {selectedEntry ? (
              <>
                <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
                  <dt className="text-ink-muted">Use</dt><dd className="text-ink-soft">{selectedEntry.use}</dd>
                  <dt className="text-ink-muted">Floors</dt><dd className="text-ink-soft">{selectedEntry.floors.length}</dd>
                  <dt className="text-ink-muted">Height</dt><dd className="text-ink-soft">{selectedEntry.height_m} m</dd>
                  <dt className="text-ink-muted">Footprint</dt><dd className="text-ink-soft">{selectedEntry.footprint.width_m} × {selectedEntry.footprint.depth_m} m</dd>
                  {incident && <><dt className="text-ink-muted">From incident</dt><dd className="text-ink-soft">{Math.round(distanceMetres(incident, selectedEntry.anchor))} m</dd></>}
                  <dt className="text-ink-muted">Feature ID</dt><dd className="truncate font-mono text-ink-soft">{selectedEntry.geo_building_id}</dd>
                  <dt className="text-ink-muted">Coordinates</dt><dd className="font-mono text-ink-soft">{selectedEntry.anchor.lat.toFixed(5)}, {selectedEntry.anchor.lng.toFixed(5)}</dd>
                  {selectedEntry.model && <><dt className="text-ink-muted">Model</dt><dd className="text-ink-soft">{Object.entries(selectedEntry.model.components).map(([k, v]) => `${v} ${k}`).join(', ')}</dd></>}
                </dl>
                <p className="mt-2 text-2xs text-ink-faint">{selectedEntry.note}</p>
                <button className={`${primaryButtonClass} mt-3 w-full`} disabled={!selectedEntry.model} onClick={open}>
                  <ScanSearch className="size-4" aria-hidden />{selectedEntry.model ? 'Open building inspection' : 'No detailed model'}
                </button>
              </>
            ) : selection.source === 'osm' ? (
              <>
                <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
                  {Object.entries(selection.properties).filter(([k]) => !k.startsWith('cesium#')).slice(0, 10).map(([k, v]) => (
                    <React.Fragment key={k}><dt className="text-ink-muted">{humanize(k)}</dt><dd className="truncate text-ink-soft" title={v}>{v}</dd></React.Fragment>
                  ))}
                </dl>
                <p className="mt-2 text-2xs text-ink-faint">OpenStreetMap feature. No detailed model is mapped to it, so it cannot be opened for inspection.</p>
              </>
            ) : null}
          </aside>
        )}

        {/* The reconstruction on the map: same scenario, stage and time slider as the 3D view. */}
        {!inspecting && incident && scenario.detail && scenario.stages.length > 0 && (
          <div className="absolute bottom-7 left-1/2 z-10 w-[min(44rem,calc(100%-1rem))] -translate-x-1/2 space-y-1.5 rounded border border-line bg-surface/95 p-2 shadow-overlay" aria-label="Reconstruction on the map">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Box className="size-3.5 text-accent-text" aria-hidden />
              <label className="sr-only" htmlFor="area-scenario">Scenario</label>
              <select id="area-scenario" className={`${inlineSelectClass} !h-7 !py-0 text-xs`} value={scenario.detail.id} onChange={(e) => scenario.chooseScenario(Number(e.target.value))}>
                {scenario.scenarios.map((r) => <option key={r.id} value={r.id}>{r.scenario}</option>)}
              </select>
              {selectedActor && <span className="text-ink-soft">Selected: <span className="font-medium text-accent-text">{selectedActor.label}</span></span>}
              <Link to={casePath(caseId, 'reconstruction')} className={`ml-auto ${linkClass}`}>Open in 3D reconstruction</Link>
            </div>
            <StageTimeSlider
              stages={scenario.stages}
              events={workspace.events}
              notes={(scenario.detail.scene as { stages?: { stage_order: number; time: string }[] } | null)?.stages}
              onTogglePlay={scenario.togglePlay}
            />
          </div>
        )}

        {/* Selected case location (incident-side records only; nothing is invented here). */}
        {!inspecting && location && (
          <aside className="absolute bottom-44 right-2 z-10 w-72 rounded border border-line bg-surface/95 p-3 shadow-overlay" aria-label="Selected location">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-mono text-2xs uppercase tracking-wider text-ink-muted">{humanize(location.kind)} · {humanize(location.review_status)}</div>
                <div className="mt-0.5 text-body text-ink">{location.address}</div>
              </div>
              <button className={iconButtonClass} aria-label="Close" onClick={() => setPickedLocation(null)}><X className="size-4" /></button>
            </div>
            <ul className="mt-2 space-y-0.5 text-xs text-ink-soft">
              {linkedEvidence(workspace, 'location', location.id).map((e) => <li key={e.id}>{e.title} <span className="text-ink-faint">· {humanize(e.type)}</span></li>)}
              {linkedEvidence(workspace, 'location', location.id).length === 0 && <li className="text-ink-faint">No evidence linked to this location.</li>}
            </ul>
          </aside>
        )}

        {inspecting && selectedEntry?.model && (
          <Suspense fallback={<div className="absolute inset-0 z-20 bg-well"><LoadingState label="Loading building viewer…" /></div>}>
            <BuildingInspector key={selectedEntry.id} building={{ ...selectedEntry, model: selectedEntry.model }} markers={markers} onReturn={returnToArea} />
          </Suspense>
        )}
      </div>
    </section>
  );
};
