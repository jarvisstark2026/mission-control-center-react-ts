import type { ReactNode } from 'react';

import { classNames } from '../../lib/classNames';
import { WorkspaceButton, WorkspaceCatalogGrid, type WorkspaceCatalogCard } from './workspaceBlocks';
import type { DesktopAppRecord } from './workspaceDesktopApps';

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
