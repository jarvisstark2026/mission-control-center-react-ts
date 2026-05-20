import { ActionButton } from '../../components/ui/ActionButton';
import { SectionHeader } from '../../components/ui/SectionHeader';
import { StatusChip } from '../../components/ui/StatusChip';
import { Workspace } from '../workspace/Workspace';
import type { WorkspaceWidget } from '../workspace/workspaceTypes';
import { getShellNavPanelKind, type ShellNavItem } from './nav';
import { shellScopes, type ShellRole } from './roles';
import { getPanelLabel, getShellCopy } from './shellCopy';

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
    <div className={`shell-branding ${detached ? 'shell-branding-window' : ''}`}>
      <p className="shell-eyebrow">Mission Control Center</p>
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
    <section className="shell-frame shell-frame-window" aria-label="Mission Control Center window">
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

        <Workspace panelKind={activePanelKind} />
      </div>
    </section>
  );
}

export function ShellRail({
  activeNavId,
  activePanelKind,
  activePanelLabel,
  activeRole,
  activeRoleLabel,
  isRailOpen,
  visibleItems,
  onNavigatePanel,
  onNavigateRole,
}: ShellBrandingProps & {
  activeNavId: string;
  isRailOpen: boolean;
  visibleItems: ShellNavItem[];
  onNavigatePanel: (target: WorkspaceWidget['kind'] | null) => void;
  onNavigateRole: (targetRole: ShellRole) => void;
}) {
  const isNavItemActive = (itemId: string) => itemId === activeNavId;

  return (
    <aside
      id="shell-rail"
      className={`shell-rail ${isRailOpen ? 'is-open' : 'is-closed'}`}
      aria-label="Role navigation"
      aria-hidden={!isRailOpen}
      inert={!isRailOpen}
    >
      <ShellBranding
        activePanelKind={activePanelKind}
        activePanelLabel={activePanelLabel}
        activeRole={activeRole}
        activeRoleLabel={activeRoleLabel}
      />

      <div className="shell-scope-group">
        <SectionHeader eyebrow="Access" title="Scopes" description="Choose the operating band before opening a surface." />
        <ul className="shell-scope-list">
          {shellScopes.map((scope) => (
            <li key={scope.id} className={scope.id === activeRole ? 'is-active' : undefined}>
              <button
                type="button"
                className={`shell-nav-button shell-scope-button ${scope.id === activeRole ? 'is-active' : ''}`}
                aria-pressed={scope.id === activeRole}
                onClick={() => onNavigateRole(scope.id)}
              >
                <span>{scope.label}</span>
                <small>{scope.description}</small>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="shell-nav-group">
        <SectionHeader
          eyebrow="Routing"
          title="Navigation"
          description="Open the relevant control surface without the usual detour through a menu maze."
        />
        <ul className="shell-nav-list">
          {visibleItems.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className={`shell-nav-button ${isNavItemActive(item.id) ? 'is-active' : ''}`}
                aria-current={isNavItemActive(item.id) ? 'page' : undefined}
                onClick={() => onNavigatePanel(getShellNavPanelKind(item))}
              >
                <span>{item.label}</span>
                <small>{item.hint}</small>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
