import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { classNames } from '../../lib/classNames';
import type { DesktopAppRecord } from './workspaceDesktopApps';
import type { WorkspaceWidget } from './workspaceTypes';

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

export function WorkspaceContentShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={classNames('workspace-content-shell', className)}>{children}</div>;
}

export function WorkspaceContentHeader({
  eyebrow,
  title,
  metaEyebrow,
  meta,
  className,
}: {
  eyebrow: ReactNode;
  title: ReactNode;
  metaEyebrow?: ReactNode;
  meta?: ReactNode;
  className?: string;
}) {
  return (
    <div className={classNames('workspace-content-head', className)}>
      <div>
        <span>{eyebrow}</span>
        <strong>{title}</strong>
      </div>
      {metaEyebrow || meta ? (
        <div className="workspace-content-head-meta">
          {metaEyebrow ? <span>{metaEyebrow}</span> : null}
          {meta ? <small>{meta}</small> : null}
        </div>
      ) : null}
    </div>
  );
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

export function WorkspaceSummaryPanel({
  title,
  children,
  className,
}: {
  title: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={classNames('workspace-summary-panel', className)}>
      <strong>{title}</strong>
      {children ? <p>{children}</p> : null}
    </div>
  );
}

type WorkspaceButtonVariant = 'primary' | 'secondary' | 'destructive' | 'compact' | 'icon';

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
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

export function DesktopBridgePanel({
  eyebrow,
  title,
  description,
  inputLabel,
  inputValue,
  inputPlaceholder,
  submitLabel,
  apps,
  onChangeInput,
  onSubmit,
  onSelectApp,
  appsLabel,
  className,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  inputLabel: string;
  inputValue: string;
  inputPlaceholder: string;
  submitLabel: string;
  apps: DesktopAppRecord[];
  onChangeInput: (value: string) => void;
  onSubmit: () => void;
  onSelectApp?: (app: DesktopAppRecord) => void;
  appsLabel?: string;
  className?: string;
  children?: ReactNode;
}) {
  const hasInput = inputValue.trim().length > 0;
  const isAppSelectable = typeof onSelectApp === 'function' && apps.length > 0;
  const handleSelectApp = (item: WorkspaceCatalogCard) => {
    const selectedApp = apps.find((app) => app.name === item.id);

    if (selectedApp) {
      onSelectApp?.(selectedApp);
    }
  };

  return (
    <div className={classNames('launcher-desktop-bridge', className)}>
      <div className="launcher-desktop-head">
        <span>{eyebrow}</span>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
      <div className="launcher-desktop-controls">
        <label className="launcher-desktop-input">
          <span>{inputLabel}</span>
          <input
            type="text"
            value={inputValue}
            onChange={(event) => onChangeInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && hasInput) {
                onSubmit();
              }
            }}
            placeholder={inputPlaceholder}
          />
        </label>
        <WorkspaceButton className="launcher-desktop-button" onClick={onSubmit} disabled={!hasInput}>
          {submitLabel}
        </WorkspaceButton>
      </div>
      <WorkspaceCatalogGrid
        className="launcher-desktop-list"
        variant="desktop"
        ariaLabel={appsLabel ?? `${eyebrow} apps`}
        items={apps.map((app) => ({
          id: app.name,
          label: app.name,
          note: app.note,
        }))}
        onSelect={isAppSelectable ? handleSelectApp : undefined}
      />
      {children}
    </div>
  );
}
