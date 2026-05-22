import { WorkspaceContentHeader, WorkspaceContentShell, WorkspaceSectionFrame, WorkspaceSummaryPanel } from '../workspaceBlocks';

export function ProjectWidget() {
  const projectLanes = ['layout', 'assets', 'review', 'deploy'];

  return (
    <WorkspaceContentShell className="project-surface">
      <WorkspaceContentHeader
        eyebrow="Project list"
        title="tasks / backlog"
        metaEyebrow="delivery"
        meta={`${projectLanes.length} lanes`}
      />
      <WorkspaceSummaryPanel title="active build queue">
        Track delivery stages with the same compact hierarchy used by Markets.
      </WorkspaceSummaryPanel>
      <WorkspaceSectionFrame className="project-lanes" eyebrow="progress" title="current stages" meta="completion">
        <div className="project-lane-list" aria-label="Project progress lanes">
          {projectLanes.map((label, index) => (
            <div className="project-row" key={label}>
              <span>{label}</span>
              <div className="project-track" aria-label={`${label} ${50 + index * 10}% complete`}>
                <i style={{ width: `${50 + index * 10}%` }} />
              </div>
            </div>
          ))}
        </div>
      </WorkspaceSectionFrame>
    </WorkspaceContentShell>
  );
}

