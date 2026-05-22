import { WorkspaceButton, WorkspaceContentHeader, WorkspaceContentShell, WorkspaceSectionFrame, WorkspaceSummaryPanel } from '../workspaceBlocks';

export function ModelStudioWidget() {
  const simulationCards = [
    { label: 'Structural integrity', value: '92%', note: 'frame / joints / load paths' },
    { label: 'Bend response', value: '0.18 mm', note: 'deformation under torque' },
    { label: 'Stress hotspots', value: '03', note: 'redline zones and stress peaks' },
    { label: 'Heat map', value: '64Â°C', note: 'thermal climb under runtime load' },
  ];

  const gestureChips = ['drag', 'pinch', 'orbit', 'slice', 'measure', 'simulate'];

  return (
    <WorkspaceContentShell className="model-studio-surface">
      <WorkspaceContentHeader
        className="model-studio-head"
        eyebrow="3D asset authoring"
        title="sculpt / gesture / simulate"
        metaEyebrow="real-time engineering"
        meta="structures Â· bending Â· heat Â· stress"
      />
      <WorkspaceSummaryPanel className="model-studio-overview" title="creation surface">
        Designed as a fluid creation surface first, with touch, stylus, and spatial capture ready to slot in when the hardware catches up.
      </WorkspaceSummaryPanel>

      <div className="model-studio-layout">
        <WorkspaceSectionFrame className="model-studio-canvas-frame" eyebrow="model viewport" title="spatial capture rig" meta="orbit / slice">
          <div className="model-studio-canvas">
            <div className="model-studio-grid" />
            <div className="model-studio-rig">
              <div className="model-studio-shell model-studio-shell-a" />
              <div className="model-studio-shell model-studio-shell-b" />
              <div className="model-studio-shell model-studio-shell-c" />
            </div>
            <div className="model-studio-axis model-studio-axis-x" />
            <div className="model-studio-axis model-studio-axis-y" />
            <div className="model-studio-axis model-studio-axis-z" />
          </div>
        </WorkspaceSectionFrame>

        <WorkspaceSectionFrame className="model-studio-panel" eyebrow="simulation" title="engineering passes" meta={`${simulationCards.length} checks`}>
          <div className="model-studio-tools">
            {gestureChips.map((chip) => (
              <WorkspaceButton variant="compact" key={chip} className="model-studio-chip">
                {chip}
              </WorkspaceButton>
            ))}
          </div>

          <div className="model-studio-simulations">
            {simulationCards.map((card, index) => (
              <article className="model-studio-sim" key={card.label}>
                <div className="model-studio-sim-head">
                  <span>{card.label}</span>
                  <strong>{card.value}</strong>
                </div>
                <div className="model-studio-sim-bar">
                  <i style={{ width: `${58 - index * 9}%` }} />
                </div>
                <small>{card.note}</small>
              </article>
            ))}
          </div>
        </WorkspaceSectionFrame>
      </div>
    </WorkspaceContentShell>
  );
}

