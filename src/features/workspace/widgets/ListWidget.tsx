import { WorkspaceContentHeader, WorkspaceContentShell, WorkspaceRowList, WorkspaceSectionFrame, WorkspaceSummaryPanel } from '../workspaceBlocks';

export function ListWidget() {
  const rows = ['inbox', 'next action', 'blocked', 'archive'].map((item) => ({
    id: item,
    primary: item,
    secondary: 'open',
  }));

  return (
    <WorkspaceContentShell className="list-surface">
      <WorkspaceContentHeader
        eyebrow="Project list"
        title="tasks / backlog"
        metaEyebrow="queue"
        meta={`${rows.length} lanes`}
      />
      <WorkspaceSummaryPanel className="list-summary" title="active task lanes">
        Task rows now sit beneath the same header and summary tier used by Markets, rather than jumping straight into bespoke list chrome.
      </WorkspaceSummaryPanel>
      <WorkspaceSectionFrame className="list-section" eyebrow="items" title="current queue" meta="open states">
        <WorkspaceRowList className="list-rows" rows={rows} ariaLabel="Workspace list" />
      </WorkspaceSectionFrame>
    </WorkspaceContentShell>
  );
}

