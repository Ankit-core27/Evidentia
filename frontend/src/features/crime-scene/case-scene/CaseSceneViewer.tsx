import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { CameraControls, useProgress } from '@react-three/drei';
import { Canvas, ThreeEvent, useThree } from '@react-three/fiber';
import { Bloom, EffectComposer } from '@react-three/postprocessing';
import { FileText } from 'lucide-react';
import { useCaseWorkspace } from '@/hooks/useCases';
import { useEvidenceInspector } from '@/hooks/useEvidenceInspector';
import { CaseWorkspace, EvidenceLink, SceneObject, Vec3 } from '@/types/api';
import { SceneViewerProps } from '@/features/reconstruction/sceneViewer';
import { Annotations, Measurement } from './Annotations';
import { Junction } from './Junction';
import { Lighting } from './Lighting';
import { SceneVehicles } from './SceneVehicles';
import { StreetFurniture } from './StreetFurniture';
import { SceneFile, useSceneFile } from './sceneFile';
import { ViewerOverlay } from './ViewerOverlay';
import { useViewerStore } from './viewerStore';

/** Where the default camera looks from when the scene file names none. */
const FALLBACK_CAMERA: { position: Vec3; target: Vec3 } = { position: [-30, 30, 30], target: [-4, 0, 2] };

/** Evidence linked to a scene object directly, or to the vehicle or item it stands for. */
export function evidenceFor(workspace: CaseWorkspace | undefined, o: SceneObject) {
  if (!workspace) return [];
  const seen = new Map<number, EvidenceLink>();
  for (const l of workspace.links) {
    const hit = (l.target_type === 'scene_object' && l.target_id === o.id) || (l.target_type === 'object' && o.object_id != null && l.target_id === o.object_id);
    if (hit && !seen.has(l.evidence_id)) seen.set(l.evidence_id, l);
  }
  return [...seen.values()].map((link) => ({ link, evidence: workspace.evidence.find((e) => e.id === link.evidence_id) })).filter((x) => !!x.evidence);
}

/**
 * The 3D crime-scene viewer for a reconstruction: the authored scene from its scene file,
 * the stage's scene objects, annotations, and tools to measure, take notes and save views.
 */
export const CaseSceneViewer: React.FC<SceneViewerProps> = ({ reconstruction, stageId, selectedSceneObjectId, onSelectSceneObject }) => {
  const sceneQuery = useSceneFile(reconstruction.scene_file);
  const workspaceQuery = useCaseWorkspace(reconstruction.case_id);
  const container = useRef<HTMLDivElement>(null);
  const { timeOfDay, showLabels, showPaths } = useViewerStore();
  const [hovered, setHovered] = useState<number | null>(null);
  // Labels render in their own React root (drei's Html) without the router, so the
  // evidence inspector is opened from here.
  const { open: openEvidence } = useEvidenceInspector();
  const scene = sceneQuery.data;
  const night = timeOfDay === 'night';
  const camera = scene?.camera ?? FALLBACK_CAMERA;

  return (
    <div ref={container} className="relative h-full w-full overflow-hidden bg-[#0b0d0e]" data-testid="scene-3d">
      <Canvas
        shadows
        frameloop="demand"
        dpr={[1, 1.75]}
        camera={{ fov: 42, near: 0.1, far: 1200, position: camera.position }}
        gl={{ antialias: true }}
        aria-label="3D view of the reconstruction stage"
      >
        <Suspense fallback={null}>
          <SceneContent
            scene={scene}
            sceneReady={!reconstruction.scene_file || sceneQuery.isSuccess || sceneQuery.isError}
            reconstruction={reconstruction}
            stageId={stageId}
            selectedId={selectedSceneObjectId}
            onSelect={onSelectSceneObject}
            workspace={workspaceQuery.data}
            night={night}
            showLabels={showLabels}
            showPaths={showPaths}
            hovered={hovered}
            onHover={setHovered}
            camera={camera}
            onOpenEvidence={openEvidence}
          />
        </Suspense>
      </Canvas>
      <ViewerOverlay
        container={container}
        scene={scene}
        sceneError={sceneQuery.isError ? (sceneQuery.error as Error).message : null}
        reconstruction={reconstruction}
        stageId={stageId}
        defaultCamera={camera}
      />
      <LoadingVeil />
    </div>
  );
};

const LoadingVeil: React.FC = () => {
  const { active, progress } = useProgress();
  if (!active) return null;
  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center bg-canvas/60 text-xs text-ink-muted">
      Loading the scene… {Math.round(progress)}%
    </div>
  );
};

