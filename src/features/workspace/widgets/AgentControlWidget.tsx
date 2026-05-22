import { useState } from 'react';
import type { ShellRole } from '../../shell/roles';
import {
  canEditAgentSettings,
  canViewAgentControl,
  getAgentJobSummary,
  getAgentUsageApprovalRate,
  getVisibleAgentActivity,
  getVisibleAgentJobs,
  getVisibleAgentPermissions,
  type AgentActivity,
  type AgentControlState,
  type AgentPermission,
  type AgentScheduledJob,
} from '../../agent-control';
import {
  WorkspaceButton,
  WorkspaceContentHeader,
  WorkspaceContentShell,
  WorkspaceMetricGrid,
  WorkspaceSectionFrame,
  WorkspaceSummaryPanel,
} from '../workspaceBlocks';

function formatDateTime(value: string | null) {
  if (!value) return 'not scheduled';
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return value;

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(time));
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

function AgentJobCard({ job }: { job: AgentScheduledJob }) {
  return (
    <article className="mission-control-card agent-control-card" data-state={job.status}>
      <div className="mission-control-card-head">
        <div>
          <span>{job.kind} / {job.status}</span>
          <strong>{job.name}</strong>
        </div>
        <small>{job.cadence}</small>
      </div>
      <p>{job.description}</p>
      <div className="agent-control-card-meta">
        <span>last {formatDateTime(job.lastRunAt)}</span>
        <span>next {formatDateTime(job.nextRunAt)}</span>
      </div>
    </article>
  );
}

function AgentPermissionRow({ permission, editable }: { permission: AgentPermission; editable: boolean }) {
  return (
    <div className="mission-control-row agent-control-permission-row" data-state={permission.level}>
      <span>{permission.label}</span>
      <strong>{permission.level}</strong>
      <small>{editable ? 'editable' : `${permission.category} / ${permission.risk}`}</small>
    </div>
  );
}

function AgentActivityRow({ activity }: { activity: AgentActivity }) {
  return (
    <div className="mission-control-row agent-control-activity-row" data-state={activity.status ?? activity.kind}>
      <span>{activity.title}</span>
      <strong>{activity.kind}</strong>
      <small>{formatDateTime(activity.timestamp)}</small>
    </div>
  );
}

export function AgentControlWidget({ state, role }: { state: AgentControlState; role: ShellRole }) {
  const [profileEditorOpen, setProfileEditorOpen] = useState(false);

  if (!canViewAgentControl(role)) {
    return (
      <WorkspaceContentShell className="mission-control-surface agent-control-surface">
        <WorkspaceContentHeader
          eyebrow="Agent control"
          title="identity / jobs / permissions"
          metaEyebrow="access"
          meta="guest"
        />
        <WorkspaceSummaryPanel title="No access for this scope">
          Agent identity, scheduled jobs, and permission details are hidden from guest access.
        </WorkspaceSummaryPanel>
      </WorkspaceContentShell>
    );
  }

  const jobs = getVisibleAgentJobs(state, role);
  const permissions = getVisibleAgentPermissions(state, role);
  const activity = getVisibleAgentActivity(state, role);
  const summary = getAgentJobSummary(jobs);
  const editable = canEditAgentSettings(role);
  const approvalRate = getAgentUsageApprovalRate(state);

  return (
    <WorkspaceContentShell className="mission-control-surface agent-control-surface">
      <WorkspaceContentHeader
        eyebrow="Agent control"
        title="identity / jobs / permissions"
        metaEyebrow="connection"
        meta={state.identity.connection}
      />

      <WorkspaceSummaryPanel className="mission-control-summary agent-control-summary" title={state.identity.name}>
        {state.identity.currentTask}
      </WorkspaceSummaryPanel>

      <WorkspaceMetricGrid
        className="mission-control-metrics agent-control-metrics"
        metrics={[
          { label: 'status', value: state.identity.status },
          { label: 'model', value: state.identity.model },
          { label: 'profile', value: state.identity.activeProfileLabel, wide: true },
          { label: 'jobs', value: `${summary.active}/${summary.total}` },
          { label: 'approval rate', value: `${approvalRate}%` },
          { label: 'next run', value: formatDateTime(summary.nextRunAt), wide: true },
        ]}
      />

      <WorkspaceSectionFrame
        className="mission-control-list-frame"
        eyebrow="active model"
        title={`${state.identity.provider} / ${state.identity.profile}`}
        meta={editable ? 'admin editable' : 'view only'}
      >
        <div className="agent-control-profile-panel">
          <div>
            <span>last connection</span>
            <strong>{formatDateTime(state.identity.lastConnectedAt)}</strong>
          </div>
          <div>
            <span>estimated usage</span>
            <strong>{formatCompactNumber(state.usage.estimatedTokens)} tokens / ${state.usage.estimatedCostUsd.toFixed(2)}</strong>
          </div>
          {editable ? (
            <WorkspaceButton
              variant="secondary"
              className="agent-control-edit-button"
              aria-expanded={profileEditorOpen}
              onClick={() => setProfileEditorOpen((open) => !open)}
            >
              {profileEditorOpen ? 'Close editor' : 'Edit profile'}
            </WorkspaceButton>
          ) : null}
        </div>
        {profileEditorOpen ? (
          <div className="agent-control-edit-panel">
            <span>mock editor</span>
            <strong>backend enforcement not connected</strong>
            <p>Profile and permission changes are displayed here first, then will move behind an admin command approval.</p>
          </div>
        ) : null}
      </WorkspaceSectionFrame>

      <WorkspaceSectionFrame
        className="mission-control-list-frame"
        eyebrow="cron / automation"
        title="scheduled work"
        meta={`${summary.failed} failed`}
      >
        <div className="mission-control-card-list" role="list" aria-label="Agent scheduled work">
          {jobs.map((job) => (
            <AgentJobCard key={job.id} job={job} />
          ))}
        </div>
      </WorkspaceSectionFrame>

      <WorkspaceSectionFrame
        className="mission-control-list-frame"
        eyebrow="tool permissions"
        title="agent gates"
        meta={editable ? 'editable' : 'locked'}
      >
        <div className="mission-control-compact-list" role="list" aria-label="Agent tool permissions">
          {permissions.map((permission) => (
            <AgentPermissionRow key={permission.id} permission={permission} editable={editable} />
          ))}
        </div>
      </WorkspaceSectionFrame>

      <WorkspaceSectionFrame
        className="mission-control-list-frame"
        eyebrow="recent activity"
        title="audit timeline"
        meta={`${activity.length} records`}
      >
        <div className="mission-control-compact-list" role="list" aria-label="Agent activity timeline">
          {activity.slice(0, 6).map((item) => (
            <AgentActivityRow key={item.id} activity={item} />
          ))}
        </div>
      </WorkspaceSectionFrame>
    </WorkspaceContentShell>
  );
}
