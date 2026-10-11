import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Expand, Shrink, ZoomIn, ZoomOut } from 'lucide-react';
import { PriorityBadge } from '@/components/shared/Badges';
import { FilterChips } from '@/components/shared/Segmented';
import { SectionHeader } from '@/components/shared/PageHeader';
import { secondaryButtonClass } from '@/components/shared/formStyles';
import { casePath } from '@/lib/caseModules';
import { formatDateTime, humanize } from '@/lib/format';
import { CasePriority, Id, IncidentPoint, IncidentType } from '@/types/api';
import { RISK_AREAS, RISK_REGION, RiskArea, RiskBand, riskBand } from './riskAreas';

// CARTO's dark street map of OpenStreetMap data, with place and road names. Needs no key.
const BASE_MAP_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

// Leaflet draws the circles as SVG paths; these classes override its stroke and fill attributes.
const RISK_PATH: Record<RiskBand, string> = {
  high: 'stroke-danger fill-danger/25 hover:fill-danger/45',
  elevated: 'stroke-warn fill-warn/20 hover:fill-warn/40',
  moderate: 'stroke-info fill-info/15 hover:fill-info/35'
};

const RISK_SWATCH: Record<RiskBand, string> = {
  high: 'border-danger bg-danger/25',
  elevated: 'border-warn bg-warn/20',
  moderate: 'border-info bg-info/15'
};

const RISK_LEGEND: { band: RiskBand; label: string }[] = [
  { band: 'high', label: 'High 80+' },
  { band: 'elevated', label: 'Elevated 60–79' },
  { band: 'moderate', label: 'Moderate' }
];

const PRIORITY_DOT: Record<CasePriority, string> = {
  critical: 'bg-danger',
  high: 'bg-warn',
  medium: 'bg-info',
  low: 'bg-ink-muted'
};

const PRIORITY_LEGEND: CasePriority[] = ['critical', 'high', 'medium', 'low'];

const MAX_CRIMES = Math.max(...RISK_AREAS.map((a) => a.crimes));

/** Circle area in proportion to crimes, so the busiest area has the largest circle by area, not radius. */
const radiusFor = (crimes: number) => Math.max(12, 34 * Math.sqrt(crimes / MAX_CRIMES));

const mapButton = 'flex size-9 items-center justify-center text-accent-text hover:bg-raised hover:text-ink transition-colors';

const areaTooltip = (a: RiskArea) => {
  const el = document.createElement('div');
  const head = el.appendChild(document.createElement('div'));
  const name = head.appendChild(document.createElement('strong'));
  name.className = 'font-semibold text-ink';
  name.textContent = a.name;
  const division = head.appendChild(document.createElement('span'));
  division.className = 'text-ink-muted';
  division.textContent = ` (${a.division})`;
  for (const [label, value] of [
    ['Crimes', a.crimes],
    ['Risk', a.risk],
    ['Officers', a.officers]
  ] as const) {
    el.appendChild(document.createElement('div')).textContent = `${label}: ${value}`;
  }
  return el;
};

/** A priority dot with the case number beside it; aria-pressed (set per render) marks the selected pin. */
const pinIcon = (p: IncidentPoint) => {
  const label = document.createElement('span');
  label.className =
    'absolute left-full top-1/2 -translate-y-1/2 ml-1.5 px-1 rounded bg-canvas/80 font-mono text-2xs whitespace-nowrap text-ink-soft group-aria-pressed:bg-canvas group-aria-pressed:text-ink';
  label.textContent = p.case_number;
  return L.divIcon({
    className: `group rounded-full border-2 border-well aria-pressed:border-ink ${PRIORITY_DOT[p.priority]}`,
    iconSize: [14, 14],
    html: label
  });
};

type Pin = { point: IncidentPoint; marker: L.Marker };

const SelectedCase: React.FC<{ point: IncidentPoint; className?: string }> = ({ point, className = '' }) => (
  <div
    className={`px-3 py-2.5 rounded-md border border-line bg-surface flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${className}`}
    data-testid="incident-map-selection"
  >
    <div className="min-w-0">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-body font-medium text-ink">{point.title}</span>
        <PriorityBadge priority={point.priority} />
      </div>
      <div className="text-xs text-ink-muted mt-0.5">
        <span className="font-mono">{point.case_number}</span> · {humanize(point.incident_type)} · {point.address}
        {point.incident_at && ` · ${formatDateTime(point.incident_at)}`}
      </div>
    </div>
    <Link to={casePath(point.case_id)} className={`${secondaryButtonClass} shrink-0`}>
      Open case
    </Link>
  </div>
);

