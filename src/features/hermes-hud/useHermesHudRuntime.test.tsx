import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useHermesHudRuntime } from './useHermesHudRuntime';
import type { HermesHudDirectActionResult } from './hermesHudTypes';

describe('useHermesHudRuntime', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('persists Hermes HUD chat and direct action results locally', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({
        message: { role: 'assistant', body: 'Workspace opened.', timestamp: '2026-05-31T10:00:00.000Z' },
        directActions: [{ type: 'widget.close', widgetKind: 'goals' }],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const actionResult: HermesHudDirectActionResult = {
      id: 'action-result-1',
      type: 'widget.close',
      ok: true,
      message: 'Closed Goals.',
      timestamp: '2026-05-31T10:00:01.000Z',
    };
    const onDirectActions = vi.fn().mockResolvedValue([actionResult]);

    const { result, unmount } = renderHook(() =>
      useHermesHudRuntime({
        bridgeUrl: 'http://127.0.0.1:8787',
        role: 'admin',
        onDirectActions,
      }),
    );

    await act(async () => {
      await result.current.sendMessage('close goals');
    });

    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:8787/chat', expect.objectContaining({ method: 'POST' }));
    expect(onDirectActions).toHaveBeenCalledWith([{ type: 'widget.close', widgetKind: 'goals' }]);
    expect(result.current.messages.map((message) => message.body)).toContain('Done: Closed Goals.');

    unmount();

    const replayed = renderHook(() =>
      useHermesHudRuntime({
        bridgeUrl: null,
        role: 'admin',
        onDirectActions: vi.fn(),
      }),
    );

    expect(replayed.result.current.messages.map((message) => message.body)).toContain('Done: Closed Goals.');
  });

  it('feeds successful voice transcription into Hermes chat', async () => {
    class FakeMediaRecorder extends EventTarget {
      state: RecordingState = 'inactive';
      mimeType = 'audio/webm';

      start() {
        this.state = 'recording';
      }

      stop() {
        const dataEvent = new Event('dataavailable') as Event & { data: Blob };
        Object.defineProperty(dataEvent, 'data', { value: new Blob(['voice'], { type: 'audio/webm' }) });
        this.dispatchEvent(dataEvent);
        this.state = 'inactive';
        this.dispatchEvent(new Event('stop'));
      }
    }

    Object.defineProperty(window, 'MediaRecorder', {
      configurable: true,
      writable: true,
      value: FakeMediaRecorder,
    });
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn(async () => ({
          getTracks: () => [{ stop: vi.fn() }],
        })),
      },
    });

    const fetchMock = vi.fn(async (url: string) => ({
      ok: true,
      text: async () => JSON.stringify(
        url.endsWith('/voice/transcribe')
          ? { transcript: 'open goals', confidence: 0.9, language: 'en' }
          : { message: { role: 'assistant', body: 'Opening goals.', timestamp: '2026-05-31T10:00:00.000Z' }, directActions: [] },
      ),
    }));
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() =>
      useHermesHudRuntime({
        bridgeUrl: 'http://127.0.0.1:8787',
        role: 'admin',
        onDirectActions: vi.fn().mockResolvedValue([]),
      }),
    );

    await act(async () => {
      result.current.toggleListening();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(result.current.listening).toBe(true);

    await act(async () => {
      result.current.toggleListening();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:8787/voice/transcribe', expect.any(Object));
      expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:8787/chat', expect.any(Object));
      expect(result.current.messages.some((message) => message.body === 'open goals')).toBe(true);
      expect(result.current.messages.some((message) => message.body === 'Opening goals.')).toBe(true);
    });
  });
});
