import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App from './App';

describe('App', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    window.history.replaceState({}, '', '/?role=support');
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('renders the mission control workspace shell', () => {
    render(<App />);

    expect(screen.getAllByText('Mission Control Center').length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Mission Control Center shell')).toBeInTheDocument();
    expect(screen.getAllByText('Command core').length).toBeGreaterThan(0);
  }, 15000);

  it('keeps access scopes in a top workspace menu', () => {
    render(<App />);

    expect(screen.queryByText('Scopes')).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: /accesssupport/i })[0]);
    const menu = screen.getByRole('menu', { name: /access scope menu/i });
    fireEvent.click(within(menu).getByRole('menuitemradio', { name: /admin/i }));

    expect(window.location.search).toBe('?role=admin');
    expect(screen.getByRole('button', { name: /admin/i })).toBeInTheDocument();
  }, 15000);

  it('switches the workspace theme from the top bar', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /theme jarvis prime/i }));
    const menu = screen.getByRole('menu', { name: /theme menu/i });
    fireEvent.click(within(menu).getByRole('menuitemradio', { name: /mark iv ember/i }));

    expect(document.documentElement).toHaveAttribute('data-theme', 'ember');
    expect(window.localStorage.getItem('mission-control-center-theme')).toBe('ember');
  });

  it('uses the rail for saved workspace instances', () => {
    const popup = { close: vi.fn(), focus: vi.fn() } as unknown as Window;
    vi.spyOn(window, 'open').mockReturnValue(popup);

    render(<App />);

    const navigationButtons = screen.getAllByLabelText('Open workspace setup');
    const navigationButton = navigationButtons[0];
    expect(navigationButtons).toHaveLength(1);
    expect(navigationButton.closest('.workspace-footer-tab')).toBeInTheDocument();
    expect(navigationButton).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(navigationButton);

    expect(navigationButton).toHaveAttribute('aria-expanded', 'true');
    const rail = screen.getByLabelText('Workspace navigation');
    const workspaceList = within(rail).getByRole('list', { name: 'Workspace instances' });
    expect(rail).toHaveClass('is-open');
    expect(within(rail).getByRole('heading', { name: 'Workspaces' })).toBeInTheDocument();
    expect(within(workspaceList).getByRole('button', { name: /main workspace/i })).toBeInTheDocument();
    expect(within(rail).queryByText('Routing')).not.toBeInTheDocument();
    expect(within(rail).queryByRole('button', { name: /telemetry live system readouts/i })).not.toBeInTheDocument();

    fireEvent.click(within(rail).getByLabelText('Create workspace instance'));

    const closeInstance = within(rail).getByRole('button', { name: /close workspace 1/i });
    expect(closeInstance).toBeInTheDocument();
    expect(within(rail).getByRole('button', { name: /workspace 1, on, right/i })).toBeInTheDocument();
    expect(within(rail).getByRole('region', { name: 'Workspace arrangement' }).querySelectorAll('.shell-arrangement-cell')).toHaveLength(9);

    fireEvent.click(closeInstance);

    expect(popup.close).toHaveBeenCalledOnce();
    expect(within(rail).queryByRole('button', { name: /close workspace 1/i })).not.toBeInTheDocument();
    expect(within(rail).getByRole('button', { name: /workspace 1, saved, right/i })).toBeInTheDocument();
  });

  it('arranges workspace instances around the main workspace', () => {
    const popup = { closed: false, close: vi.fn(), focus: vi.fn() } as unknown as Window;
    vi.spyOn(window, 'open').mockReturnValue(popup);

    render(<App />);

    fireEvent.click(screen.getAllByLabelText('Open workspace setup')[0]);
    const rail = screen.getByLabelText('Workspace navigation');
    fireEvent.click(within(rail).getByLabelText('Create workspace instance'));

    const workspaceList = within(rail).getByRole('list', { name: 'Workspace instances' });
    const workspaceItem = within(workspaceList).getByRole('button', { name: /workspace 1, on, right/i }).closest('.shell-instance-item');
    const bottomRightSlot = within(rail).getByRole('button', { name: 'Bottom right workspace slot' });
    const dragTransfer = {
      dropEffect: 'move',
      effectAllowed: 'move',
      getData: vi.fn(() => workspaceItem?.getAttribute('data-workspace-instance-id') ?? ''),
      setData: vi.fn(),
    } as unknown as DataTransfer;

    expect(workspaceItem).toBeInTheDocument();

    fireEvent.dragStart(workspaceItem as HTMLElement, { dataTransfer: dragTransfer });
    fireEvent.dragOver(bottomRightSlot, { dataTransfer: dragTransfer });
    fireEvent.drop(bottomRightSlot, { dataTransfer: dragTransfer });

    expect(within(rail).getByText(/bottom right/i)).toBeInTheDocument();
    expect(within(rail).getByRole('button', { name: /Bottom right workspace slot/i })).toHaveTextContent('W1');

    const mainItem = within(workspaceList).getByRole('button', { name: /main workspace, on/i }).closest('.shell-instance-item');
    const mainDragTransfer = {
      dropEffect: 'move',
      effectAllowed: 'move',
      getData: vi.fn(() => mainItem?.getAttribute('data-workspace-instance-id') ?? ''),
      setData: vi.fn(),
    } as unknown as DataTransfer;

    fireEvent.dragStart(mainItem as HTMLElement, { dataTransfer: mainDragTransfer });
    fireEvent.dragOver(bottomRightSlot, { dataTransfer: mainDragTransfer });
    fireEvent.drop(bottomRightSlot, { dataTransfer: mainDragTransfer });

    expect(within(rail).getByRole('button', { name: /Bottom right workspace slot/i })).toHaveTextContent('Main');
    expect(within(rail).getByRole('button', { name: /Center workspace slot/i })).toHaveTextContent('W1');
  });

  it('keeps workspace instances restorable after their popup closes', () => {
    vi.useFakeTimers();
    const popup = { closed: false, close: vi.fn(), focus: vi.fn() } as unknown as Window & { closed: boolean };
    vi.spyOn(window, 'open').mockReturnValue(popup);

    render(<App />);

    fireEvent.click(screen.getAllByLabelText('Open workspace setup')[0]);
    const rail = screen.getByLabelText('Workspace navigation');

    fireEvent.click(screen.getByLabelText('Create blank workspace'));

    expect(within(rail).getByRole('button', { name: /close workspace 1/i })).toBeInTheDocument();

    popup.closed = true;

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(within(rail).queryByRole('button', { name: /close workspace 1/i })).not.toBeInTheDocument();
    expect(within(rail).getByRole('button', { name: /workspace 1, saved, right/i })).toBeInTheDocument();
  });

  it('does not render the workspace rail inside extension workspaces', () => {
    window.history.replaceState({}, '', '/?role=admin&workspace=extension');

    render(<App />);

    expect(screen.queryByLabelText('Workspace navigation')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/workspace navigation/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /access\s*admin/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Close workspace extension')).toBeInTheDocument();
  });
});
