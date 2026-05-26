import { useCallback, useRef, useState, type DragEvent, type PointerEvent } from 'react';

import { ActionButton } from '../../components/ui/ActionButton';
import { StatusChip } from '../../components/ui/StatusChip';
import { classNames } from '../../lib/classNames';
import { useDismissibleMenu } from '../../lib/useDismissibleMenu';
import { Workspace } from '../workspace/Workspace';
import { WorkspaceNewScreenButton } from '../workspace/WorkspaceScreenButton';
import {
  isWorkspaceInstanceOpen,
  maxWorkspaceExtensionInstances,
  type WorkspaceInstance,
  type WorkspacePlacement,
  workspacePlacements,
} from '../workspace/workspaceInstances';
import type { WorkspaceWidget } from '../workspace/workspaceTypes';
import { shellScopes, type ShellRole } from './roles';
import { getPanelLabel, getShellCopy } from './shellCopy';
import { shellThemeOptions, type ShellThemeId } from './themes';

type ShellBrandingProps = {
  activePanelKind: WorkspaceWidget['kind'] | null;
  activePanelLabel: string;
  activeRole: ShellRole;
  activeRoleLabel: string;
  detached?: boolean;
};

function ShellBranding({
  activePanelKind,
  activePanelLabel,
  activeRole,
  activeRoleLabel,
  detached = false,
}: ShellBrandingProps) {
  return (
    <div className={classNames('shell-branding', detached && 'shell-branding-window')}>
      <p className="shell-eyebrow">Mission Control</p>
      <h1>{detached && activePanelKind ? getPanelLabel(activePanelKind) : 'Spatial command surface'}</h1>
      <div className="shell-meta" aria-label={detached ? 'Window context' : 'Current context'} role="status" aria-live="polite" aria-atomic="true">
        <StatusChip tone="cool">{activeRoleLabel}</StatusChip>
        <StatusChip tone="ice">{activePanelLabel}</StatusChip>
      </div>
      <p className="shell-copy">{getShellCopy(activeRole, activePanelKind, detached)}</p>
    </div>
  );
}

export function DetachedShellWindow({
  activePanelKind,
  activePanelLabel,
  activeRole,
  activeRoleLabel,
  canCloseDetachedWindow,
  onClose,
  onOpenHub,
}: ShellBrandingProps & {
  activePanelKind: WorkspaceWidget['kind'];
  canCloseDetachedWindow: boolean;
  onClose: () => void;
  onOpenHub: () => void;
}) {
  return (
    <section className="shell-frame shell-frame-window" aria-label="Mission Control window">
      <div className="shell-window">
        <div className="shell-window-head">
          <ShellBranding
            activePanelKind={activePanelKind}
            activePanelLabel={activePanelLabel}
            activeRole={activeRole}
            activeRoleLabel={activeRoleLabel}
            detached
          />

          <div className="shell-window-actions">
            <ActionButton variant="secondary" className="shell-window-button" onClick={onOpenHub}>
              Open hub
            </ActionButton>
            <ActionButton variant="ghost" className="shell-window-button is-muted" onClick={onClose}>
              {canCloseDetachedWindow ? 'Close screen' : 'Return to hub'}
            </ActionButton>
          </div>
        </div>

        <Workspace panelKind={activePanelKind} role={activeRole} />
      </div>
    </section>
  );
}

