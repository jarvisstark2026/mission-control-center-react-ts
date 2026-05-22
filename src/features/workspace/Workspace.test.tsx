import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Workspace } from './Workspace';
import { registerWorkspaceExtensionInstance } from './workspaceInstances';
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
    expect(currentRender.queryByRole('button', { name: 'Reset layout' })).not.toBeInTheDocument();
    expect(currentRender.getByLabelText('Close workspace extension')).toBeInTheDocument();
  });

  it('resets every workspace layout from the main workspace only', () => {
    registerWorkspaceExtensionInstance({
      id: 'workspace-right',
      popup: null,
      url: 'http://127.0.0.1:5173/?role=admin&workspace=extension&workspaceId=workspace-right',
    });

    const [firstWidget] = widgetPresets;
    expect(saveStoredWidgetState([{ ...firstWidget, x: 120 }], 'main')).toBe(true);
    expect(saveStoredWidgetState([{ ...firstWidget, x: 640 }], 'workspace-right')).toBe(true);
    expect(saveStoredWidgetState([{ ...firstWidget, x: 840 }], 'stale-workspace')).toBe(true);

    const { container } = render(<Workspace />);

    fireEvent.click(within(container).getByRole('button', { name: 'Reset layout' }));

    expect(window.localStorage.getItem(getWorkspaceWidgetStorageKey('main'))).toBeNull();
    expect(window.localStorage.getItem(getWorkspaceWidgetStorageKey('workspace-right'))).toBeNull();
    expect(window.localStorage.getItem(getWorkspaceWidgetStorageKey('stale-workspace'))).toBeNull();
    expect(container.querySelector<HTMLElement>('.workspace-widget.kind-overview')).toHaveStyle({ left: '44px', top: '74px' });
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
    expect(managerWidget).toHaveStyle({ left: '340px', top: '265px' });
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
    expect(audioWidget).toHaveStyle({ left: '340px', top: '287px' });
    expect(oscillatorStarts).toHaveLength(3);
  });

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
  });

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
  });

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
  });

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

    expect(commandCoreWidget).toHaveStyle({ left: '44px', top: '74px' });
  });

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
  });

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
  });

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
  });

  it('keeps the main workspace footer out of extension instances', () => {
    window.history.replaceState({}, '', '/?role=admin&workspace=extension');
    const { container } = render(<Workspace />);

    expect(container.querySelector('.workspace-footer-tab')).not.toBeInTheDocument();
  });

  it('keeps the top-bar brand and status only on the main workspace', () => {
    const mainWorkspace = render(<Workspace />);

    expect(mainWorkspace.container.querySelector('.workspace-brand')).toHaveTextContent('Mission Control Center');
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

  it('keeps the central background orb only on the main workspace', () => {
    const mainWorkspace = render(<Workspace />);

    expect(mainWorkspace.container.querySelector('.visual-lab')).toBeInTheDocument();

    mainWorkspace.unmount();
    window.history.replaceState({}, '', '/?role=admin&workspace=extension');

    const extensionWorkspace = render(<Workspace />);

    expect(extensionWorkspace.container.querySelector('.visual-lab')).not.toBeInTheDocument();
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

    expect(overviewWidget).toHaveStyle({ top: '0px' });
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

    expect(overviewWidget).toHaveStyle({ left: '610px' });
    expect(container.querySelector('.workspace-widget.kind-overview')).toBeInTheDocument();
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
  });

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

  it('uses the shared widget scroll pane for every workspace widget', () => {
    const { container } = render(<Workspace />);
    const widgets = Array.from(container.querySelectorAll<HTMLElement>('.workspace-widget'));

    expect(widgets.length).toBeGreaterThan(0);
    for (const widget of widgets) {
      expect(widget.querySelector('.widget-scroll-pane')).toBeInTheDocument();
    }

    expect(container.querySelector('.workspace-widget.kind-file-explorer .widget-scroll-pane')).toBeInTheDocument();
    expect(container.querySelector('.widget-body-file-explorer')).not.toBeInTheDocument();
  });
});
