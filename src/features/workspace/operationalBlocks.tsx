import type { ReactNode } from 'react';

import { classNames } from '../../lib/classNames';
import type { AgentDescriptor } from '../agent-control';
import type { CommandRisk } from '../mission-control';
import { WorkspaceButton } from './workspaceBlocks';

export function AttentionCard({
  label,
  title,
  children,
  risk,
  actions,
  className,
}: {
  label: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  risk?: CommandRisk | 'notice' | 'warning' | 'critical' | 'blocked' | 'online' | 'offline' | 'degraded';
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <article className={classNames('operational-attention-card', className)} data-state={risk}>
      <div className="operational-card-head">
        <div>
          <span>{label}</span>
          <strong>{title}</strong>
        </div>
        {risk ? <RiskBadge risk={risk} /> : null}
      </div>
      {children ? <div className="operational-card-body">{children}</div> : null}
      {actions ? <ActionStrip>{actions}</ActionStrip> : null}
    </article>
  );
}

export function EvidenceBlock({
  label,
  title,
  children,
}: {
  label: ReactNode;
  title?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="operational-evidence-block">
      <span>{label}</span>
      {title ? <strong>{title}</strong> : null}
      {children ? <p>{children}</p> : null}
    </div>
  );
}

export function ActionStrip({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={classNames('operational-action-strip', className)}>{children}</div>;
}

export function AuditList({
  items,
  empty,
}: {
  items: Array<{ id: string; title: ReactNode; detail?: ReactNode; meta?: ReactNode; state?: string }>;
  empty: ReactNode;
}) {
  if (!items.length) return <p className="operational-empty">{empty}</p>;

  return (
    <div className="operational-audit-list" role="list">
      {items.map((item) => (
        <div className="operational-audit-row" key={item.id} role="listitem" data-state={item.state}>
          <span>{item.meta}</span>
          <strong>{item.title}</strong>
          {item.detail ? <p>{item.detail}</p> : null}
        </div>
      ))}
    </div>
  );
}

export function RiskBadge({ risk }: { risk: CommandRisk | string }) {
  return (
    <span className="operational-risk-badge" data-state={risk}>
      {risk}
    </span>
  );
}

export function PermissionBadge({ level }: { level: string }) {
  return (
    <span className="operational-permission-badge" data-state={level}>
      {level}
    </span>
  );
}

export function AgentAttribution({
  agent,
  profile,
}: {
  agent: Pick<AgentDescriptor, 'name' | 'specialty'> | { name: string; specialty?: string };
  profile?: ReactNode;
}) {
  return (
    <div className="operational-agent-attribution">
      <span>{agent.specialty ?? 'agent'}</span>
      <strong>{agent.name}</strong>
      {profile ? <small>{profile}</small> : null}
    </div>
  );
}

export function WorkflowStepCard({
  index,
  title,
  assignee,
  status,
  approval,
  actionLabel,
  onAction,
  actions,
  disabled,
}: {
  index: number;
  title: ReactNode;
  assignee: ReactNode;
  status: string;
  approval?: ReactNode;
  actionLabel?: ReactNode;
  onAction?: () => void;
  actions?: Array<{ id: string; label: ReactNode; onClick: () => void; disabled?: boolean; variant?: 'primary' | 'secondary' | 'compact' | 'destructive' }>;
  disabled?: boolean;
}) {
  const stepActions = actions ?? (actionLabel && onAction ? [{ id: 'primary', label: actionLabel, onClick: onAction, disabled, variant: 'secondary' as const }] : []);

  return (
    <article className="operational-workflow-step" data-state={status}>
      <div className="operational-step-index">{index}</div>
      <div>
        <span>{assignee}</span>
        <strong>{title}</strong>
        {approval ? <small>{approval}</small> : null}
      </div>
      <div className="operational-step-status">
        <RiskBadge risk={status} />
        {stepActions.map((action) => (
          <WorkspaceButton
            key={action.id}
            variant={action.variant ?? 'secondary'}
            className="operational-step-action"
            disabled={action.disabled}
            onClick={action.onClick}
          >
            {action.label}
          </WorkspaceButton>
        ))}
      </div>
    </article>
  );
}
