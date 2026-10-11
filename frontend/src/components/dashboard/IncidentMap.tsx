import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PriorityBadge } from '@/components/shared/Badges';
import { FilterChips } from '@/components/shared/Segmented';
import { SectionHeader } from '@/components/shared/PageHeader';
import { secondaryButtonClass } from '@/components/shared/formStyles';
import { casePath } from '@/lib/caseModules';
import { formatDateTime, humanize } from '@/lib/format';
import { CasePriority, Id, IncidentPoint, IncidentType } from '@/types/api';

const W = 800;
const H = 340;
const PAD = 48;
const KM_PER_DEGREE = 111.32;

const PRIORITY_FILL: Record<CasePriority, string> = {
  critical: 'fill-danger',
  high: 'fill-warn',
  medium: 'fill-info',
  low: 'fill-ink-muted'
};

const PRIORITY_HALO: Record<CasePriority, string> = {
  critical: 'fill-danger/15',
  high: 'fill-warn/15',
  medium: 'fill-info/15',
  low: 'fill-ink-muted/15'
};

const PRIORITY_LEGEND: CasePriority[] = ['critical', 'high', 'medium', 'low'];

/**
 * Equirectangular projection of the incident sites into the panel, scaled to fit all of
 * them with the same scale on both axes, so distances between pins are true to the map.
 */
const project = (points: IncidentPoint[]) => {
  const lat0 = points.reduce((sum, p) => sum + p.lat, 0) / Math.max(points.length, 1);
  const k = Math.cos((lat0 * Math.PI) / 180);
  const xs = points.map((p) => p.lng * k);
  const ys = points.map((p) => p.lat);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  // A lone site, or sites on one street, still get a sensible scale (about 2 km across).
  const spanX = Math.max(maxX - minX, 0.018);
  const spanY = Math.max(maxY - minY, 0.018 * (H / W));
  const scale = Math.min((W - 2 * PAD) / spanX, (H - 2 * PAD) / spanY);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return {
    at: (p: IncidentPoint) => ({ x: W / 2 + (p.lng * k - cx) * scale, y: H / 2 - (p.lat - cy) * scale }),
    kmPerUnit: KM_PER_DEGREE / scale
  };
};

/** A round scale-bar length (1, 2 or 5 × 10^n km) about a sixth of the panel wide. */
const scaleBar = (kmPerUnit: number) => {
  const target = (W / 6) * kmPerUnit;
  const magnitude = 10 ** Math.floor(Math.log10(target));
  const km = [5, 2, 1].map((m) => m * magnitude).find((v) => v <= target) ?? magnitude;
  return { km, width: km / kmPerUnit };
};

const formatKm = (km: number) => (km >= 1 ? `${km} km` : `${Math.round(km * 1000)} m`);

/** Incident sites of every case (GET /api/dashboard incident_points), filterable by incident type. */
export const IncidentMap: React.FC<{ points: IncidentPoint[] }> = ({ points }) => {
  const [type, setType] = useState<IncidentType | null>(null);
  const [selectedId, setSelectedId] = useState<Id | null>(null);

  const types = useMemo(() => {
    const counts = new Map<IncidentType, number>();
    points.forEach((p) => counts.set(p.incident_type, (counts.get(p.incident_type) ?? 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [points]);

  const shown = type ? points.filter((p) => p.incident_type === type) : points;
  // Project every point, so filtering doesn't rescale the map under the investigator.
  const projection = useMemo(() => project(points), [points]);
  const bar = scaleBar(projection.kmPerUnit);
  const selected = shown.find((p) => p.case_id === selectedId) ?? null;

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

      <div className="relative h-[300px] lg:h-[340px] w-full rounded-md bg-well border border-line overflow-hidden">
        {/* A plain reference grid: there is no base map yet, only true-to-scale positions. */}
        <div className="absolute inset-0 bg-[linear-gradient(var(--color-line)_1px,transparent_1px),linear-gradient(90deg,var(--color-line)_1px,transparent_1px)] [background-size:40px_40px] opacity-50" />
        {points.length === 0 ? (
          <p className="absolute inset-0 flex items-center justify-center text-body text-ink-muted">No incident sites with coordinates yet.</p>
        ) : (
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="absolute inset-0 w-full h-full" data-testid="incident-map">
            {shown.map((p) => {
              const { x, y } = projection.at(p);
              const isSelected = p.case_id === selectedId;
              return (
                <g
                  key={`${p.case_id}-${p.lat}-${p.lng}`}
                  transform={`translate(${x} ${y})`}
                  role="button"
                  tabIndex={0}
                  aria-label={`${p.case_number}: ${p.title}`}
                  aria-pressed={isSelected}
                  data-case-id={p.case_id}
                  onClick={() => setSelectedId(isSelected ? null : p.case_id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedId(isSelected ? null : p.case_id);
                    }
                  }}
                  className="group cursor-pointer outline-none"
                >
                  <circle r={14} strokeWidth={2} className={`${PRIORITY_HALO[p.priority]} stroke-transparent group-focus-visible:stroke-accent`} />
                  <circle r={6} className={`${PRIORITY_FILL[p.priority]} ${isSelected ? 'stroke-ink' : 'stroke-well'}`} strokeWidth={isSelected ? 2.5 : 2} />
                  <text x={12} y={4} fontSize={11} className={`font-mono ${isSelected ? 'fill-ink' : 'fill-ink-soft'}`}>
                    {p.case_number}
                  </text>
                  <title>{`${p.case_number}: ${p.title}\n${p.address}`}</title>
                </g>
              );
            })}
            <g transform={`translate(${PAD / 2} ${H - PAD / 2})`} aria-label={`Scale: ${formatKm(bar.km)}`} className="stroke-ink-muted">
              <line x1={0} x2={bar.width} y1={0} y2={0} strokeWidth={1.5} />
              <line x1={0} x2={0} y1={-4} y2={4} strokeWidth={1.5} />
              <line x1={bar.width} x2={bar.width} y1={-4} y2={4} strokeWidth={1.5} />
              <text x={bar.width / 2} y={-8} textAnchor="middle" fontSize={10} className="font-mono fill-ink-muted stroke-none">
                {formatKm(bar.km)}
              </text>
            </g>
          </svg>
        )}
        <ul className="absolute right-2 bottom-2 flex gap-3 px-2 py-1 rounded bg-well/90 text-2xs text-ink-muted" aria-label="Pin colour: priority">
          {PRIORITY_LEGEND.map((pr) => (
            <li key={pr} className="flex items-center gap-1">
              <svg className="size-2" viewBox="0 0 8 8" aria-hidden>
                <circle cx={4} cy={4} r={4} className={PRIORITY_FILL[pr]} />
              </svg>
              {humanize(pr)}
            </li>
          ))}
        </ul>
      </div>

      {selected ? (
        <div
          className="px-3 py-2.5 rounded-md border border-line bg-surface flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
          data-testid="incident-map-selection"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-body font-medium text-ink">{selected.title}</span>
              <PriorityBadge priority={selected.priority} />
            </div>
            <div className="text-xs text-ink-muted mt-0.5">
              <span className="font-mono">{selected.case_number}</span> · {humanize(selected.incident_type)} · {selected.address}
              {selected.incident_at && ` · ${formatDateTime(selected.incident_at)}`}
            </div>
          </div>
          <Link to={casePath(selected.case_id)} className={`${secondaryButtonClass} shrink-0`}>
            Open case
          </Link>
        </div>
      ) : (
        points.length > 0 && <p className="text-xs text-ink-muted">Select a pin to see its case.</p>
      )}
    </section>
  );
};
