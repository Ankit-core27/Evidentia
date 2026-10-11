import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import { Grid, OrbitControls, useGLTF } from '@react-three/drei';
import { ArrowLeft, Crosshair, Eye, EyeOff, Pause, Play, RotateCcw } from 'lucide-react';
import { Box3, Group, MeshStandardMaterial, Object3D, Vector3 } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { iconButtonClass, smallButtonClass } from '@/components/shared/formStyles';
import { humanize } from '@/lib/format';
import type { BuildingEntry } from '@/features/geographic-area/buildingRegistry';
import type { BuildingMarker } from './buildingMarkers';
import {
  COMPONENT_KINDS,
  ComponentKind,
  Dissection,
  Part,
  STAGES,
  analyse,
  applyExplosion,
  applyVisibility,
  dispose,
  highlight,
  ownerPart,
  partSize,
  stageAt
} from './dissection';

interface Props {
  building: BuildingEntry & { model: NonNullable<BuildingEntry['model']> };
  markers: BuildingMarker[];
  onReturn: () => void;
}

const ALL_KINDS = Object.fromEntries(COMPONENT_KINDS.map((k) => [k.kind, true])) as Record<ComponentKind, boolean>;
const HIGHLIGHT = new MeshStandardMaterial({ color: '#37aebd', emissive: '#37aebd', emissiveIntensity: 0.35, roughness: 0.5 });
/** Explosion progress per second, so a full dissection takes just over a second. */
const SPEED = 0.8;

class ModelBoundary extends React.Component<React.PropsWithChildren<{ onError: (message: string) => void }>, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) { this.props.onError(error.message); }
  render() { return this.state.failed ? null : this.props.children; }
}

