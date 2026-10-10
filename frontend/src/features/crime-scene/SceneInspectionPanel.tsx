import { useEffect, useState } from 'react';
import type { AssetDimensionSpec, SceneSelection } from '@forensix/scene-engine';

interface SceneInspectionPanelProps {
  selection: SceneSelection | null;
  onEvidenceSelect: (evidenceId: string) => void;
}

const formatVector = (values: number[]) => values.map((value) => value.toFixed(3)).join(', ');

const provenanceLabels: Record<string, string> = {
  manual: 'Manual placement (recorded in scene data)',
  estimated: 'Estimated placement',
  inferred: 'Inferred placement',
  unknown: 'Placement source unknown',
};

export function SceneInspectionPanel({
  selection,
  onEvidenceSelect,
}: SceneInspectionPanelProps) {
  const [lastEvidenceAction, setLastEvidenceAction] = useState<string | null>(null);
  useEffect(() => {
    setLastEvidenceAction(null);
  }, [selection?.id]);

  if (!selection) {
    return (
      <aside
        className="h-full overflow-y-auto bg-slate-900/95 p-2.5 text-[11px] text-slate-400"
        aria-label="Object inspection"
        data-testid="scene-inspection-panel"
      >
        <div className="text-[10px] font-bold uppercase tracking-wide text-cyan-400">Scene inspection</div>
        <h3 className="mt-1.5 text-xs font-bold text-slate-100">Nothing selected</h3>
        <p className="mt-1.5 leading-relaxed">Select an object or evidence marker to inspect its details.</p>
        <p className="mt-2 text-[10px] text-slate-500">Positions are world-space. Click empty space to clear selection.</p>
      </aside>
    );
  }

  const metadataNotes = [selection.metadata?.notes, selection.metadata?.uncertainty]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
  const calibration = selection.calibration;
  const verifiedDimensions = calibration.status === 'physical-dimensions-verified'
    ? calibration.physicalDimensions
    : undefined;
  const sourceDimensions = calibration.sourceDimensions;

  return (
    <aside
      className="h-full space-y-2.5 overflow-y-auto bg-slate-900/95 p-2.5 text-[11px]"
      aria-label="Object inspection"
      data-testid="scene-inspection-panel"
    >
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wide text-cyan-400">
          {selection.kind === 'evidence-marker' ? 'Evidence marker' : 'Selected object'}
        </div>
        <h3 className="mt-1 break-words text-sm font-bold text-slate-100">{selection.name}</h3>
        <p className="break-all font-mono text-[10px] text-slate-500">{selection.id}</p>
      </div>

      <dl className="space-y-2">
        <InspectionField label="Category" value={selection.category} />
        <InspectionField label="Asset ID" value={selection.assetId} />
        <InspectionField
          label="Association"
          value={selection.association.roomName
            ? `${selection.association.roomName} (${selection.association.roomId})`
            : `${selection.association.sceneType} · ${selection.association.environmentType}`}
        />
      </dl>

      <section className="space-y-1.5 border-t border-slate-800 pt-2" aria-label="World-space transform">
        <h4 className="text-[10px] font-bold uppercase text-slate-300">World-space transform</h4>
        <InspectionField label="Position (m)" value={`[${formatVector(selection.transform.position)}]`} />
        <InspectionField label="Rotation (°)" value={`[${formatVector(selection.transform.rotation)}]`} />
        <InspectionField label="Scale (unitless)" value={`[${formatVector(selection.transform.scale)}]`} />
        <p className="text-[10px] text-slate-500">
          Values are from the scene definition; parent-relative transforms are not supported.
        </p>
      </section>

      <section className="space-y-1.5 border-t border-slate-800 pt-2">
        <h4 className="text-[10px] font-bold uppercase text-slate-300">Placement record</h4>
        {selection.provenance ? (
          <>
            <p className="text-slate-200">{provenanceLabels[selection.provenance.source] ?? selection.provenance.source}</p>
            {selection.provenance.confidence !== undefined && (
              <p className="text-slate-400">
                Recorded confidence: {(selection.provenance.confidence * 100).toFixed(0)}%
                <span className="block text-[10px] text-amber-300">Confidence does not verify the placement.</span>
              </p>
            )}
            {selection.provenance.notes && <p className="break-words text-slate-400">{selection.provenance.notes}</p>}
          </>
        ) : (
          <p className="text-slate-400">Placement source was not provided.</p>
        )}
        {metadataNotes.map((note, index) => (
          <p key={`${index}-${note}`} className="break-words text-amber-200">{note}</p>
        ))}
      </section>

      <section className="space-y-1.5 border-t border-slate-800 pt-2">
        <h4 className="text-[10px] font-bold uppercase text-slate-300">Asset calibration</h4>
        <p className={calibration.status === 'physical-dimensions-verified' ? 'text-emerald-300' : 'text-amber-300'}>
          {calibration.status}
        </p>
        {verifiedDimensions ? (
          <p className="text-slate-300">
            Verified physical dimensions (m): {formatDimensionRecord(verifiedDimensions)}
          </p>
        ) : (
          <p className="text-slate-400">
            Physical dimensions are unverified.
            {sourceDimensions && ` Source bounds: [${formatVector(sourceDimensions)}] (${calibration.sourceUnits}).`}
          </p>
        )}
        {calibration.notes && <p className="break-words text-[10px] text-slate-500">{calibration.notes}</p>}
      </section>

      <section className="space-y-2 border-t border-slate-800 pt-2" aria-label="Associated evidence">
        <h4 className="text-[10px] font-bold uppercase text-slate-300">Associated evidence IDs</h4>
        {selection.evidenceIds.length === 0 ? (
          <p className="text-slate-500">No evidence IDs are associated in this scene.</p>
        ) : (
          <>
            {selection.evidenceIds.map((evidenceId) => (
              <button
                key={evidenceId}
                type="button"
                onClick={() => {
                  setLastEvidenceAction(evidenceId);
                  onEvidenceSelect(evidenceId);
                }}
                className="block w-full break-all rounded-lg border border-cyan-500/30 bg-slate-950 px-2 py-1.5 text-left font-mono text-cyan-300 hover:border-cyan-400"
                aria-label={`Request evidence navigation for ${evidenceId}`}
              >
                {evidenceId} <span className="font-sans text-[10px]">· select reference</span>
              </button>
            ))}
            <p className="text-[10px] leading-relaxed text-slate-500">
              These IDs are not validated against evidence records; this scene schema does not include an evidence catalog.
            </p>
          </>
        )}
        {selection.kind === 'evidence-marker' && selection.objectId && (
          <p className="break-all text-[10px] text-slate-500">Marker object reference: {selection.objectId}</p>
        )}
        {lastEvidenceAction && (
          <p role="status" className="text-[10px] text-amber-300">
            Evidence navigation requested for {lastEvidenceAction} (demo action).
          </p>
        )}
      </section>
    </aside>
  );
}

function InspectionField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase text-slate-500">{label}</dt>
      <dd className="break-words text-slate-200">{value}</dd>
    </div>
  );
}

function formatDimensionRecord(dimensions: AssetDimensionSpec) {
  return Object.entries(dimensions)
    .filter((entry): entry is [string, number | string] => entry[1] !== undefined)
    .map(([key, value]) => `${key} ${typeof value === 'number' ? value.toFixed(3) : value}`)
    .join(' · ');
}
