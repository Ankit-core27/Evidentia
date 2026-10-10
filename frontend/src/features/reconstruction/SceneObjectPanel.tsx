import React from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, X } from 'lucide-react';
import { EvidenceLinkPicker } from '@/components/evidence/EvidenceLinkPicker';
import { SourcePassages } from '@/components/evidence/SourcePassages';
import { useEvidenceInspector } from '@/hooks/useEvidenceInspector';
import { casePath } from '@/lib/caseModules';
import { humanize } from '@/lib/format';
import { CaseWorkspace, SceneObject } from '@/types/api';

/** The object selected in the scene: its placement, the vehicle or item it stands for, and its evidence. */
export const SceneObjectPanel: React.FC<{ workspace: CaseWorkspace; sceneObject: SceneObject; onClose: () => void }> = ({
  workspace,
  sceneObject,
  onClose
}) => {
  const { open: openEvidence } = useEvidenceInspector();
  const record = sceneObject.object_id ? workspace.objects.find((o) => o.id === sceneObject.object_id) : undefined;
  const [x, , z] = sceneObject.position;
  const heading = Math.round(((sceneObject.rotation[1] * 180) / Math.PI + 360) % 360);

  return (
    <section className="p-4 rounded-2xl bg-slate-900/90 border border-cyan-500/30 space-y-3 text-xs" aria-label="Scene object" data-testid="scene-object-panel">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[10px] text-cyan-400 uppercase">Scene object</div>
          <h3 className="text-sm font-bold text-slate-100">{sceneObject.label}</h3>
          <p className="text-[11px] text-slate-400">
            Model {sceneObject.model_id} · {x.toFixed(1)} m east, {(-z).toFixed(1)} m north of the origin · heading {heading}°
          </p>
        </div>
        <button onClick={onClose} className="p-1 rounded text-slate-400 hover:bg-slate-800" aria-label="Deselect object">
          <X className="w-4 h-4" />
        </button>
      </div>

      {record ? (
        <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
          <div className="text-slate-200 font-bold">{record.label}</div>
          <div className="text-[11px] text-slate-400">
            {[humanize(record.kind), record.details.plate, record.details.make, record.details.colour].filter(Boolean).join(' • ')}
          </div>
          <SourcePassages links={workspace.links} evidence={workspace.evidence} targetType="object" targetId={record.id} onOpenEvidence={openEvidence} />
          <Link to={casePath(workspace.case.id, 'people')} className="text-[11px] text-cyan-400 hover:underline flex items-center gap-1">
            Open in People & Vehicles <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      ) : (
        <p className="text-[11px] text-slate-500">Not tied to a vehicle or object record.</p>
      )}

      <SourcePassages
        links={workspace.links}
        evidence={workspace.evidence}
        targetType="scene_object"
        targetId={sceneObject.id}
        onOpenEvidence={openEvidence}
      />
      <EvidenceLinkPicker
        caseId={workspace.case.id}
        targetType="scene_object"
        targetId={sceneObject.id}
        links={workspace.links}
        evidence={workspace.evidence}
      />
    </section>
  );
};
