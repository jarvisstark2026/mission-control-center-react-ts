import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Workspace } from './Workspace';
import { closeWorkspaceInstance, registerWorkspaceExtensionInstance } from './workspaceInstances';
import { getWorkspaceWidgetStorageKey, saveStoredWidgetState, workspaceStorageKey } from './workspaceStorage';
import { widgetPresets } from './workspaceWidgetCatalog';

type AudioTestWindow = Window & {
  AudioContext?: typeof AudioContext;
};

describe('Workspace header controls', () => {
  let originalAudioContext: typeof AudioContext | undefined;

  beforeEach(() => {
    originalAudioContext = (window as AudioTestWindow).AudioContext;
    window.localStorage.clear();
    window.history.replaceState({}, '', '/?role=support');
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.useRealTimers();
    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      writable: true,
      value: originalAudioContext,
    });
    window.localStorage.clear();
    window.history.replaceState({}, '', '/?role=support');
  });

  const unpinCommandCore = (widget: HTMLElement) => {
    fireEvent.click(within(widget).getByLabelText('Unpin Command core'));
    expect(widget).not.toHaveClass('is-pinned');
  };

  const expectWidgetPosition = (widget: HTMLElement | null, x: number, y: number) => {
    expect(widget).toHaveStyle({ left: '0px', top: '0px' });
    expect(widget?.style.translate).toBe(`${x}px ${y}px`);
  };

  const readWidgetTranslate = (widget: HTMLElement) => {
    const [x = '0px', y = '0px'] = widget.style.translate.split(' ');
    return {
      x: Number.parseFloat(x),
      y: Number.parseFloat(y),
    };
  };

  const mockBrowserFullscreen = ({ reject = false }: { reject?: boolean } = {}) => {
    let fullscreenElement: Element | null = null;
    const requestFullscreen = vi.fn(async () => {
      if (reject) throw new Error('fullscreen denied');
      fullscreenElement = document.documentElement;
      document.dispatchEvent(new Event('fullscreenchange'));
    });
    const exitFullscreen = vi.fn(async () => {
      fullscreenElement = null;
      document.dispatchEvent(new Event('fullscreenchange'));
    });

    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => fullscreenElement,
    });
    Object.defineProperty(document.documentElement, 'requestFullscreen', {
      configurable: true,
      value: requestFullscreen,
    });
    Object.defineProperty(document, 'exitFullscreen', {
      configurable: true,
      value: exitFullscreen,
    });

    return {
      requestFullscreen,
      exitFullscreen,
    };
  };

  const getWidget = (container: HTMLElement, kind: string) => {
    const widget = container.querySelector<HTMLElement>(`.workspace-widget.kind-${kind}`);
    if (!widget) throw new Error(`${kind} widget was not rendered`);
    return widget;
  };

  const getOpenWidget = (container: HTMLElement, kind: string) => {
    const widget = getWidget(container, kind);
    if (widget.classList.contains('is-closed')) {
      fireEvent.click(within(widget).getByLabelText(/Maximize /i));
    }
    return getWidget(container, kind);
  };

  it('keeps the main top bar focused on workspace controls instead of workspace creation', () => {
    const { container } = render(<Workspace />);
    const currentRender = within(container);

    const initialWidgetCount = container.querySelectorAll('.workspace-widget').length;

    expect(currentRender.queryByLabelText('Create blank workspace')).not.toBeInTheDocument();
    expect(currentRender.getByRole('button', { name: 'Open widget' })).toBeInTheDocument();
    expect(container.querySelectorAll('.workspace-widget')).toHaveLength(initialWidgetCount);
    expect(container.querySelector('.workspace-extension-identity')).not.toBeInTheDocument();
  });

  it('renders the workspace extension route as an empty canvas', () => {
    window.history.replaceState({}, '', '/?role=support&workspace=extension');
    const { container } = render(<Workspace />);
    const currentRender = within(container);

    expect(currentRender.queryByLabelText('Main workspace HUD')).not.toBeInTheDocument();
    expect(container.querySelectorAll('.workspace-widget')).toHaveLength(0);
    expect(currentRender.queryByLabelText('Create blank workspace')).not.toBeInTheDocument();
    expect(currentRender.getByRole('button', { name: 'Fullscreen' })).toBeInTheDocument();
    expect(currentRender.getByRole('button', { name: 'Reset layout' })).toBeInTheDocument();
    expect(currentRender.getByRole('button', { name: 'Save layout' })).toBeInTheDocument();
    expect(currentRender.getByRole('button', { name: 'Mode preset' })).toBeInTheDocument();
    expect(currentRender.getByLabelText('Close workspace extension')).toBeInTheDocument();
  });

  it('renders the main workspace HUD and switches designs from the top bar', () => {
    const { container } = render(<Workspace role="admin" />);
    const currentRender = within(container);

    const hud = currentRender.getByLabelText('Main workspace HUD');
    expect(hud).toHaveClass('design-signal-halo');
    expect(hud.querySelector('canvas.workspace-hud-canvas')).toBeInTheDocument();

    fireEvent.click(currentRender.getByRole('button', { name: 'HUD' }));
    fireEvent.click(currentRender.getByRole('menuitemradio', { name: /Orbital Core/i }));

    expect(currentRender.getByLabelText('Main workspace HUD')).toHaveClass('design-orbital-core');
    expect(window.localStorage.getItem('mission-control.workspace-hud-settings')).toContain('orbital-core');
  });

  it('toggles HUD voice reaction from the agent menu', () => {
    const { container } = render(<Workspace role="admin" />);
    const currentRender = within(container);

    fireEvent.click(currentRender.getByRole('button', { name: 'Agent' }));
    const checkbox = currentRender.getByRole('checkbox', { name: /Voice reaction/i });

    expect(checkbox).toBeChecked();
    fireEvent.click(checkbox);

    expect(checkbox).not.toBeChecked();
    expect(window.localStorage.getItem('mission-control.workspace-hud-settings')).toContain('"voiceReactionEnabled":false');
  });

  it('toggles browser fullscreen from the workspace top bar', async () => {
    const fullscreen = mockBrowserFullscreen();
    const { container } = render(<Workspace role="admin" />);
    const currentRender = within(container);

    fireEvent.click(currentRender.getByRole('button', { name: 'Fullscreen' }));

    expect(fullscreen.requestFullscreen).toHaveBeenCalledOnce();
    expect(await currentRender.findByRole('button', { name: 'Exit fullscreen' })).toBeInTheDocument();
    expect(currentRender.getByText('Main workspace fullscreen')).toBeInTheDocument();

    fireEvent.click(currentRender.getByRole('button', { name: 'Exit fullscreen' }));

    expect(fullscreen.exitFullscreen).toHaveBeenCalledOnce();
    expect(await currentRender.findByRole('button', { name: 'Fullscreen' })).toBeInTheDocument();
    expect(currentRender.getByText('Main workspace windowed')).toBeInTheDocument();
  }, 15000);

  it('uses F11 to toggle fullscreen for the current workspace', async () => {
    const fullscreen = mockBrowserFullscreen();
    const { container } = render(<Workspace role="admin" />);
    const currentRender = within(container);

    fireEvent.keyDown(window, { key: 'F11' });

    expect(fullscreen.requestFullscreen).toHaveBeenCalledOnce();
    expect(await currentRender.findByRole('button', { name: 'Exit fullscreen' })).toBeInTheDocument();
  }, 15000);

  it('shows stable feedback when browser fullscreen is unavailable', async () => {
    mockBrowserFullscreen({ reject: true });
    const { container } = render(<Workspace role="admin" />);
    const currentRender = within(container);

    expect(currentRender.getByRole('button', { name: 'All screens' })).toBeDisabled();

    fireEvent.click(currentRender.getByRole('button', { name: 'Fullscreen' }));

    expect(await currentRender.findByText('Fullscreen unavailable in browser')).toBeInTheDocument();
    expect(currentRender.getByRole('button', { name: 'Fullscreen' })).toBeInTheDocument();
  }, 15000);

  it('saves the current workspace layout explicitly from the top bar', () => {
    const { container } = render(<Workspace role="admin" />);
    const currentRender = within(container);

    expect(window.localStorage.getItem(getWorkspaceWidgetStorageKey('main'))).toBeNull();

    fireEvent.click(currentRender.getByRole('button', { name: 'Save layout' }));

    expect(window.localStorage.getItem(getWorkspaceWidgetStorageKey('main'))).toContain('"kind":"overview"');
    expect(currentRender.getByText('Main workspace Manual layout saved')).toBeInTheDocument();
  });

  it('creates custom presets and applies built-in presets inside workspace extensions', () => {
    const { container, unmount } = render(<Workspace role="admin" />);
    const currentRender = within(container);

    fireEvent.click(currentRender.getByRole('button', { name: 'Mode preset' }));
    fireEvent.change(currentRender.getByLabelText('Preset name'), { target: { value: 'Review wall' } });
    fireEvent.click(currentRender.getByRole('button', { name: 'Create preset' }));

    expect(currentRender.getByRole('menuitem', { name: /^Review wall/i })).toBeInTheDocument();
    expect(currentRender.getByText('Review wall mode created and active')).toBeInTheDocument();
    expect(currentRender.getByRole('menuitem', { name: /Main workspace/i })).toBeInTheDocument();
    const customModeKey = Array.from({ length: window.localStorage.length }, (_, index) => window.localStorage.key(index)).find((key) =>
      key?.startsWith('mission-control-center.workspace.layout.v1.mode.main.custom-'),
    );
    expect(customModeKey).toBeTruthy();

    unmount();
    window.history.replaceState({}, '', '/?role=admin&workspace=extension');
    const extensionWorkspace = render(<Workspace role="admin" />);
    const extensionRender = within(extensionWorkspace.container);

    expect(extensionWorkspace.container.querySelectorAll('.workspace-widget')).toHaveLength(0);

    fireEvent.click(extensionRender.getByRole('button', { name: 'Mode preset' }));
    fireEvent.click(extensionRender.getByRole('menuitem', { name: /Security mode/i }));

    expect(extensionWorkspace.container.querySelector('.workspace-widget.kind-command-inbox')).toHaveClass('is-open', 'is-pinned');
    expect(extensionWorkspace.container.querySelector('.workspace-widget.kind-notifications')).toHaveClass('is-open');
  }, 60000);

  it('renames and deletes custom preset modes without moving the header controls', () => {
    const { container } = render(<Workspace role="admin" />);
    const currentRender = within(container);

    fireEvent.click(currentRender.getByRole('button', { name: 'Mode preset' }));
    fireEvent.change(currentRender.getByLabelText('Preset name'), { target: { value: 'Temporary mode' } });
    fireEvent.click(currentRender.getByRole('button', { name: 'Create preset' }));

    expect(currentRender.getByRole('menuitem', { name: /^Temporary mode/i })).toBeInTheDocument();

    fireEvent.click(currentRender.getByLabelText('Rename Temporary mode'));
    fireEvent.change(currentRender.getByLabelText('Rename Temporary mode'), { target: { value: 'Review mode' } });
    fireEvent.click(currentRender.getByRole('menuitem', { name: 'Save' }));

    expect(currentRender.queryByRole('menuitem', { name: /^Temporary mode/i })).not.toBeInTheDocument();
    expect(currentRender.getByRole('menuitem', { name: /^Review mode/i })).toBeInTheDocument();
    expect(currentRender.getByText('Review mode preset renamed')).toBeInTheDocument();

    fireEvent.click(currentRender.getByLabelText('Delete Review mode'));

    expect(currentRender.queryByRole('menuitem', { name: /^Review mode/i })).not.toBeInTheDocument();
    expect(currentRender.queryByRole('menuitem', { name: /^Temporary mode/i })).not.toBeInTheDocument();
    expect(currentRender.getByText('Review mode preset deleted')).toBeInTheDocument();
    expect(container.querySelectorAll('.workspace-head .workspace-layout-status')).toHaveLength(1);
  }, 20000);

  it('dismisses workspace top menus on outside click and Escape', () => {
    const { container } = render(<Workspace role="admin" />);
    const currentRender = within(container);
    const canvas = container.querySelector('.workspace-canvas') as HTMLElement;

    fireEvent.click(currentRender.getByRole('button', { name: 'Open widget' }));
    expect(currentRender.getByRole('menu', { name: 'Open widget menu' })).toBeInTheDocument();
    fireEvent.pointerDown(canvas);
    expect(currentRender.queryByRole('menu', { name: 'Open widget menu' })).not.toBeInTheDocument();

    fireEvent.click(currentRender.getByRole('button', { name: 'Mode preset' }));
    expect(currentRender.getByRole('menu', { name: 'Workspace mode presets' })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(currentRender.queryByRole('menu', { name: 'Workspace mode presets' })).not.toBeInTheDocument();

    fireEvent.click(currentRender.getByRole('button', { name: 'Permissions' }));
    expect(currentRender.getByRole('menu', { name: 'Widget permissions' })).toBeInTheDocument();
    fireEvent.pointerDown(document.body);
    expect(currentRender.queryByRole('menu', { name: 'Widget permissions' })).not.toBeInTheDocument();
  }, 20000);

  it('resets the current workspace to its active saved mode layout', () => {
    registerWorkspaceExtensionInstance({
      id: 'workspace-right',
      popup: null,
      url: 'http://127.0.0.1:5173/?role=admin&workspace=extension&workspaceId=workspace-right',
    });

    const [firstWidget] = widgetPresets;
    expect(saveStoredWidgetState([{ ...firstWidget, x: 120 }], 'main')).toBe(true);
    expect(saveStoredWidgetState([{ ...firstWidget, x: 220 }], 'main', 'manual')).toBe(true);
    expect(saveStoredWidgetState([{ ...firstWidget, x: 640 }], 'workspace-right')).toBe(true);
    expect(saveStoredWidgetState([{ ...firstWidget, x: 840 }], 'stale-workspace')).toBe(true);

    const { container } = render(<Workspace />);

    fireEvent.click(within(container).getByRole('button', { name: 'Reset layout' }));

    expect(window.localStorage.getItem(getWorkspaceWidgetStorageKey('main'))).not.toBeNull();
    expect(window.localStorage.getItem(getWorkspaceWidgetStorageKey('workspace-right'))).not.toBeNull();
    expect(window.localStorage.getItem(getWorkspaceWidgetStorageKey('stale-workspace'))).not.toBeNull();
    expectWidgetPosition(container.querySelector<HTMLElement>('.workspace-widget.kind-overview'), 220, firstWidget.y);
  }, 15000);

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

    const getManagerCard = () => {
      const launcherCards = Array.from(container.querySelectorAll<HTMLButtonElement>('.launcher-grid .launcher-app'));
      const managerCard = launcherCards.find((button) => button.textContent?.includes('Manager')) ?? null;

      if (!managerCard) {
        throw new Error('Manager launcher card was not rendered');
      }

      return managerCard;
    };

    const closedManagerCard = getManagerCard();
    expect(closedManagerCard).toHaveTextContent(/closed/i);
    expect(closedManagerCard).toHaveTextContent(/double-click to open/i);

    fireEvent.click(closedManagerCard);

    expect(getManagerCard()).toHaveTextContent(/closed/i);

    fireEvent.doubleClick(closedManagerCard);

    expect(getManagerCard()).toHaveTextContent(/open/i);
    expect(getManagerCard()).toHaveTextContent(/double-click to focus/i);

    const managerWidget = container.querySelector<HTMLElement>('.workspace-widget.kind-window-manager');
    expectWidgetPosition(managerWidget, 340, 265);
    expect(managerWidget?.querySelector('.widget-scroll-pane')).toBeInTheDocument();
    expect(managerWidget?.querySelector('.workspace-content-head.window-manager-head')).not.toBeInTheDocument();
  });

  it('opens header menu widgets inside the current workspace', () => {
    const open = vi.spyOn(window, 'open');
    const oscillatorStarts: number[] = [];
    class FakeAudioParam {
      setValueAtTime = vi.fn();
      exponentialRampToValueAtTime = vi.fn();
    }
    class FakeOscillator {
      type: OscillatorType = 'sine';
      frequency = new FakeAudioParam();
      connect = vi.fn();
      start = vi.fn((time: number) => oscillatorStarts.push(time));
      stop = vi.fn();
    }
    class FakeAudioContext {
      currentTime = 1;
      destination = {};
      state: AudioContextState = 'running';
      close = vi.fn(() => Promise.resolve());
      createGain = vi.fn(() => ({
        connect: vi.fn(),
        gain: new FakeAudioParam(),
      }));
      createOscillator = vi.fn(() => new FakeOscillator());
    }
    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      writable: true,
      value: FakeAudioContext,
    });
    const { container } = render(<Workspace />);

    expect(within(container).queryByRole('menu', { name: /open widget menu/i })).not.toBeInTheDocument();

    fireEvent.click(within(container).getByRole('button', { name: 'Open widget' }));
    const menu = within(container).getByRole('menu', { name: /open widget menu/i });
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Audio preview' }));

    expect(open).not.toHaveBeenCalled();
    expect(within(container).queryByRole('menu', { name: /open widget menu/i })).not.toBeInTheDocument();

    const audioWidget = container.querySelector<HTMLElement>('.workspace-widget.kind-audio');
    expect(audioWidget).toHaveClass('is-open');
    expectWidgetPosition(audioWidget, 340, 287);
    expect(oscillatorStarts).toHaveLength(3);
  }, 15000);

  it('opens operational core widgets from the shared widget menu', async () => {
    const { container } = render(<Workspace role="admin" />);
    const currentRender = within(container);

    fireEvent.click(currentRender.getByRole('button', { name: 'Open widget' }));
    fireEvent.click(currentRender.getByRole('menuitem', { name: 'Agent console' }));
    expect(currentRender.getAllByText('tasking / proposals').length).toBeGreaterThan(0);

    await act(async () => {
      fireEvent.click(currentRender.getByRole('button', { name: 'Send to Jarvis' }));
      await new Promise((resolve) => setTimeout(resolve, 340));
    });
    expect(await currentRender.findByText(/prepared a gated command proposal/i)).toBeInTheDocument();
    expect((await currentRender.findAllByText(/Review current mission state and propose/i)).length).toBeGreaterThan(0);

    fireEvent.click(currentRender.getByRole('button', { name: 'Open widget' }));
    fireEvent.click(currentRender.getByRole('menuitem', { name: 'Command inbox' }));
    expect(currentRender.getAllByText('primary approval queue').length).toBeGreaterThan(0);
    expect(currentRender.getAllByText(/Review current mission state and propose/i).length).toBeGreaterThan(0);

    fireEvent.click(currentRender.getByRole('button', { name: 'Open widget' }));
    fireEvent.click(currentRender.getByRole('menuitem', { name: 'Notifications' }));
    expect(currentRender.getByText('live telemetry and alerts')).toBeInTheDocument();

    fireEvent.click(currentRender.getByRole('button', { name: 'Open widget' }));
    fireEvent.click(currentRender.getByRole('menuitem', { name: 'Integration registry' }));
    expect(currentRender.getByText('devices, heartbeats, and permissions')).toBeInTheDocument();

    fireEvent.click(currentRender.getByRole('button', { name: 'Open widget' }));
    fireEvent.click(currentRender.getByRole('menuitem', { name: 'Agent control' }));
    expect(currentRender.getAllByText('identity / jobs / permissions').length).toBeGreaterThan(0);
    expect(currentRender.getAllByText('Jarvis Prime').length).toBeGreaterThan(0);
    expect(currentRender.getAllByText('Jarvis Workflow').length).toBeGreaterThan(0);

    fireEvent.click(currentRender.getByRole('button', { name: 'Open widget' }));
    fireEvent.click(currentRender.getByRole('menuitem', { name: 'Home systems' }));
    expect(currentRender.getAllByText('energy, safety, automation, and rooms').length).toBeGreaterThan(0);
    expect(currentRender.getAllByText('Daily load').length).toBeGreaterThan(0);
    expect(currentRender.getAllByText('Solar PV').length).toBeGreaterThan(0);
    expect(currentRender.getAllByText('CCTV and doorbell').length).toBeGreaterThan(0);
    const poolLayerToggle = currentRender.getAllByRole('button', { name: 'Pool' })[0];
    expect(poolLayerToggle).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(poolLayerToggle);
    expect(poolLayerToggle).toHaveAttribute('aria-pressed', 'true');
    const solarActionCard = currentRender.getByText('Use solar surplus').closest('.operational-attention-card');
    expect(solarActionCard).toBeInTheDocument();
    fireEvent.click(within(solarActionCard as HTMLElement).getByRole('button', { name: 'Stage proposal' }));
    expect(currentRender.getByText('Sent to Command Inbox.')).toBeInTheDocument();

    fireEvent.click(currentRender.getByRole('button', { name: 'Open widget' }));
    fireEvent.click(currentRender.getByRole('menuitem', { name: 'Command inbox' }));
    expect(currentRender.getAllByText('Home Systems / energy').length).toBeGreaterThan(0);
  }, 90000);

  it('starts workflow runbooks and stages approval steps in Command Inbox', () => {
    const { container } = render(<Workspace role="admin" />);
    const currentRender = within(container);

    fireEvent.click(currentRender.getByRole('button', { name: 'Open widget' }));
    fireEvent.click(currentRender.getByRole('menuitem', { name: 'Workflows' }));
    fireEvent.click(currentRender.getByRole('button', { name: 'Start runbook' }));
    fireEvent.click(currentRender.getAllByRole('button', { name: 'Stage approval' })[0]);

    fireEvent.click(currentRender.getByRole('button', { name: 'Open widget' }));
    fireEvent.click(currentRender.getByRole('menuitem', { name: 'Command inbox' }));

    expect(currentRender.getAllByText(/Workflow \//).length).toBeGreaterThan(0);
    expect(currentRender.getAllByText('Jarvis Workflow').length).toBeGreaterThan(0);
  }, 60000);

  it('opens Agent Control from the launcher while guest launch surfaces keep agent tools hidden', () => {
    const adminWorkspace = render(<Workspace role="admin" />);
    const adminRender = within(adminWorkspace.container);
    const launcherWidget = adminWorkspace.container.querySelector<HTMLElement>('.workspace-widget.kind-launcher');

    expect(launcherWidget).toBeInTheDocument();

    const agentLauncherCard = within(launcherWidget as HTMLElement).getByRole('button', { name: /agent control/i });
    fireEvent.doubleClick(agentLauncherCard);

    expect(adminRender.getAllByText('identity / jobs / permissions').length).toBeGreaterThan(0);

    adminWorkspace.unmount();
    window.localStorage.clear();

    const guestWorkspace = render(<Workspace role="guest" />);
    const guestRender = within(guestWorkspace.container);
    fireEvent.click(guestRender.getByRole('button', { name: 'Open widget' }));

    expect(guestRender.queryByRole('menuitem', { name: 'Agent control' })).not.toBeInTheDocument();
    expect(guestRender.queryByRole('menuitem', { name: 'Agent console' })).not.toBeInTheDocument();
    expect(guestRender.getByRole('menuitem', { name: 'Home systems' })).toBeInTheDocument();
    const guestLauncherWidget = guestWorkspace.container.querySelector<HTMLElement>('.workspace-widget.kind-launcher');
    expect(within(guestLauncherWidget as HTMLElement).queryByRole('button', { name: /agent control/i })).not.toBeInTheDocument();
    expect(within(guestLauncherWidget as HTMLElement).queryByRole('button', { name: /agent console/i })).not.toBeInTheDocument();
    expect(within(guestLauncherWidget as HTMLElement).getByRole('button', { name: /home systems/i })).toBeInTheDocument();
  }, 60000);

  it('lets admin hide widgets from another role across header and launcher entry points', () => {
    const adminWorkspace = render(<Workspace role="admin" />);
    const adminRender = within(adminWorkspace.container);

    fireEvent.click(adminRender.getByRole('button', { name: 'Permissions' }));
    const permissionMenu = adminRender.getByRole('menu', { name: 'Widget permissions' });
    fireEvent.click(within(permissionMenu).getByRole('tab', { name: 'Guest' }));
    fireEvent.click(within(permissionMenu).getByLabelText(/Home systems/i));

    adminWorkspace.unmount();

    const guestWorkspace = render(<Workspace role="guest" />);
    const guestRender = within(guestWorkspace.container);

    fireEvent.click(guestRender.getByRole('button', { name: 'Open widget' }));
    expect(guestRender.queryByRole('menuitem', { name: 'Home systems' })).not.toBeInTheDocument();

    const guestLauncherWidget = guestWorkspace.container.querySelector<HTMLElement>('.workspace-widget.kind-launcher');
    expect(within(guestLauncherWidget as HTMLElement).queryByRole('button', { name: /home systems/i })).not.toBeInTheDocument();

    fireEvent.click(guestRender.getByRole('button', { name: 'Mode preset' }));
    fireEvent.click(guestRender.getByRole('menuitem', { name: /Home mode/i }));

    expect(guestWorkspace.container.querySelector('.workspace-widget.kind-home-systems')).not.toBeInTheDocument();
  }, 60000);

  it('lets admin reset widget permissions for a role back to defaults', () => {
    const adminWorkspace = render(<Workspace role="admin" />);
    const adminRender = within(adminWorkspace.container);

    fireEvent.click(adminRender.getByRole('button', { name: 'Permissions' }));
    const permissionMenu = adminRender.getByRole('menu', { name: 'Widget permissions' });
    fireEvent.click(within(permissionMenu).getByRole('tab', { name: 'Guest' }));
    fireEvent.click(within(permissionMenu).getByLabelText(/Home systems/i));

    expect(within(permissionMenu).getByText('hidden Â· custom override')).toBeInTheDocument();

    fireEvent.click(within(permissionMenu).getByRole('button', { name: 'Reset role defaults' }));

    expect(within(permissionMenu).getAllByText('visible Â· default').length).toBeGreaterThan(0);
    expect(adminRender.getByText('Guest widget permissions reset')).toBeInTheDocument();

    adminWorkspace.unmount();

    const guestWorkspace = render(<Workspace role="guest" />);
    const guestRender = within(guestWorkspace.container);
    fireEvent.click(guestRender.getByRole('button', { name: 'Open widget' }));

    expect(guestRender.getByRole('menuitem', { name: 'Home systems' })).toBeInTheDocument();
  }, 60000);

  it('keeps command approvals role gated inside the command inbox', () => {
    const adminWorkspace = render(<Workspace role="admin" />);
    const adminRender = within(adminWorkspace.container);

    fireEvent.click(adminRender.getByRole('button', { name: 'Open widget' }));
    fireEvent.click(adminRender.getByRole('menuitem', { name: 'Command inbox' }));
    fireEvent.click(adminRender.getAllByRole('button', { name: 'Approve' })[0]);

    expect(adminRender.getAllByText(/queued/).length).toBeGreaterThan(0);

    adminWorkspace.unmount();
    window.localStorage.clear();

    const guestWorkspace = render(<Workspace role="guest" />);
    const guestRender = within(guestWorkspace.container);
    fireEvent.click(guestRender.getByRole('button', { name: 'Open widget' }));
    fireEvent.click(guestRender.getByRole('menuitem', { name: 'Command inbox' }));

    expect(guestRender.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
    expect(guestRender.getAllByText('Read-only for this access scope.').length).toBeGreaterThan(0);
  }, 60000);

  it('applies role-oriented mode presets to reduce workspace setup friction', () => {
    const { container } = render(<Workspace role="admin" />);
    const currentRender = within(container);

    fireEvent.click(currentRender.getByRole('button', { name: 'Mode preset' }));
    fireEvent.click(currentRender.getByRole('menuitem', { name: /Security mode/i }));

    expect(container.querySelector('.workspace-widget.kind-command-inbox')).toHaveClass('is-open', 'is-pinned');
    expect(container.querySelector('.workspace-widget.kind-notifications')).toHaveClass('is-open');
    expect(container.querySelector('.workspace-widget.kind-map')).toHaveClass('is-open');
    expect(container.querySelector('.workspace-widget.kind-integration-registry')).toHaveClass('is-open');
    expect(container.querySelector('.workspace-widget.kind-agent-control')).not.toBeInTheDocument();
  }, 30000);

  it('keeps minimized visible widgets tracked in Manager', () => {
    const { container } = render(<Workspace />);
    const currentRender = within(container);

    fireEvent.click(currentRender.getByRole('button', { name: 'Open widget' }));
    fireEvent.click(currentRender.getByRole('menuitem', { name: 'Manager' }));
    fireEvent.click(currentRender.getByRole('button', { name: 'Minimize Command core' }));

    const managerWidget = container.querySelector<HTMLElement>('.workspace-widget.kind-window-manager');
    expect(managerWidget).toBeInTheDocument();
    expect(managerWidget?.querySelector('.widget-labels .widget-kind-icon')).toBeInTheDocument();
    expect(within(managerWidget as HTMLElement).getAllByText('Manager').length).toBeGreaterThan(0);
    expect(within(managerWidget as HTMLElement).getByText('Main workspace')).toBeInTheDocument();

    const commandCoreRow = within(managerWidget as HTMLElement).getByText('Command core').closest('.workspace-action-row');
    expect(commandCoreRow).toBeInTheDocument();
    expect(commandCoreRow).toHaveTextContent('minimized');
  }, 30000);

  it('categorizes Manager rows by workspace and controls extension widgets', () => {
    registerWorkspaceExtensionInstance({
      id: 'workspace-right',
      popup: null,
      url: 'http://127.0.0.1:5173/?role=admin&workspace=extension&workspaceId=workspace-right',
    });

    const extensionWidgets = widgetPresets.map((widget) => ({
      ...widget,
      open: widget.id === 'telemetry',
      hidden: widget.id !== 'telemetry',
      pinned: false,
      zIndex: widget.id === 'telemetry' ? 20 : widget.zIndex,
    }));
    expect(saveStoredWidgetState(extensionWidgets, 'workspace-right')).toBe(true);

    const { container } = render(<Workspace />);
    const currentRender = within(container);

    fireEvent.click(currentRender.getByRole('button', { name: 'Open widget' }));
    fireEvent.click(currentRender.getByRole('menuitem', { name: 'Manager' }));

    const managerWidget = container.querySelector<HTMLElement>('.workspace-widget.kind-window-manager');
    expect(managerWidget).toBeInTheDocument();

    expect(within(managerWidget as HTMLElement).getByText('Main workspace')).toBeInTheDocument();
    expect(within(managerWidget as HTMLElement).getByText('Workspace 1')).toBeInTheDocument();

    const extensionList = within(managerWidget as HTMLElement).getByRole('list', { name: 'Visible widgets in Workspace 1' });
    const telemetryRow = within(extensionList).getByText('Telemetry').closest('.workspace-action-row');
    expect(telemetryRow).toBeInTheDocument();

    fireEvent.click(within(telemetryRow as HTMLElement).getByLabelText('Pin Telemetry'));

    const storedExtensionWidgets = JSON.parse(window.localStorage.getItem(getWorkspaceWidgetStorageKey('workspace-right')) ?? '[]') as Array<{
      id: string;
      pinned?: boolean;
    }>;
    expect(storedExtensionWidgets.find((widget) => widget.id === 'telemetry')?.pinned).toBe(true);
  }, 10000);

  it('pins and unpins widgets from the shared widget toolbar', () => {
    const { container } = render(<Workspace />);
    const commandCoreWidget = container.querySelector<HTMLElement>('.workspace-widget.kind-overview');

    expect(commandCoreWidget).toBeInTheDocument();
    expect(commandCoreWidget).toHaveClass('is-pinned');

    const closeCommandCore = within(commandCoreWidget as HTMLElement).getByLabelText('Command core is pinned');
    expect(closeCommandCore).toBeDisabled();

    fireEvent.click(within(commandCoreWidget as HTMLElement).getByLabelText('Unpin Command core'));

    expect(commandCoreWidget).not.toHaveClass('is-pinned');
    expect(within(commandCoreWidget as HTMLElement).getByLabelText('Close Command core')).toBeEnabled();

    fireEvent.click(within(commandCoreWidget as HTMLElement).getByLabelText('Pin Command core'));

    expect(commandCoreWidget).toHaveClass('is-pinned');
    expect(within(commandCoreWidget as HTMLElement).getByLabelText('Command core is pinned')).toBeDisabled();
  }, 10000);

  it('prevents pinned widgets from being dragged', () => {
    const { container } = render(<Workspace />);
    const canvas = container.querySelector<HTMLElement>('.workspace-canvas');
    const plane = container.querySelector<HTMLElement>('.workspace-canvas-plane');
    const commandCoreWidget = container.querySelector<HTMLElement>('.workspace-widget.kind-overview');

    expect(canvas).toBeInTheDocument();
    expect(plane).toBeInTheDocument();
    expect(commandCoreWidget).toBeInTheDocument();
    expect(commandCoreWidget).toHaveClass('is-pinned');

    Object.defineProperty(canvas, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        bottom: 800,
        height: 800,
        left: 0,
        right: 1200,
        top: 0,
        width: 1200,
        x: 0,
        y: 0,
        toJSON: () => undefined,
      }),
    });
    Object.defineProperty(plane, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        bottom: 800,
        height: 800,
        left: 0,
        right: 1200,
        top: 0,
        width: 1200,
        x: 0,
        y: 0,
        toJSON: () => undefined,
      }),
    });

    fireEvent.pointerDown(commandCoreWidget as HTMLElement, { button: 0, clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(canvas as HTMLElement, { clientX: 400, clientY: 320, pointerId: 1 });

    expectWidgetPosition(commandCoreWidget, 44, 74);
  }, 10000);

  it('resizes open widgets from the top edge without a visible grip', () => {
    const { container } = render(<Workspace />);
    const canvas = container.querySelector<HTMLElement>('.workspace-canvas');
    const overviewWidget = container.querySelector<HTMLElement>('.workspace-widget.kind-overview');

    expect(canvas).toBeInTheDocument();
    expect(overviewWidget).toBeInTheDocument();

    Object.defineProperty(canvas, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        bottom: 800,
        height: 800,
        left: 0,
        right: 1200,
        top: 0,
        width: 1200,
        x: 0,
        y: 0,
        toJSON: () => undefined,
      }),
    });

    const topHandle = within(overviewWidget as HTMLElement).getByLabelText('Resize Command core from the top edge');
    expect(topHandle.querySelector('.widget-resize-grip')).not.toBeInTheDocument();

    const startPosition = readWidgetTranslate(overviewWidget as HTMLElement);
    const startHeight = Number.parseFloat((overviewWidget as HTMLElement).style.height);

    fireEvent.pointerDown(topHandle, { button: 0, clientX: 220, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(canvas as HTMLElement, { clientX: 220, clientY: 80, pointerId: 1 });

    expectWidgetPosition(overviewWidget, startPosition.x, startPosition.y - 20);
    expect(overviewWidget).toHaveStyle({ height: `${startHeight + 20}px` });
  }, 10000);

  it('fills the current workspace from the shared widget toolbar and restores the previous size', () => {
    const { container } = render(<Workspace />);
    const canvas = container.querySelector<HTMLElement>('.workspace-canvas');
    const overviewWidget = container.querySelector<HTMLElement>('.workspace-widget.kind-overview');

    expect(canvas).toBeInTheDocument();
    expect(overviewWidget).toBeInTheDocument();

    Object.defineProperty(canvas, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        bottom: 620,
        height: 620,
        left: 0,
        right: 900,
        top: 0,
        width: 900,
        x: 0,
        y: 0,
        toJSON: () => undefined,
      }),
    });

    const startPosition = readWidgetTranslate(overviewWidget as HTMLElement);
    const startWidth = (overviewWidget as HTMLElement).style.width;
    const startHeight = (overviewWidget as HTMLElement).style.height;

    fireEvent.click(within(overviewWidget as HTMLElement).getByLabelText('Fill workspace with Command core'));

    expectWidgetPosition(overviewWidget, 0, 0);
    expect(overviewWidget).toHaveStyle({ width: '900px', height: '620px' });

    fireEvent.click(within(overviewWidget as HTMLElement).getByLabelText('Fill workspace with Command core'));

    expectWidgetPosition(overviewWidget, startPosition.x, startPosition.y);
    expect(overviewWidget).toHaveStyle({ width: startWidth, height: startHeight });
  }, 10000);

  it('pins visible widgets from Manager rows', () => {
    const { container } = render(<Workspace />);
    const currentRender = within(container);

    fireEvent.click(currentRender.getByRole('button', { name: 'Open widget' }));
    fireEvent.click(currentRender.getByRole('menuitem', { name: 'Manager' }));

    const managerWidget = container.querySelector<HTMLElement>('.workspace-widget.kind-window-manager');
    expect(managerWidget).toBeInTheDocument();

    const telemetryRow = within(managerWidget as HTMLElement).getByText('Telemetry').closest('.workspace-action-row');
    expect(telemetryRow).toBeInTheDocument();

    fireEvent.click(within(telemetryRow as HTMLElement).getByLabelText('Pin Telemetry'));

    expect(within(telemetryRow as HTMLElement).getByLabelText('Unpin Telemetry')).toHaveAttribute('aria-pressed', 'true');
    expect(within(telemetryRow as HTMLElement).getByLabelText('Telemetry is pinned')).toBeDisabled();
  }, 10000);

  it('keeps Manager out of its own rows and preserves row order on focus', () => {
    const { container } = render(<Workspace />);
    const currentRender = within(container);

    fireEvent.click(currentRender.getByRole('button', { name: 'Open widget' }));
    fireEvent.click(currentRender.getByRole('menuitem', { name: 'Manager' }));

    const managerWidget = container.querySelector<HTMLElement>('.workspace-widget.kind-window-manager');
    expect(managerWidget).toBeInTheDocument();

    const managerList = within(managerWidget as HTMLElement).getByRole('list', { name: 'Visible widgets in Main workspace' });
    const readRowTitles = () =>
      Array.from(managerList.querySelectorAll<HTMLElement>('.workspace-action-row-button > span')).map((rowTitle) => rowTitle.textContent);
    const rowTitlesBeforeFocus = readRowTitles();

    expect(within(managerList).queryByText('Manager')).not.toBeInTheDocument();
    expect(rowTitlesBeforeFocus).toContain('Telemetry');

    const telemetryRow = within(managerList).getByText('Telemetry').closest('.workspace-action-row');
    expect(telemetryRow).toBeInTheDocument();

    const telemetryFocusButton = (telemetryRow as HTMLElement).querySelector<HTMLButtonElement>('.workspace-action-row-button');
    expect(telemetryFocusButton).toBeInTheDocument();

    fireEvent.click(telemetryFocusButton as HTMLButtonElement);

    expect(readRowTitles()).toEqual(rowTitlesBeforeFocus);
  }, 10000);

  it('keeps top bar controls outside the widget canvas', () => {
    const { container } = render(<Workspace />);
    const workspaceShell = container.querySelector('.workspace-shell');
    const topBar = container.querySelector('.workspace-head');
    const canvas = container.querySelector('.workspace-canvas');
    const footerTab = container.querySelector('.workspace-footer-tab');

    expect(workspaceShell).toBeInTheDocument();
    expect(topBar?.parentElement).toBe(workspaceShell);
    expect(canvas?.parentElement).toBe(workspaceShell);
    expect(footerTab?.parentElement).toBe(workspaceShell);
    expect(topBar?.compareDocumentPosition(canvas as Node) ?? 0).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(topBar?.querySelector('.workspace-launcher')).toBeInTheDocument();
    expect(topBar?.querySelector('.workspace-widget')).not.toBeInTheDocument();
    expect(footerTab).toHaveAccessibleName('Workspace footer controls');
    expect(footerTab?.querySelector('.workspace-footer-button')).toHaveTextContent('Menu');
    expect(within(footerTab as HTMLElement).getByLabelText('Workspace window tracker')).toBeInTheDocument();
    expect(within(footerTab as HTMLElement).getByRole('list', { name: 'Tracked workspace windows' })).toBeInTheDocument();
    expect(footerTab?.querySelector('.workspace-widget')).not.toBeInTheDocument();
    expect(canvas?.querySelector('.workspace-widget')).toBeInTheDocument();
  });

  it('uses Manager-derived footer tracker rows with right-click actions', () => {
    const { container } = render(<Workspace />);
    const footerTab = container.querySelector<HTMLElement>('.workspace-footer-tab');
    const tracker = within(footerTab as HTMLElement).getByLabelText('Workspace window tracker');
    const trackerList = within(tracker).getByRole('list', { name: 'Tracked workspace windows' });
    const telemetryWidget = container.querySelector<HTMLElement>('.workspace-widget.kind-graph');

    expect(tracker.querySelector('.workspace-tracker-group-label')).toHaveTextContent('M');
    expect(within(trackerList).queryByText('Manager')).not.toBeInTheDocument();
    expect(telemetryWidget).toBeInTheDocument();

    const openTelemetryMenu = () => {
      const telemetryButton = within(trackerList).getByRole('button', { name: 'Focus Telemetry' });
      fireEvent.contextMenu(telemetryButton, { clientX: 600, clientY: 850 });
      return screen.getByRole('menu', { name: 'Telemetry actions' });
    };

    expect(screen.queryByRole('menuitem', { name: 'Pin' })).not.toBeInTheDocument();

    fireEvent.click(within(openTelemetryMenu()).getByRole('menuitem', { name: 'Pin' }));

    expect(telemetryWidget).toHaveClass('is-pinned');

    fireEvent.click(within(openTelemetryMenu()).getByRole('menuitem', { name: 'Unpin' }));
    fireEvent.click(within(openTelemetryMenu()).getByRole('menuitem', { name: 'Close' }));

    expect(container.querySelector('.workspace-widget.kind-graph')).not.toBeInTheDocument();
  }, 10000);

  it('keeps the main workspace footer out of extension instances', () => {
    window.history.replaceState({}, '', '/?role=admin&workspace=extension');
    const { container } = render(<Workspace />);

    expect(container.querySelector('.workspace-footer-tab')).not.toBeInTheDocument();
  });

  it('keeps the top-bar brand and status only on the main workspace', () => {
    const mainWorkspace = render(<Workspace />);

    expect(mainWorkspace.container.querySelector('.workspace-brand')).toHaveTextContent('Mission Control');
    expect(mainWorkspace.container.querySelector('.workspace-head .status-chip--cool')).toHaveTextContent('tailnet live');

    mainWorkspace.unmount();
    window.history.replaceState({}, '', '/?role=admin&workspace=extension');

    const extensionWorkspace = render(<Workspace />);

    expect(extensionWorkspace.container.querySelector('.workspace-brand')).not.toBeInTheDocument();
    expect(extensionWorkspace.container.querySelector('.workspace-head .status-chip--cool')).not.toBeInTheDocument();
    expect(within(extensionWorkspace.container).getByLabelText('Close workspace extension')).toBeInTheDocument();
  });

  it('shows the corresponding workspace number in extension top bars', () => {
    registerWorkspaceExtensionInstance({
      id: 'workspace-one',
      popup: null,
      url: 'http://127.0.0.1:5173/?role=admin&workspace=extension&workspaceId=workspace-one',
    });
    registerWorkspaceExtensionInstance({
      id: 'workspace-two',
      popup: null,
      url: 'http://127.0.0.1:5173/?role=admin&workspace=extension&workspaceId=workspace-two',
    });
    window.history.replaceState({}, '', '/?role=admin&workspace=extension&workspaceId=workspace-two');

    const { container } = render(<Workspace />);
    const extensionMarker = container.querySelector<HTMLElement>('.workspace-extension-identity');

    expect(extensionMarker).toBeInTheDocument();
    expect(extensionMarker).toHaveTextContent('Workspace 2');
    expect(extensionMarker?.querySelector('.workspace-extension-number')).toHaveTextContent('2');
  });

  it('keeps the central HUD only on the main workspace', () => {
    const mainWorkspace = render(<Workspace />);

    expect(within(mainWorkspace.container).getByLabelText('Main workspace HUD')).toBeInTheDocument();

    mainWorkspace.unmount();
    window.history.replaceState({}, '', '/?role=admin&workspace=extension');

    const extensionWorkspace = render(<Workspace />);

    expect(within(extensionWorkspace.container).queryByLabelText('Main workspace HUD')).not.toBeInTheDocument();
  });

  it('prevents open widgets from being dragged above the canvas top edge', () => {
    const { container } = render(<Workspace />);
    const canvas = container.querySelector<HTMLElement>('.workspace-canvas');
    const plane = container.querySelector<HTMLElement>('.workspace-canvas-plane');
    const overviewWidget = container.querySelector<HTMLElement>('.workspace-widget.kind-overview');

    expect(canvas).toBeInTheDocument();
    expect(plane).toBeInTheDocument();
    expect(overviewWidget).toBeInTheDocument();
    unpinCommandCore(overviewWidget as HTMLElement);

    Object.defineProperty(canvas, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        bottom: 800,
        height: 800,
        left: 0,
        right: 1200,
        top: 0,
        width: 1200,
        x: 0,
        y: 0,
        toJSON: () => undefined,
      }),
    });
    Object.defineProperty(plane, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        bottom: 800,
        height: 800,
        left: 0,
        right: 1200,
        top: 0,
        width: 1200,
        x: 0,
        y: 0,
        toJSON: () => undefined,
      }),
    });

    fireEvent.pointerDown(overviewWidget as HTMLElement, { button: 0, clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(canvas as HTMLElement, { clientX: 100, clientY: -400, pointerId: 1 });

    expectWidgetPosition(overviewWidget, 44, 0);
  });

  it('keeps widgets inside a screen edge without a neighboring workspace', () => {
    const { container } = render(<Workspace />);
    const canvas = container.querySelector<HTMLElement>('.workspace-canvas');
    const plane = container.querySelector<HTMLElement>('.workspace-canvas-plane');
    const overviewWidget = container.querySelector<HTMLElement>('.workspace-widget.kind-overview');

    expect(canvas).toBeInTheDocument();
    expect(plane).toBeInTheDocument();
    expect(overviewWidget).toBeInTheDocument();
    unpinCommandCore(overviewWidget as HTMLElement);

    const rect = {
      bottom: 800,
      height: 800,
      left: 0,
      right: 1000,
      top: 0,
      width: 1000,
      x: 0,
      y: 0,
      toJSON: () => undefined,
    };
    Object.defineProperty(canvas, 'getBoundingClientRect', {
      configurable: true,
      value: () => rect,
    });
    Object.defineProperty(plane, 'getBoundingClientRect', {
      configurable: true,
      value: () => rect,
    });

    fireEvent.pointerDown(overviewWidget as HTMLElement, { button: 0, clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(canvas as HTMLElement, { clientX: 1400, clientY: 120, pointerId: 1 });

    expectWidgetPosition(overviewWidget, 610, 94);
    expect(container.querySelector('.workspace-widget.kind-overview')).toBeInTheDocument();
  });

  it('keeps widgets inside a screen edge when the adjacent workspace is saved', () => {
    registerWorkspaceExtensionInstance({
      id: 'workspace-right',
      popup: null,
      url: 'http://127.0.0.1:5173/?role=admin&workspace=extension&workspaceId=workspace-right',
    });
    closeWorkspaceInstance('workspace-right');

    const { container } = render(<Workspace />);
    const canvas = container.querySelector<HTMLElement>('.workspace-canvas');
    const plane = container.querySelector<HTMLElement>('.workspace-canvas-plane');
    const overviewWidget = container.querySelector<HTMLElement>('.workspace-widget.kind-overview');

    expect(canvas).toBeInTheDocument();
    expect(plane).toBeInTheDocument();
    expect(overviewWidget).toBeInTheDocument();
    unpinCommandCore(overviewWidget as HTMLElement);

    const rect = {
      bottom: 800,
      height: 800,
      left: 0,
      right: 1000,
      top: 0,
      width: 1000,
      x: 0,
      y: 0,
      toJSON: () => undefined,
    };
    Object.defineProperty(canvas, 'getBoundingClientRect', {
      configurable: true,
      value: () => rect,
    });
    Object.defineProperty(plane, 'getBoundingClientRect', {
      configurable: true,
      value: () => rect,
    });

    fireEvent.pointerDown(overviewWidget as HTMLElement, { button: 0, clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(canvas as HTMLElement, { clientX: 1000, clientY: 120, pointerId: 1 });

    expectWidgetPosition(overviewWidget, 610, 94);
    expect(overviewWidget).not.toHaveClass('is-transfer-outgoing');
    expect(window.localStorage.getItem(getWorkspaceWidgetStorageKey('workspace-right'))).toBeNull();
  });

  it('moves a dragged widget to the adjacent workspace edge target', () => {
    vi.useFakeTimers();

    registerWorkspaceExtensionInstance({
      id: 'workspace-right',
      popup: null,
      url: 'http://127.0.0.1:5173/?role=admin&workspace=extension&workspaceId=workspace-right',
    });

    const { container } = render(<Workspace />);
    const canvas = container.querySelector<HTMLElement>('.workspace-canvas');
    const plane = container.querySelector<HTMLElement>('.workspace-canvas-plane');
    const overviewWidget = container.querySelector<HTMLElement>('.workspace-widget.kind-overview');

    expect(canvas).toBeInTheDocument();
    expect(plane).toBeInTheDocument();
    expect(overviewWidget).toBeInTheDocument();
    unpinCommandCore(overviewWidget as HTMLElement);

    const rect = {
      bottom: 800,
      height: 800,
      left: 0,
      right: 1000,
      top: 0,
      width: 1000,
      x: 0,
      y: 0,
      toJSON: () => undefined,
    };
    Object.defineProperty(canvas, 'getBoundingClientRect', {
      configurable: true,
      value: () => rect,
    });
    Object.defineProperty(plane, 'getBoundingClientRect', {
      configurable: true,
      value: () => rect,
    });

    const setItem = vi.spyOn(Storage.prototype, 'setItem');

    fireEvent.pointerDown(overviewWidget as HTMLElement, { button: 0, clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(canvas as HTMLElement, { clientX: 1000, clientY: 120, pointerId: 1 });

    const outgoingWidget = container.querySelector<HTMLElement>('.workspace-widget.kind-overview');
    expect(outgoingWidget).toBeInTheDocument();
    expect(outgoingWidget).toHaveClass('is-transfer-outgoing', 'transfer-right');

    act(() => {
      vi.advanceTimersByTime(180);
    });

    expect(container.querySelector('.workspace-widget.kind-overview')).not.toBeInTheDocument();

    const targetWidgets = JSON.parse(window.localStorage.getItem(getWorkspaceWidgetStorageKey('workspace-right')) ?? '[]') as Array<{
      hidden?: boolean;
      id: string;
      open?: boolean;
      x?: number;
    }>;
    const transferredWidget = targetWidgets.find((widget) => widget.id === 'overview');

    expect(transferredWidget).toMatchObject({
      hidden: false,
      id: 'overview',
      open: true,
      x: 24,
    });

    const layoutWriteKeys = setItem.mock.calls
      .map(([key]) => String(key))
      .filter((key) => key.startsWith(workspaceStorageKey));
    expect(layoutWriteKeys).toEqual([getWorkspaceWidgetStorageKey('workspace-right'), getWorkspaceWidgetStorageKey('main')]);
  }, 10000);

  it('keeps the same drag active after moving a widget into a neighboring workspace', () => {
    vi.useFakeTimers();

    registerWorkspaceExtensionInstance({
      id: 'workspace-right',
      popup: null,
      url: 'http://127.0.0.1:5173/?role=admin&workspace=extension&workspaceId=workspace-right',
    });

    const { container } = render(<Workspace />);
    const canvas = container.querySelector<HTMLElement>('.workspace-canvas');
    const plane = container.querySelector<HTMLElement>('.workspace-canvas-plane');
    const overviewWidget = container.querySelector<HTMLElement>('.workspace-widget.kind-overview');

    expect(canvas).toBeInTheDocument();
    expect(plane).toBeInTheDocument();
    expect(overviewWidget).toBeInTheDocument();
    unpinCommandCore(overviewWidget as HTMLElement);

    const rect = {
      bottom: 800,
      height: 800,
      left: 0,
      right: 1000,
      top: 0,
      width: 1000,
      x: 0,
      y: 0,
      toJSON: () => undefined,
    };
    Object.defineProperty(canvas, 'getBoundingClientRect', {
      configurable: true,
      value: () => rect,
    });
    Object.defineProperty(plane, 'getBoundingClientRect', {
      configurable: true,
      value: () => rect,
    });

    fireEvent.pointerDown(overviewWidget as HTMLElement, { button: 0, clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(canvas as HTMLElement, { clientX: 1000, clientY: 120, pointerId: 1 });
    fireEvent.pointerMove(canvas as HTMLElement, { clientX: 1100, clientY: 120, pointerId: 1 });

    const targetWidgets = JSON.parse(window.localStorage.getItem(getWorkspaceWidgetStorageKey('workspace-right')) ?? '[]') as Array<{
      id: string;
      x?: number;
    }>;

    expect(targetWidgets.find((widget) => widget.id === 'overview')?.x).toBe(124);

    act(() => {
      vi.advanceTimersByTime(180);
    });

    expect(container.querySelector('.workspace-widget.kind-overview')).not.toBeInTheDocument();
  });

  it('uses the shared widget scroll pane for open workspace widgets only', () => {
    const { container } = render(<Workspace />);
    const widgets = Array.from(container.querySelectorAll<HTMLElement>('.workspace-widget'));

    expect(widgets.length).toBeGreaterThan(0);
    for (const widget of widgets) {
      if (widget.classList.contains('is-open')) {
        expect(widget.querySelector('.widget-scroll-pane')).toBeInTheDocument();
        expect(widget.querySelector('.widget-workflow-cue')).toBeInTheDocument();
      } else {
        expect(widget.querySelector('.widget-scroll-pane')).not.toBeInTheDocument();
      }
    }

    const fileExplorer = getOpenWidget(container, 'file-explorer');
    expect(fileExplorer.querySelector('.widget-scroll-pane')).toBeInTheDocument();
    expect(container.querySelector('.widget-body-file-explorer')).not.toBeInTheDocument();
  });

  it('creates and completes local schedule blocks with browser persistence', () => {
    const { container, unmount } = render(<Workspace />);
    const scheduleWidget = within(getWidget(container, 'schedule'));

    fireEvent.change(scheduleWidget.getByLabelText('Schedule block title'), { target: { value: 'Test schedule block' } });
    fireEvent.change(scheduleWidget.getByLabelText('Schedule block note'), { target: { value: 'local proof' } });
    fireEvent.click(scheduleWidget.getByRole('button', { name: 'Add block' }));
    const createdScheduleCard = scheduleWidget.getByText('Test schedule block').closest('.schedule-block-card') as HTMLElement;
    fireEvent.click(within(createdScheduleCard).getByRole('button', { name: 'Done' }));

    unmount();
    const { container: nextContainer } = render(<Workspace />);
    const persistedSchedule = within(getWidget(nextContainer, 'schedule'));
    fireEvent.click(persistedSchedule.getByRole('tab', { name: 'done' }));

    expect(persistedSchedule.getByText('Test schedule block')).toBeInTheDocument();
  }, 15000);

  it('creates local task cards and moves them between shared lanes', () => {
    const { container } = render(<Workspace />);
    const projectWidget = within(getOpenWidget(container, 'list'));

    fireEvent.change(projectWidget.getByLabelText('Task title'), { target: { value: 'Evidence follow-up' } });
    fireEvent.change(projectWidget.getByLabelText('Task note'), { target: { value: 'needs local file' } });
    fireEvent.click(projectWidget.getByRole('button', { name: 'Add task' }));
    const createdTaskCard = projectWidget.getByText('Evidence follow-up').closest('.task-card') as HTMLElement;
    fireEvent.click(within(createdTaskCard).getByRole('button', { name: 'Block' }));
    fireEvent.click(projectWidget.getByRole('tab', { name: /Blocked/i }));

    expect(projectWidget.getByText('Evidence follow-up')).toBeInTheDocument();
    expect(projectWidget.getByText('needs local file')).toBeInTheDocument();
  });

  it('persists local docs and spreadsheet evidence edits', () => {
    const { container, unmount } = render(<Workspace />);
    const docsWidget = within(getOpenWidget(container, 'docs'));
    const sheetWidget = within(getOpenWidget(container, 'sheet'));

    fireEvent.change(docsWidget.getByLabelText('Document body'), { target: { value: 'Evidence note from local docs.' } });
    fireEvent.change(sheetWidget.getByLabelText('Q1 row 1'), { target: { value: '42.5' } });

    expect(docsWidget.getByDisplayValue('Evidence note from local docs.')).toBeInTheDocument();
    expect(sheetWidget.getByText('115.6')).toBeInTheDocument();

    unmount();
    const { container: nextContainer } = render(<Workspace />);

    expect(within(getOpenWidget(nextContainer, 'docs')).getByDisplayValue('Evidence note from local docs.')).toBeInTheDocument();
    expect(within(getOpenWidget(nextContainer, 'sheet')).getByDisplayValue('42.5')).toBeInTheDocument();
  });

  it('stores browser bookmarks and live TV favorites locally', () => {
    const { container } = render(<Workspace />);
    const browserWidget = within(getOpenWidget(container, 'browser'));
    const liveTvWidget = within(getOpenWidget(container, 'watch-video'));

    fireEvent.change(browserWidget.getByLabelText('Browser URL'), { target: { value: 'openai.com' } });
    fireEvent.click(browserWidget.getByRole('button', { name: 'Go' }));
    fireEvent.click(browserWidget.getByRole('button', { name: 'Save bookmark' }));

    expect(browserWidget.getAllByText('openai.com').length).toBeGreaterThan(0);

    fireEvent.change(liveTvWidget.getByPlaceholderText('Name this source'), { target: { value: 'Local MP4' } });
    fireEvent.change(liveTvWidget.getByPlaceholderText('Paste an official HLS / MP4 source'), {
      target: { value: 'https://example.com/local.mp4' },
    });
    fireEvent.click(liveTvWidget.getByRole('button', { name: 'Save favorite' }));

    expect(liveTvWidget.getAllByText('Local MP4').length).toBeGreaterThan(0);
  });
});
