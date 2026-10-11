import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, ThreeEvent, useFrame } from '@react-three/fiber';
import { CameraControls, Html, useGLTF } from '@react-three/drei';
import CameraControlsImpl from 'camera-controls';
import { Box3, Group, MathUtils, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { useQuery } from '@tanstack/react-query';
import { smallButtonClass } from '@/components/shared/formStyles';
import type { Vec3 } from '@/types/api';
import {
  AnatomyManifest, AnatomicalMarker, FindingState, buildExplosion, clampProgress,
  findingKey, positionAt, skinOpacity, structureBounds
} from './anatomyEngine';

export const useAnatomyManifest = () => useQuery({
  queryKey: ['anatomy-model-manifest'], staleTime: Infinity,
  queryFn: async ({ signal }): Promise<AnatomyManifest> => {
    const response = await fetch('/3d/anatomy/manifest.json', { signal });
    if (!response.ok) throw new Error('The reference anatomy manifest is unavailable. Findings remain accessible below.');
    const data = await response.json();
    if (data.modelId !== 'bodyparts3d-3.0-forensix-v1' || !Array.isArray(data.structures) || !data.structures.length)
      throw new Error('Unsupported anatomy manifest.');
    if (data.url !== '/3d/anatomy/bodyparts3d.glb') throw new Error('Unsupported anatomy model URL.');
    const ids = new Set<string>();
    for (const s of data.structures) {
      if (!s.id || ids.has(s.id) || !s.meshNames?.length || s.originalPosition?.length !== 3 || s.size?.length !== 3
        || !s.originalPosition.every(Number.isFinite) || !s.size.every((v: number) => Number.isFinite(v) && v > 0))
        throw new Error('The reference anatomy manifest contains invalid structure bounds.');
      ids.add(s.id);
    }
    return data;
  }
});

interface Props {
  manifest: AnatomyManifest;
  selected: string | null;
  onSelect: (id: string | null) => void;
  selectedFinding: string | null;
  onFinding: (key: string) => void;
  markers: AnatomicalMarker[];
  states: Record<string, FindingState>;
  system: string;
  placing: boolean;
  onPlace: (structureId: string, local: Vec3) => void;
}
interface CameraAPI { zoom: (delta: number) => void; frame: (back?: boolean) => void; exitFocus: () => void }

class ModelBoundary extends React.Component<React.PropsWithChildren<{ onError: () => void }>, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(error: Error) { return { error: error.message }; }
  componentDidCatch() { this.props.onError(); }
  render() {
    return this.state.error ? <div role="alert" className="p-8 text-body text-warn">Unable to load reference anatomy. {this.state.error} The findings panel remains available.</div> : this.props.children;
  }
}

