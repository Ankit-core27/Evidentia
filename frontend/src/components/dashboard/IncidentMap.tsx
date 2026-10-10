import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, MapPin } from 'lucide-react';
import { PriorityBadge } from '@/components/shared/Badges';
import { casePath } from '@/lib/caseModules';
import { formatDateTime, humanize } from '@/lib/format';
import { CasePriority, Id, IncidentPoint, IncidentType } from '@/types/api';

const W = 800;
const H = 340;
const PAD = 48;
const KM_PER_DEGREE = 111.32;

const PRIORITY_FILL: Record<CasePriority, string> = {
  critical: '#ef4444',
  high: '#f59e0b',
  medium: '#22d3ee',
  low: '#94a3b8'
};

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

  const filterButton = (value: IncidentType | null, label: string, count: number) => (
    <button
      key={label}
      onClick={() => setType(value)}
      aria-pressed={type === value}
      className={`px-2.5 py-1 rounded-lg whitespace-nowrap ${
        type === value ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold' : 'text-slate-400 hover:text-slate-200'
      }`}
    >
      {label} ({count})
    </button>
  );

  return (
    <section className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col" aria-label="Incident map">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-sm font-mono font-bold text-slate-200 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-cyan-400" />
            INCIDENT MAP
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">Where each case's incident happened, coloured by priority.</p>
        </div>
        {types.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px] font-mono" role="group" aria-label="Filter by incident type">
            {filterButton(null, 'All', points.length)}
            {types.map(([t, n]) => filterButton(t, humanize(t), n))}
          </div>
        )}
      </div>

      <div className="relative mt-4 h-[340px] w-full rounded-xl bg-slate-950 border border-slate-800/90 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-40" />
        {points.length === 0 ? (
          <p className="absolute inset-0 flex items-center justify-center text-xs text-slate-500 font-mono">No incident sites with coordinates yet.</p>
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
                  className="cursor-pointer focus:outline-none"
                >
                  <circle r={16} fill={PRIORITY_FILL[p.priority]} opacity={0.18} />
                  <circle r={7} fill={PRIORITY_FILL[p.priority]} stroke={isSelected ? '#e2e8f0' : '#020617'} strokeWidth={isSelected ? 3 : 2} />
                  <text x={13} y={4} className="font-mono" fontSize={11} fill={isSelected ? '#67e8f9' : '#cbd5e1'}>
                    {p.case_number}
                  </text>
                  <title>{`${p.case_number}: ${p.title}\n${p.address}`}</title>
                </g>
              );
            })}
            <g transform={`translate(${PAD / 2} ${H - PAD / 2})`} aria-label={`Scale: ${formatKm(bar.km)}`}>
              <line x1={0} x2={bar.width} y1={0} y2={0} stroke="#64748b" strokeWidth={2} />
              <line x1={0} x2={0} y1={-4} y2={4} stroke="#64748b" strokeWidth={2} />
              <line x1={bar.width} x2={bar.width} y1={-4} y2={4} stroke="#64748b" strokeWidth={2} />
              <text x={bar.width / 2} y={-8} textAnchor="middle" fontSize={10} fill="#94a3b8" className="font-mono">
                {formatKm(bar.km)}
              </text>
            </g>
          </svg>
        )}
      </div>

      {selected && (
        <div className="mt-3 bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3" data-testid="incident-map-selection">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono font-bold text-slate-100">{selected.title}</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-cyan-400">{humanize(selected.incident_type)}</span>
              <PriorityBadge priority={selected.priority} />
            </div>
            <div className="text-[11px] text-slate-400 font-mono mt-0.5">
              {selected.case_number} · {selected.address}
              {selected.incident_at && ` · ${formatDateTime(selected.incident_at)}`}
            </div>
          </div>
          <Link
            to={casePath(selected.case_id)}
            className="px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-mono flex items-center gap-1 shrink-0"
          >
            Open case <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}
      {!selected && points.length > 0 && <p className="mt-3 text-[11px] text-slate-500 font-mono">Select a pin to see its case.</p>}
    </section>
  );
};
