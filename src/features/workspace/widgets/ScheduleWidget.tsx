import { WorkspaceContentHeader, WorkspaceContentShell, WorkspaceRowList, WorkspaceSectionFrame, WorkspaceSummaryPanel } from '../workspaceBlocks';

export function ScheduleWidget() {
  const slots = [
    { time: '07:30', label: 'Morning shift', note: 'brief / hydrate / review' },
    { time: '12:15', label: 'Project block', note: 'deep work / build' },
    { time: '16:30', label: 'Check-in', note: 'status / approvals' },
    { time: '21:00', label: 'Wrap-up', note: 'handoff / tidy / plan' },
  ];

  const rows = slots.map((slot) => ({
    id: slot.time,
    primary: slot.time,
    secondary: slot.label,
    meta: slot.note,
  }));

  return (
    <WorkspaceContentShell className="schedule-surface">
      <WorkspaceContentHeader
        eyebrow="Schedule"
        title="today / shift rhythm"
        metaEyebrow="timeline"
        meta={`${rows.length} blocks`}
      />
      <WorkspaceSummaryPanel className="schedule-summary" title="active day plan">
        Shift rhythm, check-ins, and project blocks now share the same header-summary-section cadence as the Markets shell.
      </WorkspaceSummaryPanel>
      <WorkspaceSectionFrame className="schedule-section" eyebrow="agenda" title="active day plan" meta="local time">
        <WorkspaceRowList className="schedule-rows" rows={rows} ariaLabel="Today schedule" />
      </WorkspaceSectionFrame>
    </WorkspaceContentShell>
  );
}