const SceneContent: React.FC<{
  scene: SceneFile | undefined;
  sceneReady: boolean;
  reconstruction: SceneViewerProps['reconstruction'];
  stageId: number;
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  workspace: CaseWorkspace | undefined;
  night: boolean;
  showLabels: boolean;
  showPaths: boolean;
  hovered: number | null;
  onHover: (id: number | null) => void;
  camera: { position: Vec3; target: Vec3 };
  onOpenEvidence: (evidenceId: number, passage?: string | null) => void;
}> = (p) => {
  const { tool, picks, hover, addPick, setHover } = useViewerStore();
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => invalidate(), [p.night, p.showLabels, p.showPaths, p.stageId, p.selectedId, picks, hover, invalidate]);

  // Clicks on the scene: place a tool's points, or clear the selection.
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (tool === 'none') {
      p.onSelect(null);
      return;
    }
    const point: Vec3 = [round(e.point.x), round(e.point.y), round(e.point.z)];
    const needed = tool === 'measure' ? 2 : tool === 'note' ? 1 : 0;
    if (picks.length < needed) addPick(point);
  };
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    if (tool !== 'measure' || picks.length !== 1) return;
    setHover([round(e.point.x), round(e.point.y), round(e.point.z)]);
  };

  return (
    <>
      <Lighting night={p.night} />
      <CameraRig camera={p.camera} ready={p.sceneReady} />
      <group onClick={onClick} onPointerMove={onMove}>
        {p.scene && (
          <>
            <Junction scene={p.scene} />
            <StreetFurniture scene={p.scene} night={p.night} focus={[0, 0]} />
          </>
        )}
        {!p.scene && (
          <mesh rotation-x={-Math.PI / 2} receiveShadow>
            <planeGeometry args={[400, 400]} />
            <meshStandardMaterial color="#55585b" roughness={1} />
          </mesh>
        )}
        <SceneVehicles
          scene={p.scene}
          reconstruction={p.reconstruction}
          stageId={p.stageId}
          selectedId={p.selectedId}
          objects={p.workspace?.objects ?? []}
          night={p.night}
          showLabels={p.showLabels}
          showPaths={p.showPaths}
          renderBadge={(o) => <EvidenceBadge workspace={p.workspace} object={o} onOpen={p.onOpenEvidence} />}
          handlers={{ hovered: p.hovered, onHover: p.onHover, onSelect: (id) => p.onSelect(id) }}
        />
      </group>
      <Annotations annotations={p.reconstruction.annotations} stageId={p.stageId} showLabels={p.showLabels} />
      {tool === 'measure' && picks[0] && (picks[1] || hover) && (
        <Measurement from={picks[0]} to={picks[1] ?? hover!} label="" showLabel preview={!picks[1]} />
      )}
      {p.night && (
        <EffectComposer multisampling={4}>
          <Bloom mipmapBlur intensity={0.85} luminanceThreshold={0.85} luminanceSmoothing={0.25} />
        </EffectComposer>
      )}
    </>
  );
};

const round = (n: number) => Math.round(n * 1000) / 1000;

/** Orbit, pan and zoom; sets the scene's opening view once the scene file has loaded. */
const CameraRig: React.FC<{ camera: { position: Vec3; target: Vec3 }; ready: boolean }> = ({ camera, ready }) => {
  const ref = useRef<CameraControls>(null);
  const setControls = useViewerStore((s) => s.setControls);
  const setAzimuth = useViewerStore((s) => s.setAzimuth);
  const placed = useRef(false);
  useEffect(() => {
    const controls = ref.current;
    setControls(controls);
    if (!controls) return;
    const update = () => setAzimuth(controls.azimuthAngle);
    controls.addEventListener('update', update);
    return () => {
      controls.removeEventListener('update', update);
      setControls(null);
    };
  }, [setControls, setAzimuth]);
  useEffect(() => {
    if (!ready || placed.current || !ref.current) return;
    placed.current = true;
    void ref.current.setLookAt(...camera.position, ...camera.target, false);
  }, [ready, camera]);
  return (
    <CameraControls
      ref={ref}
      makeDefault
      minDistance={1.2}
      maxDistance={240}
      maxPolarAngle={Math.PI / 2 - 0.03}
      dollyToCursor
      smoothTime={0.35}
    />
  );
};

/** The evidence count on a vehicle's label; opens a list that links to the evidence inspector. */
const EvidenceBadge: React.FC<{
  workspace: CaseWorkspace | undefined;
  object: SceneObject;
  onOpen: (evidenceId: number, passage?: string | null) => void;
}> = ({ workspace, object, onOpen }) => {
  const items = useMemo(() => evidenceFor(workspace, object), [workspace, object]);
  const [open, setOpen] = useState(false);
  if (!items.length) return null;
  return (
    <span className="relative" style={{ pointerEvents: 'auto' }}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        className="inline-flex items-center gap-0.5 rounded bg-warn px-1.5 py-0.5 font-mono text-2xs font-semibold text-[#1a1408]"
        aria-expanded={open}
        aria-label={`${items.length} evidence items linked to ${object.label}`}
        data-testid={`evidence-marker-${object.id}`}
      >
        <FileText className="size-3" aria-hidden />
        {items.length}
      </button>
      {open && (
        <span className="absolute left-1/2 top-full z-10 mt-1.5 flex w-64 -translate-x-1/2 flex-col rounded border border-line-strong bg-surface p-1 text-left shadow-lg">
          {items.map(({ link, evidence }) => (
            <button
              key={link.evidence_id}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpen(link.evidence_id, link.passage);
              }}
              className="rounded px-2 py-1.5 text-left text-xs text-ink hover:bg-raised"
            >
              <span className="block font-medium">{evidence!.title}</span>
              {link.passage && <span className="mt-0.5 line-clamp-2 block text-2xs text-ink-muted">“{link.passage}”</span>}
            </button>
          ))}
        </span>
      )}
    </span>
  );
};

/** Camera position and target for a driver's eye view from a scene object's placement. */
export function driverView(o: SceneObject, groundY: number): { position: Vec3; target: Vec3 } {
  // Right-hand drive: the driver sits right of centre (+z in the vehicle's frame).
  const seat: Record<string, [number, number, number]> = {
    hatchback: [-0.15, 1.18, 0.36],
    'delivery-van': [1.3, 1.58, 0.36]
  };
  const [f, up, r] = seat[o.model_id] ?? [0, 1.3, 0.35];
  const h = o.rotation[1];
  const fx = Math.cos(h);
  const fz = -Math.sin(h);
  const rx = Math.sin(h);
  const rz = Math.cos(h);
  const eye: Vec3 = [o.position[0] + fx * f + rx * r, groundY + up, o.position[2] + fz * f + rz * r];
  const target: Vec3 = [eye[0] + fx * 30, groundY + 0.6, eye[2] + fz * 30];
  return { position: eye, target };
}