/** The canvas remains mounted across structure selections; only person/case changes reset it. */
export const AnatomicalViewer: React.FC<Props> = (props) => {
  const [progress, setProgress] = useState(0);
  const [labels, setLabels] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const api = useRef<CameraAPI | null>(null);
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault(); event.stopPropagation();
      api.current?.zoom(event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 600 : 1));
    };
    element.addEventListener('wheel', wheel, { capture: true, passive: false });
    return () => element.removeEventListener('wheel', wheel, true);
  }, []);
  const structure = props.manifest.structures.find(s => s.id === hovered);
  const mode = props.selected ? 'Organ inspection' : progress < 0.01 ? 'Intact reference body' : progress < 0.3 ? 'Anatomical exposure' : progress < 0.99 ? 'Separating structures' : 'Exploded examination';
  const changeProgress = (value: number) => { api.current?.exitFocus(); props.onSelect(null); setProgress(value); };
  return <div className="flex min-w-0 flex-col rounded border border-line-strong bg-well" data-testid="anatomy-viewer">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
      <span className="font-mono text-xs text-ink-soft" data-testid="anatomy-mode">{mode}</span>
      <div className="flex gap-1">
        <button className={smallButtonClass} disabled={!loaded} onClick={() => changeProgress(progress > 0 ? 0 : 1)}>{progress > 0 ? 'Reassemble' : 'Explode'}</button>
        {props.selected && <button className={smallButtonClass} onClick={() => props.onSelect(null)}>Return to anatomy</button>}
        <button className={smallButtonClass} disabled={!loaded} onClick={() => { props.onSelect(null); api.current?.frame(); }}>Front</button>
        <button className={smallButtonClass} disabled={!loaded} onClick={() => { props.onSelect(null); api.current?.frame(true); }}>Back</button>
      </div>
    </div>
    <div ref={root} className="relative shrink-0 touch-none" style={{ height: 620 }} data-testid="anatomy-canvas">
      <ModelBoundary onError={() => setLoadFailed(true)}>
        <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0, 3.8], fov: 42, near: 0.01, far: 30 }}
          fallback={<p className="p-8 text-warn">WebGL is unavailable. Use the findings and source-evidence panels.</p>}>
          <color attach="background" args={['#0b0d0e']} />
          <ambientLight intensity={1.1} />
          <directionalLight position={[3, 5, 5]} intensity={2.1} />
          <directionalLight position={[-3, 1, -3]} intensity={1.4} color="#d6e3e6" />
          <Suspense fallback={null}>
            <Scene {...props} progress={progress} setProgress={setProgress} labels={labels} hovered={hovered}
              onHover={setHovered} cameraAPI={api} onLoaded={setLoaded} />
          </Suspense>
        </Canvas>
      </ModelBoundary>
      {!loaded && !loadFailed && <div role="status" className="pointer-events-none absolute inset-0 flex items-center justify-center text-ink-soft">Loading segmented reference anatomy…</div>}
      {structure && <div className="pointer-events-none absolute left-3 top-3 rounded border border-line-strong bg-surface/95 px-3 py-2">
        <div className="font-medium text-ink">{structure.label}</div>
        <div className="text-xs text-ink-muted">{(props.states[structure.id] ?? 'not_documented').replaceAll('_', ' ')}</div>
      </div>}
      {props.placing && <div role="status" className="absolute inset-x-4 top-4 border border-accent bg-surface p-3 text-accent-text">Click the supported structure to place this injury’s illustrative marker. This does not establish its exact clinical location.</div>}
      <div className="absolute bottom-3 right-3 flex gap-1">
        <button className={smallButtonClass} aria-label="Zoom in" disabled={!loaded} onClick={() => api.current?.zoom(-150)}>+</button>
        <button className={smallButtonClass} aria-label="Zoom out" disabled={!loaded} onClick={() => api.current?.zoom(150)}>−</button>
      </div>
    </div>
    <div className="space-y-2 border-t border-line px-3 py-3 text-xs text-ink-muted">
      <div className="flex items-center gap-3">
        <label htmlFor="anatomy-explosion">Exposure / separation</label>
        <input id="anatomy-explosion" aria-label="Explosion progress" className="min-w-12 flex-1 accent-accent" type="range" min="0" max="1" step="0.01" value={progress} disabled={!loaded || !!props.selected} onChange={e => changeProgress(Number(e.target.value))} />
        <span className="font-mono">{Math.round(progress*100)}%</span>
        <label className="flex items-center gap-1"><input type="checkbox" checked={labels} onChange={e => setLabels(e.target.checked)} /> Labels</label>
      </div>
      <p>Drag to rotate · right-drag to pan · scroll inward to expose and separate, then zoom closer. Scroll outward to reverse.</p>
      <p>Reference anatomy, not a patient scan. Organ-only badges indicate an associated structure, not a measured injury location.</p>
      <p>BodyParts3D, © The Database Center for Life Science · <a className="text-accent-text underline" href="https://creativecommons.org/licenses/by-sa/2.1/jp/deed.en" target="_blank" rel="noreferrer">CC BY-SA 2.1 Japan</a> · <a className="text-accent-text underline" href="/3d/anatomy/README.md" target="_blank" rel="noreferrer">Model scope and attribution</a></p>
    </div>
  </div>;
};

