import { getWidgetWorkflowGuidance } from './workspaceWidgetGuidance';
import type { WidgetKind } from './workspaceTypes';

export function WorkspaceWidgetWorkflowCue({ kind }: { kind: WidgetKind }) {
  const guidance = getWidgetWorkflowGuidance(kind);

  return (
    <section className="widget-workflow-cue" aria-label="Widget workflow value">
      <div className="widget-workflow-cue-primary">
        <span>Purpose</span>
        <strong>{guidance.intent}</strong>
        <p>{guidance.value}</p>
      </div>
      <div className="widget-workflow-cue-secondary">
        <div>
          <span>Next</span>
          <p>{guidance.next}</p>
        </div>
        <small>{guidance.evidence}</small>
      </div>
    </section>
  );
}
