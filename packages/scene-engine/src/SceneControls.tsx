interface SceneControlsProps {
  showEvidenceMarkers: boolean;
  showCeilings: boolean;
  onToggleEvidenceMarkers: () => void;
  onToggleCeilings: () => void;
  onResetCamera: () => void;
  onOverheadView: () => void;
}

const buttonStyle = {
  border: '1px solid #475569',
  borderRadius: 6,
  background: '#0f172aee',
  color: '#e2e8f0',
  padding: '5px 7px',
  font: '11px/1.2 sans-serif',
  cursor: 'pointer',
};

export function SceneControls({
  showEvidenceMarkers,
  showCeilings,
  onToggleEvidenceMarkers,
  onToggleCeilings,
  onResetCamera,
  onOverheadView,
}: SceneControlsProps) {
  return (
    <div
      style={{
        position: 'absolute',
        zIndex: 2,
        top: 8,
        right: 8,
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'flex-end',
        gap: 4,
      }}
      aria-label="Scene controls"
    >
      <button type="button" style={buttonStyle} onClick={onResetCamera} title="Reset camera to the scene's initial view">
        Reset
      </button>
      <button type="button" style={buttonStyle} onClick={onOverheadView} title="Show overhead view">
        Top
      </button>
      <button
        type="button"
        style={buttonStyle}
        onClick={onToggleEvidenceMarkers}
        aria-pressed={showEvidenceMarkers}
        title="Toggle evidence markers"
      >
        Evidence {showEvidenceMarkers ? 'on' : 'off'}
      </button>
      <button
        type="button"
        style={buttonStyle}
        onClick={onToggleCeilings}
        aria-pressed={showCeilings}
        title="Toggle room ceilings"
      >
        Ceilings {showCeilings ? 'on' : 'off'}
      </button>
    </div>
  );
}