function Scene(p: Props & { progress: number; setProgress: (v: number) => void; labels: boolean; hovered: string | null;
  onHover: (id: string | null) => void; cameraAPI: React.MutableRefObject<CameraAPI | null>; onLoaded: (v: boolean) => void }) {
  const gltf = useGLTF(p.manifest.url);
  const controls = useRef<CameraControls>(null);
  const currentProgress = useRef(0);
  const targetProgress = useRef(p.progress);
  const latest = useRef(p); latest.current = p;
  const focus = useRef<{ position: Vector3; target: Vector3; progress: number } | null>(null);
  const baseDistance = useRef(3.8);
  const transforms = useMemo(() => buildExplosion(p.manifest.structures), [p.manifest]);
  const groups = useMemo(() => {
    const scene = gltf.scene.clone(true);
    const result = new Map<string, Group>();
    for (const structure of p.manifest.structures) {
      const group = scene.getObjectByName(structure.id) as Group | undefined;
      if (!group || structure.meshNames.some(name => !group.getObjectByName(name))) throw new Error(`Missing model components for ${structure.label}.`);
      group.traverse(child => {
        if (child instanceof Mesh) {
          child.material = (child.material as MeshStandardMaterial).clone();
        }
      });
      result.set(structure.id, group);
    }
    return result;
  }, [gltf.scene, p.manifest]);
  useEffect(() => {
    p.onLoaded(true);
    return () => { for (const group of groups.values()) group.traverse(child => { if (child instanceof Mesh) (child.material as MeshStandardMaterial).dispose(); }); };
  }, [groups]);
  useEffect(() => { targetProgress.current = p.progress; }, [p.progress]);
  const overall = useMemo(() => {
    const bounds = new Box3();
    for (const t of transforms) {
      const s = p.manifest.structures.find(s => s.id === t.structureId)!;
      bounds.union(structureBounds(s, t.originalPosition));
      bounds.union(structureBounds(s, t.explodedPosition));
    }
    return bounds.expandByScalar(0.08);
  }, [transforms, p.manifest]);
  useEffect(() => {
    const control = controls.current;
    if (!control) return;
    const frame = (back = false) => {
      const center = overall.getCenter(new Vector3());
      const distance = Math.max(3.3, overall.getSize(new Vector3()).length()*1.35);
      baseDistance.current = distance;
      focus.current = null;
      void control.setLookAt(center.x, center.y, back ? -distance : distance, ...center.toArray(), true);
    };
    frame();
    p.cameraAPI.current = {
      frame,
      exitFocus() {
        if (focus.current) {
          const previous = focus.current;
          focus.current = null;
          void control.setLookAt(...previous.position.toArray(), ...previous.target.toArray(), true);
        }
      },
      zoom(delta) {
        const { selected, progress, setProgress } = latest.current;
        if (selected || (progress >= 1 && (delta < 0 || control.distance < baseDistance.current - 0.05))) {
          void control.dolly(-delta*0.0015, true);
        } else if (progress <= 0 && delta > 0) {
          void control.dolly(-delta*0.0015, true);
        } else {
          if (delta < 0 && progress === 0) baseDistance.current = control.distance;
          setProgress(clampProgress(progress - delta/1100));
        }
      }
    };
    return () => { p.cameraAPI.current = null; };
  }, [overall]);
  useEffect(() => {
    const control = controls.current;
    if (!control) return;
    if (p.selected) {
      if (!focus.current) {
        focus.current = { position: control.getPosition(new Vector3()), target: control.getTarget(new Vector3()), progress: targetProgress.current };
        targetProgress.current = currentProgress.current;
        p.setProgress(currentProgress.current);
      }
      const group = groups.get(p.selected);
      if (group) {
        group.updateWorldMatrix(true, true);
        const bounds = new Box3().setFromObject(group).expandByScalar(0.025);
        void control.fitToBox(bounds, true, { paddingTop: 0.04, paddingBottom: 0.04, paddingLeft: 0.04, paddingRight: 0.04 });
      }
    } else if (focus.current) {
      const previous = focus.current;
      focus.current = null;
      p.setProgress(previous.progress);
      void control.setLookAt(...previous.position.toArray(), ...previous.target.toArray(), true);
    }
  }, [p.selected, groups]);
  useFrame((_, delta) => {
    let value = MathUtils.damp(currentProgress.current, targetProgress.current, 8, Math.min(delta, 0.1));
    if (Math.abs(value-targetProgress.current) < 0.0001) value = targetProgress.current;
    currentProgress.current = value;
    for (const t of transforms) {
      const group = groups.get(t.structureId)!;
      group.position.set(...positionAt(t, value));
      const s = p.manifest.structures.find(s => s.id === t.structureId)!;
      const selected = p.selected === s.id;
      const visibleSystem = p.system === 'all' || p.system === s.system || selected;
      let opacity = s.id === 'skin' ? skinOpacity(value) : 1;
      if (p.selected) opacity = selected ? 1 : Math.min(opacity, 0.045);
      group.visible = visibleSystem && opacity > 0.005;
      group.traverse(child => {
        if (child instanceof Mesh) {
          child.raycast = group.visible && opacity >= 0.1 ? Mesh.prototype.raycast : () => {};
          const material = child.material as MeshStandardMaterial;
          const transparent = opacity < 0.999;
          if (material.transparent !== transparent) { material.transparent = transparent; material.needsUpdate = true; }
          material.opacity = opacity; material.depthWrite = !transparent;
          material.emissive.set(selected || p.hovered === s.id ? '#28646b' : '#000000');
          material.emissiveIntensity = selected ? 0.35 : 0.2;
        }
      });
    }
  });
  const click = (id: string, e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (p.placing) {
      const local = groups.get(id)!.worldToLocal(e.point.clone());
      p.onPlace(id, local.toArray() as Vec3);
    } else p.onSelect(id);
  };
  return <>
    <CameraControls ref={controls} makeDefault minDistance={0.07} maxDistance={9} smoothTime={0.3}
      mouseButtons={{ left: CameraControlsImpl.ACTION.ROTATE, middle: CameraControlsImpl.ACTION.TRUCK, right: CameraControlsImpl.ACTION.TRUCK, wheel: CameraControlsImpl.ACTION.NONE }} />
    {p.manifest.structures.map(s => {
      const group = groups.get(s.id)!;
      const annotationVisible = (!p.selected || p.selected === s.id) && (p.system === 'all' || p.system === s.system || p.selected === s.id);
      const markers = annotationVisible ? p.markers.filter(m => m.structureId === s.id && m.finding.record.review_status !== 'rejected') : [];
      return <primitive key={s.id} object={group} onClick={(e: ThreeEvent<MouseEvent>) => click(s.id, e)}
        onPointerMove={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); p.onHover(s.id); }} onPointerOut={() => p.onHover(null)}>
        {annotationVisible && (s.id !== 'skin' || p.progress < 0.3 || p.selected === 'skin') && (p.labels || p.selected === s.id) && <Html position={[0, s.size[1]/2+0.025, 0]} center style={{ pointerEvents: 'none' }}>
          <span className="whitespace-nowrap rounded bg-surface/90 px-2 py-1 text-xs text-ink">{s.label}</span>
        </Html>}
        {markers.map((marker, i) => {
          const key = findingKey(marker.finding);
          const pending = marker.finding.record.review_status === 'pending';
          const position: Vec3 = marker.localPosition ?? [s.size[0]/2+0.02, s.size[1]/2-i*0.025, s.size[2]/2];
          return <Html key={key} position={position} center zIndexRange={[30, 0]}>
            <button onClick={e => { e.stopPropagation(); p.onFinding(key); }}
              title={`${marker.finding.record.description || marker.finding.record.body_region} · ${marker.localPosition ? 'Investigator placement' : 'Organ-only association; illustrative position'}`}
              aria-label={`Select ${marker.finding.kind === 'injury' ? 'injury' : 'finding'} ${marker.finding.record.id}`}
              className={`whitespace-nowrap rounded border px-1.5 py-0.5 font-mono text-xs bg-surface/95 ${pending ? 'border-dashed border-pending text-pending' : marker.finding.kind === 'injury' ? 'border-danger text-danger' : 'border-warn text-warn'} ${p.selectedFinding === key ? 'ring-2 ring-accent' : ''}`}>
              {marker.finding.kind === 'injury' ? 'I' : 'F'}{marker.finding.record.id}{marker.localPosition ? ' ◉' : ' ≈'}
            </button>
          </Html>;
        })}
      </primitive>;
    })}
  </>;
}
