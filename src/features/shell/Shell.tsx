import { Workspace } from '../workspace/Workspace';
import { getVisibleShellNavItems } from './nav';
import { shellScopes, type ShellRole } from './roles';
import './shell.css';

const defaultRole: ShellRole = 'support';

export function Shell() {
  const visibleItems = getVisibleShellNavItems(defaultRole);

  return (
    <section className="shell-frame" aria-label="Mission Control Center shell">
      <aside className="shell-rail" aria-label="Role navigation">
        <div className="shell-branding">
          <p className="shell-eyebrow">Mission Control Center</p>
          <h1>Spatial command surface</h1>
          <p className="shell-copy">
            Role-aware navigation is now present in skeleton form. No grand theatrics yet; merely
            the machinery necessary to avoid a menu bar pretending to be architecture.
          </p>
        </div>

        <div className="shell-scope-group">
          <p className="shell-section-label">Scopes</p>
          <ul className="shell-scope-list">
            {shellScopes.map((scope) => (
              <li key={scope.id} className={scope.id === defaultRole ? 'is-active' : undefined}>
                <span>{scope.label}</span>
                <small>{scope.description}</small>
              </li>
            ))}
          </ul>
        </div>

        <div className="shell-nav-group">
          <p className="shell-section-label">Navigation</p>
          <ul className="shell-nav-list">
            {visibleItems.map((item) => (
              <li key={item.id}>
                <span>{item.label}</span>
                <small>{item.hint}</small>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <div className="shell-workspace">
        <Workspace />
      </div>
    </section>
  );
}