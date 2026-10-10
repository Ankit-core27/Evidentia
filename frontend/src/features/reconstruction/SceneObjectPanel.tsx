import React from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { EvidenceLinkPicker } from '@/components/evidence/EvidenceLinkPicker';
import { iconButtonClass } from '@/components/shared/formStyles';
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
    <section className="rounded-md border border-accent/40 p-3.5 space-y-3 text-body" aria-label="Scene object" data-testid="scene-object-panel">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-2xs text-ink-muted">Selected in the scene</div>
          <h3 className="text-sm font-semibold text-ink">{sceneObject.label}</h3>
          <p className="text-xs text-ink-muted mt-0.5">
            Model <span className="font-mono">{sceneObject.model_id}</span> ·{' '}
            <span className="font-mono">
              {x.toFixed(1)} m E, {(-z).toFixed(1)} m N
            </span>{' '}
            of the origin · heading <span className="font-mono">{heading}°</span>
          </p>
        </div>
        <button onClick={onClose} className={`${iconButtonClass} -mr-1 -mt-1`} aria-label="Deselect object">
          <X className="size-4" />
        </button>
      </div>

      {record ? (
        <div className="space-y-2 pt-3 border-t border-line">
          <div>
            <div className="text-ink font-medium">{record.label}</div>
            <div className="text-xs text-ink-muted">
              {humanize(record.kind)}
              {record.details.plate && (
                <>
                  {' · '}
                  <span className="font-mono">{record.details.plate}</span>
                </>
              )}
              {[record.details.make, record.details.colour].filter(Boolean).map((v) => ` · ${v}`)}
            </div>
          </div>
          <SourcePassages links={workspace.links} evidence={workspace.evidence} targetType="object" targetId={record.id} onOpenEvidence={openEvidence} />
          <Link to={casePath(workspace.case.id, 'people')} className="inline-block text-xs text-accent-text hover:underline">
            Open in People & vehicles
          </Link>
        </div>
      ) : (
        <p className="text-xs text-ink-muted">Not tied to a vehicle or object record.</p>
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
