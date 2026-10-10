import React, { useMemo } from 'react';
import { SceneObject, Vec3 } from '@/types/api';
import { SceneViewerProps } from './sceneViewer';

const FOOTPRINTS: Record<string, [number, number]> = {
  hatchback: [4, 1.8],
  'delivery-van': [5, 2]
};
const DEFAULT_FOOTPRINT: [number, number] = [4, 2];
const GRID_M = 5;

const asVec3 = (value: unknown): Vec3 | null =>
  Array.isArray(value) && value.length === 3 && value.every((n) => typeof n === 'number') ? (value as Vec3) : null;

/**
 * A top-down plan of a stage: x is east, z is south, in metres. It stands in for the
 * 3D viewer (see sceneViewer.ts), so stage switching and object selection work now.
 */
export const SchematicSceneView: React.FC<SceneViewerProps> = ({
  reconstruction,
  stageId,
  selectedSceneObjectId,
  onSelectSceneObject
}) => {
  const stage = reconstruction.stages.find((s) => s.id === stageId);
  const annotations = reconstruction.annotations.filter((a) => a.stage_id === null || a.stage_id === stageId);

  // One frame for every stage, so objects visibly move when the stage changes.
  const bounds = useMemo(() => {
    const points: [number, number][] = reconstruction.stages.flatMap((s) => s.scene_objects.map((o) => [o.position[0], o.position[2]] as [number, number]));
    reconstruction.annotations.forEach((a) => {
      ['from', 'to', 'position', 'target'].forEach((key) => {
        const v = asVec3(a.data[key]);
        if (v) points.push([v[0], v[2]]);
      });
    });
    if (!points.length) points.push([0, 0]);
    const xs = points.map((p) => p[0]);
    const zs = points.map((p) => p[1]);
    const pad = 8;
    const minX = Math.min(...xs) - pad;
    const maxX = Math.max(...xs) + pad;
    const minZ = Math.min(...zs) - pad;
    const maxZ = Math.max(...zs) + pad;
    return { minX, minZ, width: maxX - minX, height: maxZ - minZ };
  }, [reconstruction]);

  const gridLines = [];
  for (let x = Math.ceil(bounds.minX / GRID_M) * GRID_M; x <= bounds.minX + bounds.width; x += GRID_M) {
    gridLines.push(<line key={`x${x}`} x1={x} y1={bounds.minZ} x2={x} y2={bounds.minZ + bounds.height} className="stroke-slate-800" strokeWidth={x === 0 ? 0.25 : 0.08} />);
  }
  for (let z = Math.ceil(bounds.minZ / GRID_M) * GRID_M; z <= bounds.minZ + bounds.height; z += GRID_M) {
    gridLines.push(<line key={`z${z}`} x1={bounds.minX} y1={z} x2={bounds.minX + bounds.width} y2={z} className="stroke-slate-800" strokeWidth={z === 0 ? 0.25 : 0.08} />);
  }

  const renderObject = (o: SceneObject) => {
    const [baseLength, baseWidth] = FOOTPRINTS[o.model_id] ?? DEFAULT_FOOTPRINT;
    const length = baseLength * o.scale[0];
    const width = baseWidth * o.scale[2];
    const selected = o.id === selectedSceneObjectId;
    const heading = (-o.rotation[1] * 180) / Math.PI;
    return (
      <g
        key={o.id}
        style={{
          transform: `translate(${o.position[0]}px, ${o.position[2]}px) rotate(${heading}deg)`,
          transition: 'transform 700ms ease-in-out'
        }}
        className="cursor-pointer"
        onClick={(e) => {
          e.stopPropagation();
          onSelectSceneObject(o.id);
        }}
        data-testid={`scene-object-${o.id}`}
        role="button"
        aria-label={o.label}
        aria-pressed={selected}
      >
        <rect
          x={-length / 2}
          y={-width / 2}
          width={length}
          height={width}
          rx={0.35}
          className={selected ? 'fill-cyan-400/40 stroke-cyan-300' : 'fill-slate-700/80 stroke-slate-300'}
          strokeWidth={selected ? 0.25 : 0.12}
        />
        {/* Front of the object */}
        <polygon points={`${length / 2 - 0.9},-0.5 ${length / 2 - 0.2},0 ${length / 2 - 0.9},0.5`} className="fill-amber-300" />
      </g>
    );
  };

  return (
    <svg
      viewBox={`${bounds.minX} ${bounds.minZ} ${bounds.width} ${bounds.height}`}
      className="w-full h-full bg-slate-950"
      onClick={() => onSelectSceneObject(null)}
      role="img"
      aria-label={`Plan of stage ${stage?.label ?? ''}`}
      data-testid="scene-schematic"
    >
      {gridLines}
      {annotations.map((a) => {
        const from = asVec3(a.data.from);
        const to = asVec3(a.data.to);
        const position = asVec3(a.data.position);
        const target = asVec3(a.data.target);
        const label = typeof a.data.label === 'string' ? a.data.label : '';
        if (a.kind === 'measurement' && from && to) {
          return (
            <g key={a.id}>
              <line x1={from[0]} y1={from[2]} x2={to[0]} y2={to[2]} className="stroke-amber-400" strokeWidth={0.15} strokeDasharray="0.6 0.4" />
              <text x={(from[0] + to[0]) / 2} y={(from[2] + to[2]) / 2 - 0.8} className="fill-amber-300" fontSize={1.2} textAnchor="middle">
                {label}
                {typeof a.data.length_m === 'number' ? ` ${a.data.length_m} m` : ''}
              </text>
            </g>
          );
        }
        if (a.kind === 'viewpoint' && position) {
          return (
            <g key={a.id}>
              {target && (
                <line x1={position[0]} y1={position[2]} x2={target[0]} y2={target[2]} className="stroke-purple-400" strokeWidth={0.1} strokeDasharray="0.4 0.4" />
              )}
              <circle cx={position[0]} cy={position[2]} r={0.6} className="fill-purple-400" />
              <text x={position[0]} y={position[2] - 1} className="fill-purple-300" fontSize={1.1} textAnchor="middle">
                {label}
              </text>
            </g>
          );
        }
        return null;
      })}
      {stage?.scene_objects.map(renderObject)}
      {stage?.scene_objects.map((o) => (
        <text
          key={`label-${o.id}`}
          x={o.position[0]}
          y={o.position[2] - 1.8}
          className="fill-slate-200 pointer-events-none"
          fontSize={1.2}
          textAnchor="middle"
          style={{ transition: 'x 700ms, y 700ms' }}
        >
          {o.label}
        </text>
      ))}
      <g transform={`translate(${bounds.minX + 3} ${bounds.minZ + 4})`} className="fill-slate-400">
        <polygon points="0,-2.2 0.8,0 -0.8,0" />
        <text y={1.6} fontSize={1.2} textAnchor="middle">
          N
        </text>
      </g>
      <text x={bounds.minX + bounds.width - 1} y={bounds.minZ + bounds.height - 1} className="fill-slate-500" fontSize={1} textAnchor="end">
        Grid {GRID_M} m · schematic until the 3D viewer lands
      </text>
    </svg>
  );
};
