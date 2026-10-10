interface SceneControlsProps {
  showEvidenceMarkers: boolean;
  onToggleEvidenceMarkers: () => void;
  onResetCamera: () => void;
  onOverheadView: () => void;
}

const buttonStyle = {
  border: '1px solid #475569',
  borderRadius: 6,
  background: '#0f172aee',
  color: '#e2e8f0',
  padding: '7px 10px',
  font: '12px/1.2 sans-serif',
  cursor: 'pointer',
};

export function SceneControls({
  showEvidenceMarkers,
  onToggleEvidenceMarkers,
  onResetCamera,
  onOverheadView,
}: SceneControlsProps) {
  return (
    <div
      style={{
        position: 'absolute',
        zIndex: 2,
        top: 12,
        right: 12,
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'flex-end',
        gap: 6,
      }}
      aria-label="Scene controls"
    >
      <button type="button" style={buttonStyle} onClick={onResetCamera}>
        Reset view
      </button>
      <button type="button" style={buttonStyle} onClick={onOverheadView}>
        Overhead
      </button>
      <button
        type="button"
        style={buttonStyle}
        onClick={onToggleEvidenceMarkers}
        aria-pressed={showEvidenceMarkers}
      >
        Evidence {showEvidenceMarkers ? 'on' : 'off'}
      </button>
    </div>
  );
}
