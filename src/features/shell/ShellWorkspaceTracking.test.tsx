import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App from '../../App';

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

    expect(within(rail).getByText('Saved - Right')).toBeInTheDocument();
    expect(within(rail).queryByRole('button', { name: /close workspace 1/i })).not.toBeInTheDocument();
  });
});
