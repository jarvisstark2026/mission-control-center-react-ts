import { getWidgetWorkflowGuidance } from './workspaceWidgetGuidance';
import type { WidgetKind } from './workspaceTypes';

export function WorkspaceWidgetWorkflowCue({ kind }: { kind: WidgetKind }) {
  const guidance = getWidgetWorkflowGuidance(kind);

  return (
    <section className="widget-workflow-cue is-compact" aria-label="Widget operating hint">
      <div className="widget-workflow-cue-primary" title={`${guidance.intent}: ${guidance.value}`}>
        <span>Role</span>
        <strong>{guidance.intent}</strong>
        <p>{guidance.value}</p>
      </div>
      <div className="widget-workflow-cue-secondary" title={guidance.next}>
        <div>
          <span>Handoff</span>
          <p>{guidance.next}</p>
        </div>
        <small>{guidance.evidence}</small>
      </div>
    </section>
  );
}
