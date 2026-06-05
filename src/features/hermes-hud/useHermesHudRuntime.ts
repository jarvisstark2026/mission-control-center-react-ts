import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { ShellRole } from '../shell/roles';
import { readLocalStorageJson, writeLocalStorageJson } from '../workspace/browserStorage';
import type {
  HermesHudChatResponse,
  HermesHudDirectAction,
  HermesHudDirectActionResult,
  HermesHudMessage,
  HermesHudStatus,
  HermesHudTranscribeResponse,
} from './hermesHudTypes';

type UseHermesHudRuntimeOptions = {
  bridgeUrl: string | null;
  role: ShellRole;
  onDirectActions: (actions: HermesHudDirectAction[]) => Promise<HermesHudDirectActionResult[]>;
  onVoiceListeningChange?: (listening: boolean) => void;
};

type RuntimeSendOptions = {
  source?: 'typed' | 'voice';
};

type MediaRecorderConstructor = typeof MediaRecorder;

const maxHistoryMessages = 24;
const hermesHudHistoryStorageKey = 'mission-control.hermes-hud.history.v1';

function createRuntimeId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeBridgeUrl(value: string | null) {
  return value?.trim().replace(/\/+$/u, '') || null;
}

function getAssistantBody(payload: HermesHudChatResponse) {
  return payload.message?.body?.trim() || 'Hermes responded without text.';
}

function createReadyMessage(): HermesHudMessage {
  return {
    id: 'hermes-hud-ready',
    role: 'system',
    body: 'Hermes HUD is ready for direct workspace chat when the bridge is connected.',
    timestamp: nowIso(),
    status: 'received',
  };
}

function isHermesHudMessage(value: unknown): value is HermesHudMessage {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    (record.role === 'user' || record.role === 'assistant' || record.role === 'system') &&
    typeof record.body === 'string' &&
    typeof record.timestamp === 'string' &&
    (record.status === 'sent' || record.status === 'received' || record.status === 'failed' || record.status === 'action-result')
  );
}

function readPersistedMessages() {
  const stored = readLocalStorageJson<unknown>(hermesHudHistoryStorageKey);
  if (!Array.isArray(stored)) return [createReadyMessage()];
  const messages = stored.filter(isHermesHudMessage).slice(-maxHistoryMessages);
  return messages.length ? messages : [createReadyMessage()];
}

function writePersistedMessages(messages: HermesHudMessage[]) {
  writeLocalStorageJson(hermesHudHistoryStorageKey, messages.slice(-maxHistoryMessages));
}

async function postJson<T>(url: string, payload: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const rawBody = await response.text();
  let parsed: unknown = {};
  if (rawBody.trim()) {
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      parsed = { error: rawBody.trim() };
    }
  }

  if (!response.ok) {
    const record = parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {};
    const errorMessage = typeof record.error === 'string' ? record.error : `${response.status} ${response.statusText}`.trim();
    const errorCode = typeof record.errorCode === 'string' ? `${record.errorCode}: ` : '';
    const providerStatusCode = typeof record.providerStatusCode === 'number'
      ? ` (${record.providerStatusCode})`
      : typeof record.hermesStatusCode === 'number'
        ? ` (${record.hermesStatusCode})`
        : '';
    const payloadSummary = typeof record.payloadSummary === 'string' ? ` ${record.payloadSummary}` : '';
    throw new Error(`${errorCode}${errorMessage || 'Hermes request failed.'}${providerStatusCode}${payloadSummary}`.trim());
  }

  return parsed as T;
}

function readBlobAsDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('Could not read audio blob.'));
    reader.readAsDataURL(blob);
  });
}

async function blobToBase64(blob: Blob) {
  const dataUrl = await readBlobAsDataUrl(blob);
  return dataUrl.includes(',') ? dataUrl.split(',').pop() ?? '' : dataUrl;
}

function canRecordAudio() {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return false;
  if (typeof window === 'undefined') return false;
  return typeof (window as Window & { MediaRecorder?: MediaRecorderConstructor }).MediaRecorder === 'function';
}