export const BuildingInspector: React.FC<Props> = ({ building, markers, onReturn }) => {
  const [dissection, setDissection] = useState<Dissection | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [target, setTarget] = useState(0);
  const [shown, setShown] = useState(0);
  const [level, setLevel] = useState<number | 'all'>('all');
  const [kinds, setKinds] = useState(ALL_KINDS);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const [isolated, setIsolated] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedMarker, setSelectedMarker] = useState<number | null>(null);
  const controls = useRef<OrbitControlsImpl | null>(null);
  const frameRequest = useRef(0);

  const part = selected && dissection ? dissection.byName.get(selected) ?? null : null;
  const stage = isolated || hidden.size > 0 || level !== 'all' ? { n: 6, label: 'Inspecting' } : stageAt(shown);

  useEffect(() => {
    if (dissection) applyVisibility(dissection, { level, kinds, hidden, isolated });
  }, [dissection, level, kinds, hidden, isolated]);
  useEffect(() => {
    if (dissection) highlight(dissection, part, HIGHLIGHT);
  }, [dissection, part]);

  const reset = () => {
    setTarget(0);
    setLevel('all');
    setKinds(ALL_KINDS);
    setHidden(new Set());
    setIsolated(null);
    setSelected(null);
    setSelectedMarker(null);
    frameRequest.current++;
  };
  const toggleHidden = (name: string) =>
    setHidden((h) => {
      const next = new Set(h);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  const listed = useMemo(() => {
    if (!dissection) return [];
    return dissection.parts.filter((p) => p.kind !== 'floor' && p.kind !== 'slab' && (level === 'all' || p.level === level));
  }, [dissection, level]);

  const marker = markers.find((m) => m.id === selectedMarker) ?? null;

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-well" data-testid="building-inspector">
      {/* Toolbar: return, identity, dissection stages and the explosion slider. */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface/95 px-2 py-1.5">
        <button className={smallButtonClass} onClick={onReturn}><ArrowLeft className="size-3.5" aria-hidden />Return to area</button>
        <div className="min-w-0 px-1">
          <div className="truncate text-body font-medium text-ink">{building.name}</div>
          <div className="truncate font-mono text-2xs text-ink-muted">{building.use} · {building.model.source} model · {building.floors.length} floors</div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1" role="group" aria-label="Dissection stage">
          {STAGES.map((s) => (
            <button key={s.n} onClick={() => setTarget(s.at)} aria-pressed={stage.n === s.n}
              className={`h-7 rounded px-2 font-mono text-2xs transition-colors ${stage.n === s.n ? 'bg-accent/15 text-accent-text ring-1 ring-accent/50' : 'text-ink-muted hover:bg-raised hover:text-ink'}`}>
              {s.n} · {s.label}
            </button>
          ))}
          <span className={`h-7 rounded px-2 font-mono text-2xs leading-7 ${stage.n === 6 ? 'bg-accent/15 text-accent-text ring-1 ring-accent/50' : 'text-ink-faint'}`}>6 · Inspect</span>
        </div>
        <div className="flex items-center gap-2">
          <button className={iconButtonClass} aria-label={target < 1 ? 'Play dissection' : 'Reassemble'} onClick={() => setTarget(target < 1 ? 1 : 0)} disabled={!dissection}>
            {target < 1 ? <Play className="size-4" /> : <Pause className="size-4" />}
          </button>
          <label className="flex items-center gap-2 font-mono text-2xs text-ink-muted">
            Explode
            <input type="range" min={0} max={100} value={Math.round(target * 100)} onChange={(e) => setTarget(Number(e.target.value) / 100)}
              className="w-32 accent-[var(--color-accent)]" aria-label="Explosion progress" disabled={!dissection} />
            <span className="w-8 text-right text-ink-soft">{Math.round(shown * 100)}%</span>
          </label>
          <button className={smallButtonClass} onClick={reset} disabled={!dissection}><RotateCcw className="size-3.5" aria-hidden />Reset</button>
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        <ModelBoundary onError={setLoadError}>
          <Canvas dpr={[1, 1.5]} camera={{ position: [24, 18, 26], fov: 40, near: 0.1, far: 600 }} shadows={false}
            onPointerMissed={() => { setSelected(null); setSelectedMarker(null); }}
            fallback={<p className="p-8 text-warn">WebGL is unavailable, so the building model cannot be shown.</p>}>
            <color attach="background" args={['#0b0d0e']} />
            <hemisphereLight args={['#dfe7ea', '#1b1f22', 1.2]} />
            <directionalLight position={[18, 30, 12]} intensity={2.2} />
            <directionalLight position={[-14, 10, -18]} intensity={0.8} color="#cfe2e6" />
            <Grid args={[200, 200]} position={[0, -0.01, 0]} cellSize={1} sectionSize={5} cellColor="#1e2226" sectionColor="#2b3238" fadeDistance={120} infiniteGrid />
            <Suspense fallback={null}>
              <Model url={building.model.url} target={target} onShown={setShown} onReady={setDissection}
                onSelect={(name) => { setSelected(name); setSelectedMarker(null); }} controls={controls} frameRequest={frameRequest} />
              {dissection && <Markers dissection={dissection} markers={markers} selected={selectedMarker} onSelect={(id) => { setSelectedMarker(id); setSelected(null); }} />}
            </Suspense>
            <OrbitControls ref={controls} makeDefault enableDamping maxPolarAngle={Math.PI * 0.49} />
          </Canvas>
        </ModelBoundary>
        {!dissection && !loadError && <div role="status" className="pointer-events-none absolute inset-0 flex items-center justify-center text-body text-ink-soft">Loading building model…</div>}
        {loadError && (
          <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-8 text-center">
            <p className="text-body text-warn">The detailed model for {building.name} could not be loaded. {loadError}</p>
            <button className={smallButtonClass} onClick={onReturn}><ArrowLeft className="size-3.5" aria-hidden />Return to area</button>
          </div>
        )}

        {dissection && (
          <aside className="absolute left-2 top-2 bottom-2 flex w-60 flex-col overflow-hidden rounded border border-line bg-surface/95 shadow-overlay" aria-label="Floors and components">
            <div className="border-b border-line p-2">
              <div className="mb-1 font-mono text-2xs uppercase tracking-wider text-ink-muted">Floors</div>
              <div className="flex flex-wrap gap-1">
                <FloorChip active={level === 'all'} onClick={() => setLevel('all')}>All</FloorChip>
                {dissection.floors.map((f) => (
                  <FloorChip key={f.level} active={level === f.level} onClick={() => setLevel(f.level)}>{f.label.split(' · ')[0]}</FloorChip>
                ))}
              </div>
            </div>
            <div className="border-b border-line p-2">
              <div className="mb-1 font-mono text-2xs uppercase tracking-wider text-ink-muted">Show</div>
              <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                {COMPONENT_KINDS.filter((k) => dissection.parts.some((p) => p.kind === k.kind)).map((k) => (
                  <label key={k.kind} className="flex items-center gap-1.5 text-xs text-ink-soft">
                    <input type="checkbox" checked={kinds[k.kind]} onChange={(e) => setKinds({ ...kinds, [k.kind]: e.target.checked })} className="accent-[var(--color-accent)]" />
                    {k.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between px-2 pt-2">
              <span className="font-mono text-2xs uppercase tracking-wider text-ink-muted">Components · {listed.length}</span>
              {(hidden.size > 0 || isolated) && (
                <button className="text-2xs text-accent-text hover:underline" onClick={() => { setHidden(new Set()); setIsolated(null); }}>Restore all</button>
              )}
            </div>
            <ul className="min-h-0 flex-1 overflow-y-auto p-1 text-xs">
              {listed.map((p) => (
                <li key={p.name} className={`group flex items-center gap-1 rounded px-1.5 py-0.5 ${selected === p.name ? 'bg-accent/15 text-ink' : 'text-ink-soft hover:bg-raised'}`}>
                  <button className="min-w-0 flex-1 truncate text-left" onClick={() => setSelected(p.name)} title={p.name}>
                    <span className={hidden.has(p.name) ? 'text-ink-faint line-through' : ''}>{p.label}</span>
                    <span className="ml-1 font-mono text-2xs text-ink-faint">{p.kind}{p.level !== null && level === 'all' ? ` · L${p.level}` : ''}</span>
                  </button>
                  <button className="text-ink-faint hover:text-ink" aria-label={hidden.has(p.name) ? `Show ${p.label}` : `Hide ${p.label}`} onClick={() => toggleHidden(p.name)}>
                    {hidden.has(p.name) ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5 opacity-0 group-hover:opacity-100" />}
                  </button>
                </li>
              ))}
            </ul>
          </aside>
        )}

        {dissection && part && (
          <PartPanel part={part} dissection={dissection} isolated={isolated === part.name} hidden={hidden.has(part.name)}
            markers={markers.filter((m) => m.component === part.name)}
            onIsolate={() => setIsolated(isolated === part.name ? null : part.name)}
            onHide={() => toggleHidden(part.name)}
            onClose={() => setSelected(null)} />
        )}
        {marker && (
          <aside className="absolute right-2 top-2 w-72 rounded border border-line bg-surface/95 p-3 shadow-overlay" aria-label="Evidence marker">
            <div className="font-mono text-2xs uppercase tracking-wider text-ink-muted">Evidence position</div>
            <div className="mt-1 text-body font-medium text-ink">{marker.label}</div>
            <div className="mt-1 text-xs text-ink-muted">On {dissection?.byName.get(marker.component)?.label ?? marker.component} · {humanize(marker.location.review_status)}</div>
            <ul className="mt-2 space-y-1 text-xs text-ink-soft">
              {marker.evidence.length === 0 ? <li className="text-ink-faint">No evidence linked to this position.</li> : marker.evidence.map((e) => <li key={e.id}>{e.title} <span className="text-ink-faint">· {humanize(e.type)}</span></li>)}
            </ul>
          </aside>
        )}

        {dissection && (
          <div className="pointer-events-none absolute bottom-2 right-2 max-w-sm rounded bg-surface/90 px-2 py-1 text-2xs text-ink-muted">
            {building.note} {markers.length === 0 && 'No evidence has been placed in this building.'}
          </div>
        )}
        {dissection && (
          <button className={`${iconButtonClass} absolute bottom-2 left-64 bg-surface/90`} aria-label="Frame building" onClick={() => frameRequest.current++}>
            <Crosshair className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
};

const FloorChip: React.FC<React.PropsWithChildren<{ active: boolean; onClick: () => void }>> = ({ active, onClick, children }) => (
  <button onClick={onClick} aria-pressed={active}
    className={`h-6 rounded px-2 text-xs ${active ? 'bg-accent text-accent-fg' : 'bg-raised text-ink-soft hover:bg-hover hover:text-ink'}`}>
    {children}
  </button>
);

const PartPanel: React.FC<{
  part: Part;
  dissection: Dissection;
  isolated: boolean;
  hidden: boolean;
  markers: BuildingMarker[];
  onIsolate: () => void;
  onHide: () => void;
  onClose: () => void;
}> = ({ part, dissection, isolated, hidden, markers, onIsolate, onHide, onClose }) => {
  const u = part.object.userData;
  const size = partSize(part);
  const floor = part.level !== null ? dissection.floors.find((f) => f.level === part.level)?.label : null;
  const room = typeof u.room === 'string' ? dissection.byName.get(u.room)?.label : null;
  const rows: [string, string][] = [
    ['Type', part.wallType ? `${part.wallType} wall` : humanize(part.kind)],
    ...(floor ? [['Floor', floor] as [string, string]] : []),
    ...(typeof u.side === 'string' ? [['Side', humanize(u.side)] as [string, string]] : []),
    ...(typeof u.room_type === 'string' ? [['Room type', humanize(u.room_type)] as [string, string]] : []),
    ...(typeof u.area_m2 === 'number' ? [['Floor area', `${u.area_m2} m²`] as [string, string]] : []),
    ...(room ? [['In room', room] as [string, string]] : []),
    ...(typeof u.furniture_type === 'string' ? [['Item', humanize(u.furniture_type)] as [string, string]] : []),
    ...(typeof u.material === 'string' ? [['Material', u.material] as [string, string]] : []),
    ...(typeof u.steps === 'number' ? [['Steps', String(u.steps)] as [string, string]] : []),
    ['Size', `${size.x.toFixed(2)} × ${size.z.toFixed(2)} × ${size.y.toFixed(2)} m`],
    ['Node', part.name]
  ];
  return (
    <aside className="absolute right-2 top-2 w-72 rounded border border-line bg-surface/95 p-3 shadow-overlay" aria-label="Selected component">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-mono text-2xs uppercase tracking-wider text-ink-muted">Component</div>
          <div className="mt-0.5 text-body font-medium text-ink">{part.label}</div>
        </div>
        <button className="text-xs text-ink-muted hover:text-ink" onClick={onClose} aria-label="Close">✕</button>
      </div>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
        {rows.map(([k, v]) => (
          <React.Fragment key={k}><dt className="text-ink-muted">{k}</dt><dd className="truncate text-ink-soft" title={v}>{v}</dd></React.Fragment>
        ))}
      </dl>
      <div className="mt-2 text-xs text-ink-muted">{markers.length === 0 ? 'No evidence recorded on this component.' : `${markers.length} evidence position${markers.length === 1 ? '' : 's'} on this component.`}</div>
      <div className="mt-3 flex gap-1">
        <button className={smallButtonClass} onClick={onIsolate}>{isolated ? 'Show all' : 'Isolate'}</button>
        <button className={smallButtonClass} onClick={onHide}>{hidden ? 'Show' : 'Hide'}</button>
      </div>
    </aside>
  );
};

/** Loads the GLB on demand, animates the explosion and reports picks. */
const Model: React.FC<{
  url: string;
  target: number;
  onShown: (t: number) => void;
  onReady: (d: Dissection | null) => void;
  onSelect: (name: string | null) => void;
  controls: React.RefObject<OrbitControlsImpl | null>;
  frameRequest: React.RefObject<number>;
}> = ({ url, target, onShown, onReady, onSelect, controls, frameRequest }) => {
  const gltf = useGLTF(url);
  const scene = useMemo(() => gltf.scene.clone(true), [gltf]);
  const dissection = useMemo(() => analyse(scene), [scene]);
  const current = useRef(0);
  const lastReported = useRef(-1);
  const framed = useRef(-1);
  const { camera } = useThree();

  useEffect(() => {
    onReady(dissection);
    return () => onReady(null);
  }, [dissection, onReady]);
  // Free GPU memory and drop the cached GLB when the viewer closes. Deferred, so React's
  // development-only unmount and remount does not throw away the model it is about to use.
  const pendingDispose = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (pendingDispose.current) clearTimeout(pendingDispose.current);
    return () => {
      pendingDispose.current = setTimeout(() => {
        highlight(dissection, null, HIGHLIGHT);
        dispose(scene);
        useGLTF.clear(url);
      }, 0);
    };
  }, [dissection, scene, url]);

  useFrame((_, dt) => {
    // Frame the whole (possibly exploded) building when asked.
    if (framed.current !== frameRequest.current && controls.current) {
      framed.current = frameRequest.current;
      // Fit what is on screen now, including an exploded roof and walls.
      const bounds = new Box3().setFromObject(scene);
      const s = bounds.getSize(new Vector3());
      const c = bounds.getCenter(new Vector3());
      const radius = Math.max(s.x, s.y * 1.2, s.z) * 1.5;
      controls.current.target.copy(c);
      camera.position.set(c.x + radius * 1.1, c.y + radius * 0.75, c.z + radius * 1.2);
      controls.current.update();
    }
    const diff = target - current.current;
    if (Math.abs(diff) < 1e-4) {
      if (current.current !== target) {
        current.current = target;
        applyExplosion(dissection, target);
      }
    } else {
      current.current += Math.sign(diff) * Math.min(Math.abs(diff), dt * SPEED);
      applyExplosion(dissection, current.current);
    }
    const rounded = Math.round(current.current * 100) / 100;
    if (rounded !== lastReported.current) {
      lastReported.current = rounded;
      onShown(rounded);
    }
  });

  const pick = (e: ThreeEvent<MouseEvent>) => {
    const hit = e.intersections.find((i) => isShown(i.object));
    if (!hit) return;
    e.stopPropagation();
    onSelect(ownerPart(dissection, hit.object)?.name ?? null);
  };

  return <primitive object={scene} onClick={pick} />;
};

function isShown(o: Object3D) {
  for (let p: Object3D | null = o; p; p = p.parent) if (!p.visible) return false;
  return true;
}

/** Evidence markers follow their component, so they stay in place during dissection. */
const Markers: React.FC<{ dissection: Dissection; markers: BuildingMarker[]; selected: number | null; onSelect: (id: number) => void }> = ({ dissection, markers, selected, onSelect }) => {
  const refs = useRef(new Map<number, Group>());
  const tmp = useMemo(() => new Vector3(), []);
  useFrame(() => {
    for (const m of markers) {
      const g = refs.current.get(m.id);
      const part = dissection.byName.get(m.component);
      if (!g || !part) continue;
      part.object.updateWorldMatrix(true, false);
      g.position.copy(part.object.localToWorld(tmp.set(...m.offset)));
      let visible = false;
      part.object.traverse((o) => { if ((o as { isMesh?: boolean }).isMesh && isShown(o)) visible = true; });
      g.visible = visible;
    }
  });
  return (
    <>
      {markers.filter((m) => dissection.byName.has(m.component)).map((m) => (
        <group key={m.id} ref={(g) => { if (g) refs.current.set(m.id, g); else refs.current.delete(m.id); }}
          onClick={(e) => { e.stopPropagation(); onSelect(m.id); }}>
          <mesh position={[0, 0.6, 0]} rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[0.18, 0.4, 16]} />
            <meshStandardMaterial color={selected === m.id ? '#4cc0ce' : '#f07a72'} emissive={selected === m.id ? '#4cc0ce' : '#f07a72'} emissiveIntensity={0.4} />
          </mesh>
          <mesh position={[0, 0.95, 0]}>
            <sphereGeometry args={[0.16, 16, 12]} />
            <meshStandardMaterial color="#e7e9eb" />
          </mesh>
        </group>
      ))}
    </>
  );
};
