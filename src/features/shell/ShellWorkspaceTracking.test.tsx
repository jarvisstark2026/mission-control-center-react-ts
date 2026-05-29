import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App from '../../App';
import { workspacePersistenceChangeEventName } from '../workspace/workspacePersistence';

describe('Shell workspace tracking', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.replaceState({}, '', '/?role=admin&workspace=extension&workspaceId=workspace-same-window');
    vi.useFakeTimers();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    window.history.replaceState({}, '', '/?role=admin');
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('keeps a same-window extension workspace saved after closing back to the hub', () => {
    vi.spyOn(window, 'close').mockImplementation(() => undefined);

    render(<App />);

    fireEvent.click(screen.getByLabelText('Close workspace extension'));

    expect(window.close).toHaveBeenCalledOnce();
    expect(window.location.search).toBe('?role=admin');

    act(() => {
      vi.advanceTimersByTime(2500);
    });

    fireEvent.click(screen.getAllByLabelText('Open workspace setup')[0]);
    const rail = screen.getByLabelText('Workspace navigation');

    expect(within(rail).getByRole('button', { name: /workspace 1, saved, right/i })).toBeInTheDocument();
    expect(within(rail).queryByRole('button', { name: /close workspace 1/i })).not.toBeInTheDocument();
  });

  it('updates extension workspace theme from cross-window storage changes', () => {
    render(<App />);

    expect(document.documentElement).toHaveAttribute('data-theme', 'jarvis');
    expect(screen.queryByRole('button', { name: /theme/i })).not.toBeInTheDocument();

    act(() => {
      window.localStorage.setItem('mission-control-center-theme', 'ember');
      window.dispatchEvent(new StorageEvent('storage', { key: 'mission-control-center-theme', newValue: 'ember' }));
    });

    expect(document.documentElement).toHaveAttribute('data-theme', 'ember');

    act(() => {
      window.localStorage.setItem('mission-control-center-theme', 'not-a-theme');
      window.dispatchEvent(new StorageEvent('storage', { key: 'mission-control-center-theme', newValue: 'not-a-theme' }));
    });

    expect(document.documentElement).toHaveAttribute('data-theme', 'ember');
  });

  it('updates extension workspace theme from desktop persistence changes without a payload value', () => {
    render(<App />);

    act(() => {
      window.localStorage.setItem('mission-control-center-theme', 'arc');
      window.dispatchEvent(
        new CustomEvent(workspacePersistenceChangeEventName, {
          detail: { key: 'mission-control-center-theme', action: 'write' },
        }),
      );
    });

    expect(document.documentElement).toHaveAttribute('data-theme', 'arc');
  });
});
