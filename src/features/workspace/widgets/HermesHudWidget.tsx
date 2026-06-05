import { useMemo, useState } from 'react';

import type { ShellRole } from '../../shell/roles';
import { WorkspaceHud, type AgentVoiceState, type WorkspaceHudSettings, type WorkspaceHudSignals } from '../../workspace-hud';
import type { useHermesHudRuntime } from '../../hermes-hud';
import { WorkspaceButton, WorkspaceContentShell, WorkspaceSectionFrame, WorkspaceStatusStrip } from '../workspaceBlocks';

type HermesHudRuntime = ReturnType<typeof useHermesHudRuntime>;

function getHudStatusLabel(runtime: HermesHudRuntime) {
  if (!runtime.bridgeUrl) return 'bridge unavailable';
  if (runtime.status === 'voice-unavailable') return 'voice unavailable';
  if (runtime.listening) return 'listening';
  if (runtime.status === 'thinking') return 'thinking';
  if (runtime.status === 'transcribing') return 'transcribing';
  if (runtime.status === 'error') return 'needs attention';
  return 'ready';
}

function getHudStatusSource(runtime: HermesHudRuntime) {
  return runtime.bridgeUrl ? 'bridge' : 'unavailable';
}

export function HermesHudWidget({
  role,
  runtime,
  hudSettings,
  hudSignals,
  voiceState,
  locale,
}: {
  role: ShellRole;
  runtime: HermesHudRuntime;
  hudSettings: WorkspaceHudSettings;
  hudSignals: WorkspaceHudSignals;
  voiceState: AgentVoiceState;
  locale?: string;
}) {
  const [draft, setDraft] = useState('');
  const isGuest = role === 'guest';
  const visibleMessages = useMemo(() => runtime.messages.slice(-8), [runtime.messages]);
  const canSend = draft.trim().length > 0 && !isGuest;

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    void runtime.sendMessage(text);
  };

  return (
    <WorkspaceContentShell className="mission-control-surface hermes-hud-surface">
      <WorkspaceStatusStrip
        source={getHudStatusSource(runtime)}
        status={`Hermes HUD ${getHudStatusLabel(runtime)}`}
        count={runtime.listening ? 'voice on' : 'voice off'}
        updatedAt={runtime.bridgeUrl ?? 'connect Agent Control'}
        action={{
          label: runtime.listening ? 'Stop listening' : 'Listen',
          disabled: isGuest,
          onClick: runtime.toggleListening,
          title: isGuest ? 'Guest access cannot use Hermes voice' : 'Toggle Hermes listening',
        }}
      />

      <div className="hermes-hud-primary">
        <div className="hermes-hud-mini-stage" aria-label="Hermes HUD visual">
          <WorkspaceHud
            settings={hudSettings}
            signals={hudSignals}
            voiceState={voiceState}
            interacting={false}
            locale={locale}
          />
        </div>

        <div className="hermes-hud-chat" aria-label="Hermes quick chat">
          <div className="hermes-hud-thread" role="log" aria-live="polite" aria-label="Hermes HUD messages">
            {visibleMessages.map((message) => (
              <article className="hermes-hud-message" data-role={message.role} data-status={message.status} key={message.id}>
                <span>{message.role}</span>
                <p>{message.body}</p>
              </article>
            ))}
          </div>

          <div className="hermes-hud-composer">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={isGuest ? 'Guest access cannot chat with Hermes' : 'Ask Hermes to work in the workspace...'}
              aria-label="Hermes HUD message"
              disabled={isGuest}
              rows={2}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                  event.preventDefault();
                  submit();
                }
              }}
            />
            <WorkspaceButton
              variant="primary"
              className="mission-control-action"
              disabled={!canSend}
              onClick={submit}
            >
              Send
            </WorkspaceButton>
          </div>
        </div>
      </div>

      <WorkspaceSectionFrame
        className="mission-control-list-frame hermes-hud-state-frame"
        eyebrow="voice"
        title="shared listening"
        meta={runtime.canUseVoice ? voiceState.source : 'typed chat only'}
      >
        <p className="mission-control-empty">
          This toggle is shared with the top-bar Hermes HUD menu. HUD color and design come from the same controller as the background visual.
        </p>
      </WorkspaceSectionFrame>
    </WorkspaceContentShell>
  );
}
