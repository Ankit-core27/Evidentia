import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Camera, ChevronDown, Expand, Eye, MapPin, Moon, Navigation, Route, Ruler, StickyNote, Sun, Tag, X } from 'lucide-react';
import { inputClass, primaryButtonClass } from '@/components/shared/formStyles';
import { useClickOutside } from '@/hooks/useClickOutside';
import { useCreateAnnotation } from '@/hooks/useReconstruction';
import { ReconstructionDetail, Vec3 } from '@/types/api';
import { asVec3, visibleOn } from './Annotations';
import { driverView } from './CaseSceneViewer';
import { SceneFile, groundHeight, modelSpec } from './sceneFile';
import { flyTo, useViewerStore, ViewerTool } from './viewerStore';

const chip =
  'inline-flex h-8 items-center gap-1.5 rounded border border-line-strong bg-canvas/85 px-2.5 text-xs text-ink-soft shadow-sm backdrop-blur hover:bg-raised hover:text-ink disabled:opacity-50';
const chipOn = 'border-accent bg-accent/20 text-ink';

const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

export const ViewerOverlay: React.FC<{
  container: React.RefObject<HTMLDivElement | null>;
  scene: SceneFile | undefined;
  sceneError: string | null;
  reconstruction: ReconstructionDetail;
  stageId: number;
  defaultCamera: { position: Vec3; target: Vec3 };
}> = ({ container, scene, sceneError, reconstruction, stageId, defaultCamera }) => {
  const s = useViewerStore();
  const stage = reconstruction.stages.find((st) => st.id === stageId);
  const notes = reconstruction.annotations.filter((a) => a.kind === 'note' && visibleOn(a, stageId) && !asVec3(a.data.position));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') s.setTool('none');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [s]);

  const startTool = (tool: ViewerTool) => s.setTool(s.tool === tool ? 'none' : tool);
  const fullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void container.current?.requestFullscreen?.();
  };

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between gap-2 p-2">
      <div className="flex items-start justify-between gap-2">
        <div className="pointer-events-auto flex flex-wrap gap-1">
          <ViewsMenu scene={scene} reconstruction={reconstruction} stageId={stageId} defaultCamera={defaultCamera} />
          <button type="button" className={`${chip} ${s.tool === 'measure' ? chipOn : ''}`} onClick={() => startTool('measure')} aria-pressed={s.tool === 'measure'}>
            <Ruler className="size-3.5" aria-hidden /> Measure
          </button>
          <button type="button" className={`${chip} ${s.tool === 'note' ? chipOn : ''}`} onClick={() => startTool('note')} aria-pressed={s.tool === 'note'}>
            <StickyNote className="size-3.5" aria-hidden /> Note
          </button>
          <button type="button" className={`${chip} ${s.tool === 'view' ? chipOn : ''}`} onClick={() => startTool('view')} aria-pressed={s.tool === 'view'}>
            <Camera className="size-3.5" aria-hidden /> Save view
          </button>
        </div>
        <div className="pointer-events-auto flex flex-wrap justify-end gap-1">
          <button type="button" className={`${chip} ${s.showLabels ? chipOn : ''}`} onClick={s.toggleLabels} aria-pressed={s.showLabels} title="Labels">
            <Tag className="size-3.5" aria-hidden /> <span className="hidden sm:inline">Labels</span>
          </button>
          <button type="button" className={`${chip} ${s.showPaths ? chipOn : ''}`} onClick={s.togglePaths} aria-pressed={s.showPaths} title="Paths between stages">
            <Route className="size-3.5" aria-hidden /> <span className="hidden sm:inline">Paths</span>
          </button>
          <button
            type="button"
            className={chip}
            onClick={() => s.setTimeOfDay(s.timeOfDay === 'day' ? 'night' : 'day')}
            title={s.timeOfDay === 'day' ? 'Show at night, as at the time of the incident' : 'Show in daylight'}
          >
            {s.timeOfDay === 'day' ? <Moon className="size-3.5" aria-hidden /> : <Sun className="size-3.5" aria-hidden />}
            <span className="hidden sm:inline">{s.timeOfDay === 'day' ? 'Night' : 'Day'}</span>
          </button>
          <button type="button" className={chip} onClick={() => flyTo(s.controls, defaultCamera.position, defaultCamera.target)} title="Reset view">
            <Eye className="size-3.5" aria-hidden /> <span className="hidden sm:inline">Reset</span>
          </button>
          <button type="button" className={chip} onClick={fullscreen} title="Full screen" aria-label="Full screen">
            <Expand className="size-3.5" aria-hidden />
          </button>
        </div>
      </div>

      {(sceneError || (!reconstruction.scene_file && !reconstruction.scene)) && (
        <p className="pointer-events-auto self-center rounded border border-line-strong bg-canvas/90 px-3 py-1.5 text-xs text-ink-soft">
          {sceneError ? `${sceneError} Showing the scene objects only.` : 'This scenario has no scene file, so only its scene objects are shown.'}
        </p>
      )}

      <div className="flex items-end justify-between gap-2">
        <Compass azimuth={s.azimuth} night={s.timeOfDay === 'night'} scene={scene} />
        <ToolPanel reconstruction={reconstruction} stageId={stageId} />
        {notes.length > 0 ? (
          <section className="pointer-events-auto max-h-40 w-60 overflow-y-auto rounded border border-line-strong bg-canvas/90 p-2 text-xs" aria-label="Notes">
            <h3 className="mb-1 text-2xs font-medium uppercase tracking-wider text-ink-muted">Notes{stage ? ` · ${stage.label}` : ''}</h3>
            <ul className="space-y-1.5">
              {notes.map((n) => (
                <li key={n.id} className="text-ink-soft">
                  {String(n.data.text ?? '')}
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
};

/** What the scene's origin is, for the caption under the compass. */
function originOf(scene: SceneFile | undefined) {
  const kind = scene?.setting?.kind;
  if (kind === 'indoor') return 'the centre of the main room';
  if (kind === 'outdoor') return 'the incident spot';
  if (scene && scene.roads.length === 1) return 'the incident spot';
  return 'the junction centre';
}

const Compass: React.FC<{ azimuth: number; night: boolean; scene: SceneFile | undefined }> = ({ azimuth, night, scene }) => (
  <div className="pointer-events-none flex items-end gap-2">
    <div className="grid size-11 place-items-center rounded-full border border-line-strong bg-canvas/85 shadow-sm" aria-label="North">
      <div style={{ transform: `rotate(${azimuth}rad)` }} className="flex flex-col items-center">
        <Navigation className="size-4 fill-danger text-danger" aria-hidden />
        <span className="-mt-0.5 font-mono text-[9px] text-ink-muted">N</span>
      </div>
    </div>
    <span className="hidden max-w-56 rounded bg-canvas/70 px-1.5 py-0.5 text-2xs text-ink-muted md:inline">
      {night
        ? `Night view: lighting is approximate${scene?.junction?.signals || scene?.static.some((i) => i.kind === 'signal') ? ', and the records don’t say what the signals showed' : ''}.`
        : `Distances in metres from ${originOf(scene)}.`}
    </span>
  </div>
);

const ViewsMenu: React.FC<{ scene: SceneFile | undefined; reconstruction: ReconstructionDetail; stageId: number; defaultCamera: { position: Vec3; target: Vec3 } }> = ({
  scene,
  reconstruction,
  stageId,
  defaultCamera
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false), open);
  const controls = useViewerStore((st) => st.controls);
  const stage = reconstruction.stages.find((st) => st.id === stageId);
  const views = useMemo(() => {
    const list: { key: string; label: string; group: string; position: Vec3; target: Vec3 }[] = [
      { key: 'overview', label: 'Overview', group: 'Scene', ...defaultCamera },
      {
        key: 'plan',
        label: 'Top-down plan',
        group: 'Scene',
        position: [defaultCamera.target[0], scene?.setting?.kind === 'indoor' ? 24 : 85, defaultCamera.target[2] + 0.01],
        target: defaultCamera.target
      }
    ];
    for (const o of stage?.scene_objects ?? []) {
      const spec = modelSpec(scene, o.model_id);
      const kind = spec?.kind ?? 'vehicle';
      if (kind !== 'vehicle' && kind !== 'person') continue;
      if (o.model_id.endsWith(':lying') || o.model_id.endsWith(':fallen')) continue;
      const v = driverView(o, groundHeight(scene, o.position[0], o.position[2]), spec);
      const eye = kind === 'person' || o.model_id.includes(':') ? 'eye level' : 'driver’s eye';
      list.push({ key: `driver-${o.id}`, label: `${o.label}: ${eye}`, group: `This stage${stage ? ` (${stage.label})` : ''}`, ...v });
    }
    for (const a of reconstruction.annotations) {
      if (a.kind !== 'viewpoint' || !visibleOn(a, stageId)) continue;
      const position = asVec3(a.data.position);
      const target = asVec3(a.data.target);
      if (position && target) list.push({ key: `vp-${a.id}`, label: String(a.data.label ?? 'Saved view'), group: 'Saved views', position, target });
    }
    return list;
  }, [scene, reconstruction, stage, stageId, defaultCamera]);
  const groups = [...new Set(views.map((v) => v.group))];
  return (
    <div className="relative" ref={ref}>
      <button type="button" className={chip} onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="menu">
        <MapPin className="size-3.5" aria-hidden /> Views <ChevronDown className="size-3" aria-hidden />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-64 rounded border border-line-strong bg-surface p-1 shadow-lg" role="menu">
          {groups.map((g) => (
            <div key={g}>
              <div className="px-2 pb-0.5 pt-1.5 text-2xs font-medium uppercase tracking-wider text-ink-faint">{g}</div>
              {views
                .filter((v) => v.group === g)
                .map((v) => (
                  <button
                    key={v.key}
                    type="button"
                    role="menuitem"
                    className="block w-full rounded px-2 py-1.5 text-left text-xs text-ink hover:bg-raised"
                    onClick={() => {
                      flyTo(controls, v.position, v.target);
                      setOpen(false);
                    }}
                  >
                    {v.label}
                  </button>
                ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/** Prompts and forms for the active tool; saves what it makes as a scene annotation. */
const ToolPanel: React.FC<{ reconstruction: ReconstructionDetail; stageId: number }> = ({ reconstruction, stageId }) => {
  const { tool, picks, hover, controls, setTool } = useViewerStore();
  const create = useCreateAnnotation(reconstruction.case_id, reconstruction.id);
  const [text, setText] = useState('');
  const [saved, setSaved] = useState<string | null>(null);
  useEffect(() => {
    setText(tool === 'measure' ? 'Measurement' : '');
    create.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool]);
  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(null), 2500);
    return () => clearTimeout(t);
  }, [saved]);

  if (tool === 'none') {
    return saved ? <p className="pointer-events-none rounded bg-ok/90 px-3 py-1.5 text-xs font-medium text-[#08140d]">{saved}</p> : <span />;
  }

  const save = () => {
    const done = (msg: string) => () => {
      setSaved(msg);
      setTool('none');
    };
    if (tool === 'measure' && picks.length === 2) {
      const length = Math.round(dist(picks[0], picks[1]) * 100) / 100;
      create.mutate(
        { stage_id: stageId, kind: 'measurement', data: { label: text.trim() || 'Measurement', from: picks[0], to: picks[1], length_m: length } },
        { onSuccess: done('Measurement saved') }
      );
    } else if (tool === 'note' && picks.length === 1 && text.trim()) {
      create.mutate({ stage_id: stageId, kind: 'note', data: { text: text.trim(), position: picks[0] } }, { onSuccess: done('Note saved') });
    } else if (tool === 'view' && controls && text.trim()) {
      const p = controls.getPosition(new THREE.Vector3());
      const t = controls.getTarget(new THREE.Vector3());
      const round = (n: number) => Math.round(n * 100) / 100;
      create.mutate(
        { stage_id: null, kind: 'viewpoint', data: { label: text.trim(), position: [round(p.x), round(p.y), round(p.z)], target: [round(t.x), round(t.y), round(t.z)] } },
        { onSuccess: done('View saved') }
      );
    }
  };

  let prompt: React.ReactNode = null;
  let form = false;
  if (tool === 'measure') {
    if (picks.length === 0) prompt = 'Click the first point on the road or a vehicle.';
    else if (picks.length === 1) prompt = hover ? <>Click the second point · <span className="font-mono">{dist(picks[0], hover).toFixed(2)} m</span></> : 'Click the second point.';
    else {
      prompt = <span className="font-mono">{dist(picks[0], picks[1]).toFixed(2)} m</span>;
      form = true;
    }
  } else if (tool === 'note') {
    if (picks.length === 0) prompt = 'Click where the note belongs.';
    else form = true;
  } else if (tool === 'view') {
    prompt = 'Frame the view you want, then name it.';
    form = true;
  }

  return (
    <form
      className="pointer-events-auto flex max-w-[min(32rem,100%)] flex-wrap items-center gap-2 rounded border border-accent/60 bg-surface/95 px-3 py-2 text-xs text-ink shadow-lg"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      {prompt && <span className="text-ink-soft">{prompt}</span>}
      {form &&
        (tool === 'note' ? (
          <input
            id="scene-note-text"
            autoFocus
            className={`${inputClass} !h-8 min-w-48 flex-1`}
            placeholder="What should others know here?"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        ) : (
          <input
            id="scene-tool-label"
            autoFocus
            className={`${inputClass} !h-8 min-w-40 flex-1`}
            placeholder={tool === 'view' ? 'Name this view' : 'Label'}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        ))}
      {form && (
        <button type="submit" className={`${primaryButtonClass} !h-8`} disabled={create.isPending || (tool !== 'measure' && !text.trim())}>
          {create.isPending ? 'Saving…' : 'Save'}
        </button>
      )}
      <button type="button" className="inline-flex size-8 items-center justify-center rounded text-ink-muted hover:bg-raised hover:text-ink" onClick={() => setTool('none')} aria-label="Cancel">
        <X className="size-4" aria-hidden />
      </button>
      {create.isError && <span className="w-full text-danger">Couldn’t save: {(create.error as Error).message}</span>}
    </form>
  );
};