export function ShellRail({
  isRailOpen,
  workspaceInstances,
  onCreateWorkspaceInstance,
  onOpenMainWorkspace,
  onOpenWorkspaceInstance,
  onCloseWorkspaceInstance,
  onPlaceWorkspaceInstance,
}: {
  isRailOpen: boolean;
  workspaceInstances: WorkspaceInstance[];
  onCreateWorkspaceInstance: () => void;
  onOpenMainWorkspace: () => void;
  onOpenWorkspaceInstance: (id: string) => void;
  onCloseWorkspaceInstance: (id: string) => void;
  onPlaceWorkspaceInstance: (id: string, placement: WorkspacePlacement) => void;
}) {
  const [draggedWorkspaceId, setDraggedWorkspaceId] = useState<string | null>(null);
  const extensionInstances = workspaceInstances.filter((instance) => instance.kind === 'extension');
  const placementLabels: Record<WorkspacePlacement, string> = {
    'top-left': 'Top left',
    top: 'Top',
    'top-right': 'Top right',
    left: 'Left',
    center: 'Center',
    right: 'Right',
    'bottom-left': 'Bottom left',
    bottom: 'Bottom',
    'bottom-right': 'Bottom right',
  };
  const getPlacedInstance = (placement: WorkspaceInstance['placement']) =>
    workspaceInstances.find((instance) => instance.placement === placement);
  const getPlacementLabel = (placement: WorkspaceInstance['placement']) => placementLabels[placement];
  const getWorkspaceStatusLabel = (instance: WorkspaceInstance) => (isWorkspaceInstanceOpen(instance) ? 'ON' : 'SAVED');
  const getWorkspaceStatusClass = (instance: WorkspaceInstance) => (isWorkspaceInstanceOpen(instance) ? 'is-on' : 'is-saved');
  const getCompactWorkspaceLabel = (instance: WorkspaceInstance) => {
    if (instance.kind === 'main') return 'Main';
    const number = instance.label.match(/\d+/)?.[0];
    return number ? `W${number}` : instance.label;
  };
  const arrangementSlots: WorkspaceInstance['placement'][] = [...workspacePlacements];
  const isAtWorkspaceCapacity = extensionInstances.length >= maxWorkspaceExtensionInstances;
  const isArrangementPlacement = (placement: string | undefined): placement is WorkspacePlacement =>
    Boolean(placement && arrangementSlots.includes(placement as WorkspacePlacement));
  const placeWorkspaceInstance = (id: string, placement: WorkspacePlacement) => {
    onPlaceWorkspaceInstance(id, placement);
    setDraggedWorkspaceId(null);
  };
  const startWorkspaceDrag = (event: DragEvent<HTMLElement>, id: string) => {
    setDraggedWorkspaceId(id);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', id);
  };
  const moveWorkspaceToPlacement = (event: DragEvent<HTMLElement>, placement: WorkspacePlacement) => {
    event.preventDefault();
    const draggedId = event.dataTransfer.getData('text/plain') || draggedWorkspaceId;
    if (!draggedId) return;

    placeWorkspaceInstance(draggedId, placement);
  };
  const startWorkspacePointerDrag = (event: PointerEvent<HTMLElement>, id: string) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    setDraggedWorkspaceId(id);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const finishWorkspacePointerDrag = (event: PointerEvent<HTMLElement>) => {
    if (!draggedWorkspaceId) return;

    const target =
      typeof document.elementFromPoint === 'function' ? document.elementFromPoint(event.clientX, event.clientY) : null;
    const placementTarget = target?.closest<HTMLElement>('[data-placement]');
    const placement = placementTarget?.dataset.placement;

    if (isArrangementPlacement(placement)) {
      placeWorkspaceInstance(draggedWorkspaceId, placement);
      return;
    }

    setDraggedWorkspaceId(null);
  };
  const selectOrPlaceArrangementWorkspace = (placement: WorkspacePlacement, placedInstance?: WorkspaceInstance) => {
    if (draggedWorkspaceId) {
      placeWorkspaceInstance(draggedWorkspaceId, placement);
      return;
    }

    if (placedInstance) {
      setDraggedWorkspaceId(placedInstance.id);
    }
  };

  return (
    <aside
      id="shell-rail"
      className={classNames('shell-rail', isRailOpen ? 'is-open' : 'is-closed')}
      aria-label="Workspace navigation"
      aria-hidden={!isRailOpen}
      inert={!isRailOpen}
    >
      <div className="shell-instance-group">
        <div className="shell-instance-head">
          <div>
            <p className="shell-eyebrow">Mission Control</p>
            <h2>Workspaces</h2>
          </div>
          <WorkspaceNewScreenButton
            className="shell-instance-create"
            label="Create workspace instance"
            title={isAtWorkspaceCapacity ? 'Workspace instance limit reached' : 'Create workspace instance'}
            disabled={isAtWorkspaceCapacity}
            onClick={onCreateWorkspaceInstance}
          />
        </div>
        <p className="shell-instance-copy">ON accepts edge transfers. SAVED keeps its layout.</p>

        <ul className="shell-instance-list" aria-label="Workspace instances">
          {workspaceInstances.map((instance) => (
            <li
              key={instance.id}
              className={classNames('shell-instance-item', instance.active && 'is-active', getWorkspaceStatusClass(instance))}
              data-workspace-instance-id={instance.id}
              draggable
              onDragStart={(event) => startWorkspaceDrag(event, instance.id)}
              onDragEnd={() => setDraggedWorkspaceId(null)}
            >
              <button
                type="button"
                className="shell-instance-button"
                aria-label={`${instance.label}, ${getWorkspaceStatusLabel(instance)}, ${getPlacementLabel(instance.placement)}`}
                aria-current={instance.active ? 'page' : undefined}
                onClick={instance.kind === 'main' ? onOpenMainWorkspace : () => onOpenWorkspaceInstance(instance.id)}
              >
                <span className="shell-instance-row">
                  <span className="shell-instance-status-dot" aria-hidden="true" />
                  <span className="shell-instance-name">{getCompactWorkspaceLabel(instance)}</span>
                  <strong>{getWorkspaceStatusLabel(instance)}</strong>
                </span>
                <small>{getPlacementLabel(instance.placement)}</small>
              </button>
              {instance.kind === 'extension' && isWorkspaceInstanceOpen(instance) ? (
                <button
                  type="button"
                  className="shell-instance-close"
                  aria-label={`Close ${instance.label}`}
                  title={`Close ${instance.label}`}
                  onClick={() => onCloseWorkspaceInstance(instance.id)}
                >
                  x
                </button>
              ) : null}
            </li>
          ))}
        </ul>

        <section className="shell-workspace-arrangement" aria-label="Workspace arrangement">
          <p className="shell-section-label">Extended layout</p>
          <div className="shell-arrangement-map">
            {arrangementSlots.map((placement) => {
              const placedInstance = getPlacedInstance(placement);

              return (
                <button
                  key={placement}
                  type="button"
                  className={classNames(
                    'shell-arrangement-cell',
                    placedInstance?.kind === 'main' && 'shell-arrangement-main',
                    placedInstance && 'is-occupied',
                    placedInstance && draggedWorkspaceId === placedInstance.id && 'is-selected',
                    placedInstance && getWorkspaceStatusClass(placedInstance),
                    draggedWorkspaceId && 'is-drop-target',
                  )}
                  data-placement={placement}
                  draggable={false}
                  aria-label={`${getPlacementLabel(placement)} workspace slot${placedInstance ? `, ${getWorkspaceStatusLabel(placedInstance)}` : ''}`}
                  aria-pressed={placedInstance && draggedWorkspaceId === placedInstance.id ? true : undefined}
                  onDragOver={(event) => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'move';
                  }}
                  onDrop={(event) => moveWorkspaceToPlacement(event, placement)}
                  onClick={() => selectOrPlaceArrangementWorkspace(placement, placedInstance)}
                  onPointerDown={placedInstance ? (event) => startWorkspacePointerDrag(event, placedInstance.id) : undefined}
                  onPointerUp={finishWorkspacePointerDrag}
                  onPointerCancel={() => setDraggedWorkspaceId(null)}
                >
                  {placedInstance ? (
                    <span className="shell-arrangement-content">
                      <span className="shell-instance-status-dot" aria-hidden="true" />
                      <span>{getCompactWorkspaceLabel(placedInstance)}</span>
                    </span>
                  ) : (
                    <span>{getPlacementLabel(placement)}</span>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </aside>
  );
}

export function ShellRoleMenu({
  activeRole,
  activeRoleLabel,
  onNavigateRole,
}: {
  activeRole: ShellRole;
  activeRoleLabel: string;
  onNavigateRole: (targetRole: ShellRole) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const closeMenu = useCallback(() => setIsOpen(false), []);

  useDismissibleMenu(isOpen, menuRef, closeMenu);

  const selectRole = (targetRole: ShellRole) => {
    closeMenu();
    onNavigateRole(targetRole);
  };

  return (
    <div className="shell-role-menu" ref={menuRef}>
      <button
        type="button"
        className="shell-role-menu-trigger"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        onClick={() => setIsOpen((open) => !open)}
      >
        <span>Access</span>
        <strong>{activeRoleLabel}</strong>
      </button>
      {isOpen ? (
        <div className="shell-role-menu-panel" role="menu" aria-label="Access scope menu">
          {shellScopes.map((scope) => (
            <button
              key={scope.id}
              type="button"
              className={classNames('shell-role-menu-item', scope.id === activeRole && 'is-active')}
              role="menuitemradio"
              aria-checked={scope.id === activeRole}
              onClick={() => selectRole(scope.id)}
            >
              <span>{scope.label}</span>
              <small>{scope.description}</small>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ShellThemeMenu({
  activeTheme,
  onSelectTheme,
}: {
  activeTheme: ShellThemeId;
  onSelectTheme: (themeId: ShellThemeId) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const closeMenu = useCallback(() => setIsOpen(false), []);
  const activeThemeOption = shellThemeOptions.find((theme) => theme.id === activeTheme) ?? shellThemeOptions[0];

  useDismissibleMenu(isOpen, menuRef, closeMenu);

  const selectTheme = (themeId: ShellThemeId) => {
    closeMenu();
    onSelectTheme(themeId);
  };

  return (
    <div className="shell-theme-menu" ref={menuRef}>
      <button
        type="button"
        className="shell-theme-menu-trigger"
        aria-label={`Theme ${activeThemeOption.label}`}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        onClick={() => setIsOpen((open) => !open)}
      >
        <span className="shell-theme-orb" aria-hidden="true">
          <span className={`shell-theme-swatch shell-theme-swatch-${activeThemeOption.id}`} />
        </span>
        <span className="shell-theme-trigger-copy">
          <span>Theme</span>
          <strong>{activeThemeOption.label}</strong>
        </span>
      </button>
      {isOpen ? (
        <div className="shell-theme-menu-panel" role="menu" aria-label="Theme menu">
          {shellThemeOptions.map((theme) => (
            <button
              key={theme.id}
              type="button"
              className={classNames('shell-theme-menu-item', theme.id === activeTheme && 'is-active')}
              role="menuitemradio"
              aria-checked={theme.id === activeTheme}
              onClick={() => selectTheme(theme.id)}
            >
              <span className={`shell-theme-swatch shell-theme-swatch-${theme.id}`} aria-hidden="true" />
              <span className="shell-theme-menu-copy">
                <span>{theme.label}</span>
                <small>{theme.description}</small>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