export function useHermesHudRuntime({
  bridgeUrl,
  role,
  onDirectActions,
  onVoiceListeningChange,
}: UseHermesHudRuntimeOptions) {
  const normalizedBridgeUrl = normalizeBridgeUrl(bridgeUrl);
  const [messages, setMessages] = useState<HermesHudMessage[]>(readPersistedMessages);
  const [status, setStatus] = useState<HermesHudStatus>('idle');
  const [listening, setListening] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const bridgeUrlRef = useRef(normalizedBridgeUrl);
  const onDirectActionsRef = useRef(onDirectActions);

  useEffect(() => {
    bridgeUrlRef.current = normalizedBridgeUrl;
  }, [normalizedBridgeUrl]);

  useEffect(() => {
    onDirectActionsRef.current = onDirectActions;
  }, [onDirectActions]);

  const appendMessage = useCallback((message: HermesHudMessage) => {
    setMessages((current) => [...current, message].slice(-maxHistoryMessages));
  }, []);

  useEffect(() => {
    writePersistedMessages(messages);
  }, [messages]);

  const appendSystemMessage = useCallback((body: string, statusValue: HermesHudMessage['status'] = 'received') => {
    appendMessage({
      id: createRuntimeId('hermes-system'),
      role: 'system',
      body,
      timestamp: nowIso(),
      status: statusValue,
    });
  }, [appendMessage]);

  const stopMediaCapture = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
    mediaRecorderRef.current = null;
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
  }, []);

  const sendMessage = useCallback(async (body: string, options: RuntimeSendOptions = {}) => {
    const text = body.trim();
    if (!text) return;
    if (role === 'guest') {
      appendSystemMessage('Guest access cannot use Hermes HUD chat.', 'failed');
      return;
    }

    const userMessage: HermesHudMessage = {
      id: createRuntimeId('hermes-user'),
      role: 'user',
      body: text,
      timestamp: nowIso(),
      status: 'sent',
    };
    appendMessage(userMessage);

    const activeBridgeUrl = bridgeUrlRef.current;
    if (!activeBridgeUrl) {
      setStatus('error');
      appendSystemMessage('Hermes bridge is unavailable. Connect Agent Control before using direct chat.', 'failed');
      return;
    }

    setStatus('thinking');
    try {
      const response = await postJson<HermesHudChatResponse>(`${activeBridgeUrl}/chat`, {
        source: options.source ?? 'typed',
        messages: [...messages, userMessage].slice(-12).map((message) => ({
          role: message.role === 'assistant' ? 'assistant' : 'user',
          content: message.body,
          timestamp: message.timestamp,
        })),
      });
      const assistantMessage: HermesHudMessage = {
        id: response.message?.id || createRuntimeId('hermes-assistant'),
        role: 'assistant',
        body: getAssistantBody(response),
        timestamp: response.message?.timestamp || nowIso(),
        status: 'received',
      };
      appendMessage(assistantMessage);

      const actions = Array.isArray(response.directActions) ? response.directActions : [];
      if (actions.length) {
        const results = await onDirectActionsRef.current(actions);
        appendMessage({
          id: createRuntimeId('hermes-actions'),
          role: 'system',
          body: results.map((result) => `${result.ok ? 'Done' : 'Blocked'}: ${result.message}`).join('\n'),
          timestamp: nowIso(),
          status: 'action-result',
          actionResults: results,
        });
      }
      setStatus('idle');
    } catch (error) {
      setStatus('error');
      appendSystemMessage(error instanceof Error ? error.message : 'Hermes chat request failed.', 'failed');
    }
  }, [appendMessage, appendSystemMessage, messages, role]);

  const transcribeAudio = useCallback(async (blob: Blob) => {
    const activeBridgeUrl = bridgeUrlRef.current;
    if (!activeBridgeUrl) {
      throw new Error('Hermes bridge is unavailable.');
    }
    const audioBase64 = await blobToBase64(blob);
    const payload = await postJson<HermesHudTranscribeResponse>(`${activeBridgeUrl}/voice/transcribe`, {
      audioBase64,
      mimeType: blob.type || 'audio/webm',
      recordedAt: nowIso(),
    });
    return (payload.transcript || payload.text || '').trim();
  }, []);

  const finishListening = useCallback(async () => {
    setListening(false);
    onVoiceListeningChange?.(false);
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      const stopped = new Promise<Blob>((resolve) => {
        recorder.addEventListener('stop', () => {
          resolve(new Blob(recordedChunksRef.current, { type: recorder.mimeType || 'audio/webm' }));
        }, { once: true });
      });
      recorder.stop();
      const audioBlob = await stopped;
      mediaRecorderRef.current = null;
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
      recordedChunksRef.current = [];
      if (!audioBlob.size) {
        setStatus('idle');
        appendSystemMessage('No voice audio was captured.', 'failed');
        return;
      }
      setStatus('transcribing');
      try {
        const transcript = await transcribeAudio(audioBlob);
        if (!transcript) {
          setStatus('voice-unavailable');
          appendSystemMessage('Voice transcription returned no text. Typed chat is still available.', 'failed');
          return;
        }
        await sendMessage(transcript, { source: 'voice' });
      } catch (error) {
        setStatus('voice-unavailable');
        appendSystemMessage(error instanceof Error ? error.message : 'Voice transcription is unavailable.', 'failed');
      }
      return;
    }

    stopMediaCapture();
    setStatus('idle');
  }, [appendSystemMessage, onVoiceListeningChange, sendMessage, stopMediaCapture, transcribeAudio]);

  const startListening = useCallback(async () => {
    if (role === 'guest') {
      appendSystemMessage('Guest access cannot use Hermes voice.', 'failed');
      return;
    }
    if (!canRecordAudio()) {
      setStatus('voice-unavailable');
      appendSystemMessage('Voice unavailable in this runtime. Typed chat remains available.', 'failed');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const Recorder = (window as Window & { MediaRecorder: MediaRecorderConstructor }).MediaRecorder;
      const recorder = new Recorder(stream);
      recordedChunksRef.current = [];
      recorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      });
      recorder.start();
      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      setListening(true);
      onVoiceListeningChange?.(true);
      setStatus('listening');
    } catch {
      setStatus('voice-unavailable');
      appendSystemMessage('Microphone access was not available. Typed chat remains available.', 'failed');
    }
  }, [appendSystemMessage, onVoiceListeningChange, role]);

  const toggleListening = useCallback(() => {
    if (listening) {
      void finishListening();
      return;
    }
    void startListening();
  }, [finishListening, listening, startListening]);

  useEffect(() => () => stopMediaCapture(), [stopMediaCapture]);

  return useMemo(() => ({
    messages,
    status,
    listening,
    bridgeUrl: normalizedBridgeUrl,
    canUseVoice: canRecordAudio(),
    sendMessage,
    toggleListening,
  }), [listening, messages, normalizedBridgeUrl, sendMessage, status, toggleListening]);
}