/**
 * Risk heatmap of the city around the reconstruction site, with the incident site of every case
 * (GET /api/dashboard incident_points) pinned on top and filterable by incident type.
 */
export const IncidentMap: React.FC<{ points: IncidentPoint[] }> = ({ points }) => {
  const [type, setType] = useState<IncidentType | null>(null);
  const [selectedId, setSelectedId] = useState<Id | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const pinLayer = useRef<L.LayerGroup | null>(null);
  const pins = useRef<Pin[]>([]);

  const types = useMemo(() => {
    const counts = new Map<IncidentType, number>();
    points.forEach((p) => counts.set(p.incident_type, (counts.get(p.incident_type) ?? 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [points]);

  const shown = type ? points.filter((p) => p.incident_type === type) : points;
  const selected = shown.find((p) => p.case_id === selectedId) ?? null;

  // The map, its tiles and the area circles. Built once, so refetches never move the view.
  useEffect(() => {
    const el = mapRef.current;
    if (!el) return;
    const m = L.map(el, { zoomControl: false, attributionControl: false, scrollWheelZoom: false, zoomSnap: 0.5, minZoom: 3, maxZoom: 18 });
    L.control.attribution({ prefix: false, position: 'bottomright' }).addTo(m);
    L.control.scale({ imperial: false, position: 'topleft' }).addTo(m);
    L.tileLayer(BASE_MAP_URL, { maxZoom: 18, subdomains: 'abcd', attribution: '© OpenStreetMap contributors © CARTO' }).addTo(m);

    RISK_AREAS.forEach((a) => {
      const radius = radiusFor(a.crimes);
      L.circleMarker([a.lat, a.lng], { radius, weight: 2, opacity: 1, fillOpacity: 1, className: RISK_PATH[riskBand(a.risk)] })
        .bindTooltip(areaTooltip(a), { direction: 'top', offset: [0, -radius], opacity: 1, className: 'risk-map-tooltip' })
        .addTo(m);
    });
    pinLayer.current = L.layerGroup().addTo(m);

    // Centre on the reconstruction site, zoomed out just far enough to show every area and
    // incident site around it (each spot is mirrored through the centre to keep it centred).
    const { lat, lng } = RISK_REGION.center;
    const spots = [...RISK_AREAS, ...points];
    const around = L.latLngBounds(spots.flatMap((s): L.LatLngTuple[] => [[s.lat, s.lng], [2 * lat - s.lat, 2 * lng - s.lng]]));
    m.setView([lat, lng], Math.min(m.getBoundsZoom(around, false, L.point(72, 72)), 15));

    const resize = new ResizeObserver(() => m.invalidateSize());
    resize.observe(el);
    map.current = m;
    return () => {
      resize.disconnect();
      m.remove();
      map.current = null;
      pinLayer.current = null;
    };
  }, []);

  // One marker per incident site.
  useEffect(() => {
    const built = points.map((point) => {
      const marker = L.marker([point.lat, point.lng], {
        icon: pinIcon(point),
        title: `${point.case_number}: ${point.title}\n${point.address}`,
        riseOnHover: true
      });
      const toggle = () => setSelectedId((id) => (id === point.case_id ? null : point.case_id));
      marker.on('click', toggle);
      // Leaflet makes the pins focusable but doesn't act on Enter or Space itself.
      marker.on('keydown', (e) => {
        const key = (e as L.LeafletKeyboardEvent).originalEvent;
        if (key.key === 'Enter' || key.key === ' ') {
          key.preventDefault();
          toggle();
        }
      });
      return { point, marker };
    });
    pins.current = built;
    return () => built.forEach(({ marker }) => (pinLayer.current ? pinLayer.current.removeLayer(marker) : marker.remove()));
  }, [points]);

  // Show the pins of the chosen incident type and mark the selected one.
  useEffect(() => {
    const layer = pinLayer.current;
    if (!layer) return;
    pins.current.forEach(({ point, marker }) => {
      const isSelected = point.case_id === selectedId;
      if (!type || point.incident_type === type) layer.addLayer(marker);
      else layer.removeLayer(marker);
      marker.setZIndexOffset(isSelected ? 1000 : 0);
      const icon = marker.getElement();
      if (!icon) return;
      icon.setAttribute('aria-label', `${point.case_number}: ${point.title}`);
      icon.setAttribute('aria-pressed', String(isSelected));
      icon.dataset.caseId = String(point.case_id);
    });
  }, [points, type, selectedId]);

  // Scroll-wheel zoom only in full screen, so the dashboard still scrolls past the map.
  useEffect(() => {
    const onChange = () => {
      const on = document.fullscreenElement === frameRef.current;
      setFullscreen(on);
      if (on) map.current?.scrollWheelZoom.enable();
      else map.current?.scrollWheelZoom.disable();
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void frameRef.current?.requestFullscreen?.();
  };

  return (
    <section className="space-y-2" aria-label="Incident map">
      <SectionHeader
        title="Incident sites"
        count={points.length}
        as="h2"
        action={
          types.length > 1 && (
            <FilterChips
              label="Filter by incident type"
              value={type ?? 'all'}
              onChange={(v) => setType(v === 'all' ? null : (v as IncidentType))}
              options={[{ value: 'all', label: 'All', count: points.length }, ...types.map(([t, n]) => ({ value: t, label: humanize(t), count: n }))]}
            />
          )
        }
      />

      <div
        ref={frameRef}
        className={`relative isolate w-full overflow-hidden bg-well ${fullscreen ? '' : 'h-[340px] sm:h-[400px] lg:h-[440px] rounded-md border border-line'}`}
      >
        <div ref={mapRef} className="risk-map absolute inset-0 z-0" data-testid="incident-map" />

        <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-full border border-line-strong bg-canvas/85 px-3 py-1 text-2xs font-medium uppercase tracking-[0.12em] text-ink-soft backdrop-blur">
          Risk heatmap · {RISK_REGION.name}
        </div>

        <div className="absolute right-3 top-3 z-10 flex flex-col gap-2">
          <div className="flex flex-col overflow-hidden rounded-md border border-line-strong bg-canvas/85 backdrop-blur divide-y divide-line-strong">
            <button type="button" className={mapButton} onClick={() => map.current?.zoomIn()} aria-label="Zoom in" title="Zoom in">
              <ZoomIn className="size-4" aria-hidden />
            </button>
            <button type="button" className={mapButton} onClick={() => map.current?.zoomOut()} aria-label="Zoom out" title="Zoom out">
              <ZoomOut className="size-4" aria-hidden />
            </button>
          </div>
          {document.fullscreenEnabled && (
            <button
              type="button"
              className={`${mapButton} rounded-md border border-line-strong bg-canvas/85 backdrop-blur`}
              onClick={toggleFullscreen}
              aria-label={fullscreen ? 'Exit full screen' : 'Full screen'}
              title={fullscreen ? 'Exit full screen' : 'Full screen'}
            >
              {fullscreen ? <Shrink className="size-4" aria-hidden /> : <Expand className="size-4" aria-hidden />}
            </button>
          )}
        </div>

        <div className="pointer-events-none absolute left-3 bottom-9 sm:bottom-3 z-10 max-w-[calc(100%-1.5rem)] space-y-1 rounded-md border border-line-strong bg-canvas/85 px-2.5 py-1.5 text-2xs text-ink-muted backdrop-blur">
          <ul className="flex flex-wrap items-center gap-x-3 gap-y-1" aria-label="Circle colour: area risk score; circle size: crimes">
            <li className="text-ink-soft">Area risk</li>
            {RISK_LEGEND.map(({ band, label }) => (
              <li key={band} className="flex items-center gap-1">
                <span className={`size-2.5 rounded-full border ${RISK_SWATCH[band]}`} aria-hidden />
                {label}
              </li>
            ))}
          </ul>
          <ul className="flex flex-wrap items-center gap-x-3 gap-y-1" aria-label="Pin colour: case priority">
            <li className="text-ink-soft">Cases</li>
            {PRIORITY_LEGEND.map((pr) => (
              <li key={pr} className="flex items-center gap-1">
                <span className={`size-2 rounded-full ${PRIORITY_DOT[pr]}`} aria-hidden />
                {humanize(pr)}
              </li>
            ))}
          </ul>
        </div>

        {fullscreen && selected && <SelectedCase point={selected} className="absolute left-1/2 top-3 z-10 w-[min(36rem,calc(100%-8rem))] -translate-x-1/2 shadow-overlay" />}
      </div>

      <ul className="sr-only" aria-label="Area risk figures">
        {RISK_AREAS.map((a) => (
          <li key={a.name}>
            {a.name}, {a.division} division: {a.crimes} crimes in the last 30 days, risk {a.risk}, {a.officers} officers
          </li>
        ))}
      </ul>

      {selected ? (
        <SelectedCase point={selected} />
      ) : (
        <p className="text-xs text-ink-muted">
          Circle size shows crimes in the last 30 days and colour the area's risk score; hover an area for its figures. Area figures are illustrative.{' '}
          {points.length > 0 ? 'Select a pin to see its case.' : 'No incident sites with coordinates yet.'}
        </p>
      )}
    </section>
  );
};
