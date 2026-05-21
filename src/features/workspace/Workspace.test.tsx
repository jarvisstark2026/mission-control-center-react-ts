import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Workspace } from './Workspace';

describe('Workspace header controls', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.replaceState({}, '', '/?role=support');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    window.history.replaceState({}, '', '/?role=support');
  });

  it('opens a blank workspace extension without clearing the current workspace', () => {
    const focus = vi.fn();
    const open = vi.spyOn(window, 'open').mockReturnValue({ focus } as unknown as Window);
    const { container } = render(<Workspace />);

    const initialWidgetCount = container.querySelectorAll('.workspace-widget').length;
    expect(initialWidgetCount).toBeGreaterThan(0);

    fireEvent.click(screen.getByLabelText('Create blank workspace'));

    expect(container.querySelectorAll('.workspace-widget')).toHaveLength(initialWidgetCount);
    expect(open).toHaveBeenCalledOnce();
    expect(open.mock.calls[0]?.[0]).toContain('workspace=extension');
    expect(open.mock.calls[0]?.[0]).not.toContain('panel=');
    expect(focus).toHaveBeenCalledOnce();
  });

  it('renders the workspace extension route as an empty canvas', () => {
    window.history.replaceState({}, '', '/?role=support&workspace=extension');
    const { container } = render(<Workspace />);
    const currentRender = within(container);

    expect(container.querySelectorAll('.workspace-widget')).toHaveLength(0);
    expect(currentRender.queryByLabelText('Create blank workspace')).not.toBeInTheDocument();
    expect(currentRender.getByLabelText('Close workspace extension')).toBeInTheDocument();
  });

  it('closes the workspace extension button back to the hub when the window cannot close itself', () => {
    window.history.replaceState({}, '', '/?role=admin&workspace=extension');
    vi.spyOn(window, 'close').mockImplementation(() => undefined);

    const { container } = render(<Workspace />);
    const currentRender = within(container);

    fireEvent.click(currentRender.getByLabelText('Close workspace extension'));

    expect(window.close).toHaveBeenCalledOnce();
    expect(window.location.search).toBe('?role=admin');
  });

  it('opens workspace launcher cards on double-click, not single click', () => {
    const { container } = render(<Workspace />);

    const getRegistryCard = () => {
      const launcherCards = Array.from(container.querySelectorAll<HTMLButtonElement>('.launcher-grid .launcher-app'));
      const registryCard = launcherCards.find((button) => button.textContent?.includes('Registry')) ?? null;

      if (!registryCard) {
        throw new Error('Registry launcher card was not rendered');
      }

      return registryCard;
    };

    const closedRegistryCard = getRegistryCard();
    expect(closedRegistryCard).toHaveTextContent(/closed/i);
    expect(closedRegistryCard).toHaveTextContent(/double-click to open/i);

    fireEvent.click(closedRegistryCard);

    expect(getRegistryCard()).toHaveTextContent(/closed/i);

    fireEvent.doubleClick(closedRegistryCard);

    expect(getRegistryCard()).toHaveTextContent(/open/i);
    expect(getRegistryCard()).toHaveTextContent(/double-click to focus/i);

    const registryWidget = container.querySelector<HTMLElement>('.workspace-widget.kind-window-manager');
    expect(registryWidget).toHaveStyle({ left: '428px', top: '281px' });
    expect(registryWidget?.querySelector('.widget-scroll-pane')).toBeInTheDocument();
    expect(registryWidget?.querySelector('.workspace-content-head.window-manager-head')).not.toBeInTheDocument();
  });
});
