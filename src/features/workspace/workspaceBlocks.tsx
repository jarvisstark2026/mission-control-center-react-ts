import type { ReactNode } from 'react';

export type WorkspaceMetric = {
  label: string;
  value: ReactNode;
  wide?: boolean;
};

export function WorkspaceMetricGrid({ metrics, className }: { metrics: WorkspaceMetric[]; className?: string }) {
  return (
    <div className={["workspace-metric-grid", className].filter(Boolean).join(' ')}>
      {metrics.map((metric) => (
        <div key={metric.label} className={["metric-tile", metric.wide ? 'metric-wide' : null].filter(Boolean).join(' ')}>
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
  className,
}: {
  items: WorkspaceCatalogCard[];
  variant: 'launcher' | 'market' | 'live-tv' | 'desktop';
  ariaLabel?: string;
  onSelect?: (item: WorkspaceCatalogCard) => void;
  className?: string;
}) {
  const itemClassName = catalogVariantClassNames[variant];

  return (
    <div className={["workspace-catalog-grid", className].filter(Boolean).join(' ')} role={ariaLabel ? 'group' : undefined} aria-label={ariaLabel}>
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

        if (!onSelect) {
          return (
            <div key={item.id} className={[itemClassName, item.active ? 'is-active' : null].filter(Boolean).join(' ')} data-state={item.state}>
              {content}
            </div>
          );
        }

        return (
          <button
            key={item.id}
            type="button"
            className={[itemClassName, item.active ? 'is-active' : null].filter(Boolean).join(' ')}
            data-state={item.state}
            aria-pressed={item.active}
            onClick={() => onSelect(item)}
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
  return (
    <div className={["workspace-row-list", className].filter(Boolean).join(' ')} role={ariaLabel ? 'list' : undefined} aria-label={ariaLabel}>
      {rows.map((row) => (
        <div key={row.id} className="workspace-row" role="listitem">
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
  onCloseRow,
}: {
  rows: WorkspaceActionRow[];
  className?: string;
  ariaLabel?: string;
  onFocusRow: (rowId: string) => void;
  onCloseRow: (rowId: string) => void;
}) {
  return (
    <div className={["workspace-action-row-list", className].filter(Boolean).join(' ')} role={ariaLabel ? 'list' : undefined} aria-label={ariaLabel}>
      {rows.map((row) => (
        <div key={row.id} className="workspace-action-row" role="listitem">
          <button type="button" className="workspace-action-row-button" onClick={() => onFocusRow(row.id)}>
            <span>{row.primary}</span>
            {row.secondary ? <strong>{row.secondary}</strong> : null}
            {row.meta ? <small>{row.meta}</small> : null}
          </button>
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

export type DesktopAppRecord = {
  name: string;
  note: string;
};

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
    <div className={["launcher-desktop-bridge", className].filter(Boolean).join(' ')}>
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
        <button type="button" className="launcher-desktop-button" onClick={onSubmit} disabled={!hasInput}>
          {submitLabel}
        </button>
      </div>
      <WorkspaceCatalogGrid
        className="launcher-desktop-list"
        variant="desktop"
        ariaLabel={`${eyebrow} apps`}
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
