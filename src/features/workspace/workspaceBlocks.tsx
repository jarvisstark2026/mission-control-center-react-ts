import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { classNames } from '../../lib/classNames';
import type { WorkspaceWidget } from './workspaceTypes';

export type WidgetSourceState = 'local' | 'live' | 'bridge' | 'file' | 'browser' | 'unavailable';

export type WidgetPrimaryAction = {
  label: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  title?: string;
  roleGate?: ReactNode;
};

export type WidgetCompactItem = {
  id: string;
  title: ReactNode;
  meta?: ReactNode;
  detail?: ReactNode;
  state?: string;
  action?: WidgetPrimaryAction;
};

export function WorkspaceWidgetFrame({
  kind,
  className,
  children,
}: {
  kind: WorkspaceWidget['kind'];
  className?: string;
  children: ReactNode;
}) {
  return <div className={classNames('workspace-widget-frame', `kind-${kind}`, className)}>{children}</div>;
}

export function WidgetScrollPane({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={classNames('widget-scroll-pane', className)}>{children}</div>;
}

export function WorkspaceContentShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={classNames('workspace-content-shell', className)}>{children}</div>;
}

export function WorkspaceSectionFrame({
  eyebrow,
  title,
  meta,
  children,
  className,
}: {
  eyebrow?: ReactNode;
  title?: ReactNode;
  meta?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section className={classNames('workspace-section-frame', className)}>
      {eyebrow || title || meta ? (
        <div className="workspace-section-head">
          <div>
            {eyebrow ? <span>{eyebrow}</span> : null}
            {title ? <strong>{title}</strong> : null}
          </div>
          {meta ? <small>{meta}</small> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

type WorkspaceButtonVariant = 'primary' | 'secondary' | 'destructive' | 'compact' | 'icon';

export type TopBarGroupId = 'viewport' | 'layout' | 'visuals' | 'operator' | 'launch' | 'hermes-hud';

export function WorkspaceButton({
  variant = 'primary',
  className,
  children,
  type = 'button',
  ...buttonProps
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: WorkspaceButtonVariant;
}) {
  return (
    <button
      {...buttonProps}
      type={type}
      className={classNames('workspace-button', `workspace-button-${variant}`, className)}
    >
      {children}
    </button>
  );
}

export type WorkspaceMetric = {
  label: string;
  value: ReactNode;
  wide?: boolean;
};

export function WorkspaceMetricGrid({ metrics, className }: { metrics: WorkspaceMetric[]; className?: string }) {
  return (
    <div className={classNames('workspace-metric-grid', className)}>
      {metrics.map((metric, index) => (
        <div
          key={`${metric.label}-${index}`}
          className={classNames('metric-tile', metric.wide && 'metric-wide')}
        >
          <span>{metric.label}</span>
          <strong>{metric.value}</strong>
        </div>
      ))}
    </div>
  );
}

export type WorkspaceCatalogCard = {
  id: string;
  label: string;
  note: string;
  badge?: string;
  active?: boolean;
  state?: string;
};

const catalogVariantClassNames: Record<'launcher' | 'market' | 'live-tv' | 'desktop', string> = {
  launcher: 'launcher-app',
  market: 'market-graph-item',
  'live-tv': 'live-tv-preset',
  desktop: 'launcher-desktop-item',
};

export function WorkspaceCatalogGrid({
  items,
  variant,
  ariaLabel,
  onSelect,
  onDoubleSelect,
  className,
}: {
  items: WorkspaceCatalogCard[];
  variant: 'launcher' | 'market' | 'live-tv' | 'desktop';
  ariaLabel?: string;
  onSelect?: (item: WorkspaceCatalogCard) => void;
  onDoubleSelect?: (item: WorkspaceCatalogCard) => void;
  className?: string;
}) {
  const itemClassName = catalogVariantClassNames[variant];

  return (
    <div className={classNames('workspace-catalog-grid', className)} role={ariaLabel ? 'group' : undefined} aria-label={ariaLabel}>
      {items.map((item) => {
        const content = (
          <>
            {item.badge || item.active || item.state ? (
              <span>{item.badge ?? (item.active ? 'open' : item.state ?? 'ready')}</span>
            ) : null}
            <strong>{item.label}</strong>
            <small>{item.note}</small>
          </>
        );

        if (!onSelect && !onDoubleSelect) {
          return (
            <div key={item.id} className={classNames(itemClassName, item.active && 'is-active')} data-state={item.state}>
              {content}
            </div>
          );
        }

        return (
          <button
            key={item.id}
            type="button"
            className={classNames(itemClassName, item.active && 'is-active')}
            data-state={item.state}
            aria-pressed={typeof item.active === 'boolean' ? item.active : undefined}
            onClick={onSelect ? () => onSelect(item) : undefined}
            onDoubleClick={onDoubleSelect ? () => onDoubleSelect(item) : undefined}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}

export type WorkspaceRow = {
  id: string;
  primary: string;
  secondary?: string;
  meta?: string;
};

export function WorkspaceRowList({
  rows,
  className,
  ariaLabel,
}: {
  rows: WorkspaceRow[];
  className?: string;
  ariaLabel?: string;
}) {
  const itemRole = ariaLabel ? 'listitem' : undefined;

  return (
    <div className={classNames('workspace-row-list', className)} role={ariaLabel ? 'list' : undefined} aria-label={ariaLabel}>
      {rows.map((row) => (
        <div key={row.id} className="workspace-row" role={itemRole}>
          <span>{row.primary}</span>
          {row.secondary ? <strong>{row.secondary}</strong> : null}
          {row.meta ? <small>{row.meta}</small> : null}
        </div>
      ))}
    </div>
  );
}

export type WorkspaceActionRow = {
  id: string;
  primary: string;
  secondary?: string;
  meta?: string;
  pinned?: boolean;
};

export function WorkspaceActionRowList({
  rows,
  className,
  ariaLabel,
  onFocusRow,
  onTogglePinRow,
  onCloseRow,
}: {
  rows: WorkspaceActionRow[];
  className?: string;
  ariaLabel?: string;
  onFocusRow: (rowId: string) => void;
  onTogglePinRow?: (rowId: string) => void;
  onCloseRow: (rowId: string) => void;
}) {
  const itemRole = ariaLabel ? 'listitem' : undefined;

  return (
    <div className={classNames('workspace-action-row-list', className)} role={ariaLabel ? 'list' : undefined} aria-label={ariaLabel}>
      {rows.map((row) => (
        <div key={row.id} className="workspace-action-row" role={itemRole}>
          <button type="button" className="workspace-action-row-button" onClick={() => onFocusRow(row.id)}>
            <span>{row.primary}</span>
            {row.secondary ? <strong>{row.secondary}</strong> : null}
            {row.meta ? <small>{row.meta}</small> : null}
          </button>
          {onTogglePinRow ? (
            <button
              type="button"
              className={classNames('workspace-action-row-pin', row.pinned && 'is-active')}
              onClick={() => onTogglePinRow(row.id)}
              aria-pressed={Boolean(row.pinned)}
              aria-label={row.pinned ? `Unpin ${row.primary}` : `Pin ${row.primary}`}
              title={row.pinned ? `Unpin ${row.primary}` : `Pin ${row.primary}`}
            >
              <span className="widget-pin-icon" aria-hidden="true" />
            </button>
          ) : null}
          <button
            type="button"
            className="workspace-action-row-close"
            onClick={() => onCloseRow(row.id)}
            disabled={Boolean(row.pinned)}
            aria-label={row.pinned ? `${row.primary} is pinned` : `Close ${row.primary}`}
            title={row.pinned ? `${row.primary} is pinned` : `Close ${row.primary}`}
          >
            <span className="widget-control-icon widget-control-icon-close" aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
}

export function WorkspaceStatusStrip({
  source,
  status,
  count,
  updatedAt,
  action,
  className,
}: {
  source: WidgetSourceState;
  status: ReactNode;
  count?: ReactNode;
  updatedAt?: ReactNode;
  action?: WidgetPrimaryAction;
  className?: string;
}) {
  return (
    <section className={classNames('workspace-status-strip', className)} data-source={source} aria-label="Widget status">
      <span className="workspace-status-source">{source}</span>
      <strong className="workspace-status-main">{status}</strong>
      {count ? <small className="workspace-status-count">{count}</small> : null}
      {updatedAt ? <small className="workspace-status-update">{updatedAt}</small> : null}
      {action ? (
        <WorkspaceButton
          variant="compact"
          className="workspace-status-action"
          disabled={action.disabled}
          onClick={action.onClick}
          title={action.title}
        >
          {action.label}
        </WorkspaceButton>
      ) : null}
      {action?.roleGate ? <small className="workspace-status-gate">{action.roleGate}</small> : null}
    </section>
  );
}

export function WorkspaceCompactList({
  items,
  empty,
  ariaLabel,
  className,
}: {
  items: WidgetCompactItem[];
  empty: ReactNode;
  ariaLabel?: string;
  className?: string;
}) {
  if (!items.length) {
    return <p className={classNames('workspace-compact-empty', className)}>{empty}</p>;
  }

  return (
    <div className={classNames('workspace-compact-list', className)} role={ariaLabel ? 'list' : undefined} aria-label={ariaLabel}>
      {items.map((item) => (
        <div key={item.id} className="workspace-compact-row" data-state={item.state} role={ariaLabel ? 'listitem' : undefined}>
          <span>{item.meta}</span>
          <strong>{item.title}</strong>
          {item.detail ? <small>{item.detail}</small> : null}
          {item.action ? (
            <WorkspaceButton
              variant="compact"
              className="workspace-compact-row-action"
              disabled={item.action.disabled}
              onClick={item.action.onClick}
              title={item.action.title}
            >
              {item.action.label}
            </WorkspaceButton>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function WorkspaceEmptyState({
  source,
  title,
  detail,
  action,
  className,
}: {
  source: WidgetSourceState;
  title: ReactNode;
  detail?: ReactNode;
  action?: WidgetPrimaryAction;
  className?: string;
}) {
  return (
    <div className={classNames('workspace-empty-state', className)} data-source={source}>
      <span>{source}</span>
      <strong>{title}</strong>
      {detail ? <p>{detail}</p> : null}
      {action ? (
        <WorkspaceButton
          variant="secondary"
          disabled={action.disabled}
          onClick={action.onClick}
          title={action.title}
        >
          {action.label}
        </WorkspaceButton>
      ) : null}
    </div>
  );
}

export function WorkspaceTopBarGroup({
  id,
  label,
  children,
  className,
}: {
  id: TopBarGroupId;
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={classNames('workspace-topbar-group', `workspace-topbar-group-${id}`, className)} role="group" aria-label={label}>
      {children}
    </div>
  );
}

export function WorkspaceTopBarButton({
  active = false,
  className,
  icon,
  label,
  title = label,
  children,
  ...buttonProps
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
  icon?: ReactNode;
  label: string;
}) {
  return (
    <WorkspaceButton
      {...buttonProps}
      variant="compact"
      aria-label={label}
      title={title}
      className={classNames('workspace-launch-button', 'workspace-topbar-button', active && 'is-active', className)}
    >
      {icon ? <span className="workspace-topbar-button-icon" aria-hidden="true">{icon}</span> : null}
      {children ? <span className="workspace-topbar-button-label">{children}</span> : null}
    </WorkspaceButton>
  );
}
