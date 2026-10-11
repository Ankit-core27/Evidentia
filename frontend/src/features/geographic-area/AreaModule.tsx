import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Building2, ChevronLeft, ChevronRight, Crosshair, Maximize2, ScanSearch, X } from 'lucide-react';
import { ErrorState, LoadingState } from '@/components/shared/QueryState';
import { iconButtonClass, primaryButtonClass, smallButtonClass } from '@/components/shared/formStyles';
import { humanize } from '@/lib/format';
import { useAreaStore } from '@/stores/area';
import type { CaseWorkspace } from '@/types/api';
import { buildingMarkers, linkedEvidence } from '@/features/building-viewer/buildingMarkers';
import { BuildingEntry, distanceMetres, useBuildingManifest } from './buildingRegistry';
import { AreaStatus, AreaViewerHandle, CesiumAreaViewer } from './CesiumAreaViewer';

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
        <p className="text-xs text-ink-muted">{manifest.data?.area.name}</p>
      </div>

      <div className="relative h-[calc(100dvh-19.5rem)] min-h-[520px] overflow-hidden rounded-md border border-line bg-well">
        {manifest.isPending ? <LoadingState label="Loading area…" /> : (
          <CesiumAreaViewer ref={viewer} incident={incident} locations={locations} buildings={allBuildings} radiusM={radiusM}
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
          <div className="pointer-events-none absolute bottom-7 left-2 z-10 flex gap-1 font-mono text-2xs">
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

        {/* Selected case location (incident-side records only; nothing is invented here). */}
        {!inspecting && location && (
          <aside className="absolute bottom-7 right-2 z-10 w-72 rounded border border-line bg-surface/95 p-3 shadow-overlay" aria-label="Selected location">
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
