import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';

import type { ShellRole } from '../shell/roles';
import type { CommandRisk, MissionControlEvent } from '../mission-control';
import { createAgentTaskGateway, type AgentTaskGateway } from './agentTaskGateway';
import {
  agentTaskingReducer,
  canSubmitAgentTask,
  createInitialAgentTaskingState,
  type AgentTaskingAction,
} from './agentTaskingModel';
import { loadPersistedAgentTaskingState, savePersistedAgentTaskingState } from './agentTaskingStorage';
import type { AgentTaskRequest, AgentTaskScope, AgentTaskingState } from './agentTaskingTypes';

export type AgentTaskingRuntime = {
  role: ShellRole;
  state: AgentTaskingState;
  gatewayMode: AgentTaskGateway['mode'];
  submitTask: (objective: string, scope: AgentTaskScope, risk: CommandRisk, targetAgentId: string) => Promise<void>;
};

type AgentTaskingImportMetaEnv = ImportMetaEnv & {
  readonly VITE_AGENT_TASK_API_URL?: string;
};

function getAgentTaskApiUrl() {
  return (import.meta.env as AgentTaskingImportMetaEnv).VITE_AGENT_TASK_API_URL;
}

function createTaskId() {
  return `agent-task-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useAgentTasking(
  role: ShellRole,
  ingestEvents: (events: MissionControlEvent[]) => void,
  taskGateway?: AgentTaskGateway,
): AgentTaskingRuntime {
  const fallbackGateway = useMemo(() => createAgentTaskGateway(getAgentTaskApiUrl()), []);
  const gateway = taskGateway ?? fallbackGateway;
  const [state, dispatch] = useReducer(agentTaskingReducer, undefined, () =>
    loadPersistedAgentTaskingState(createInitialAgentTaskingState()),
  );
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    savePersistedAgentTaskingState(stateRef.current);
  }, [state.messages, state.proposals]);

  const submitTask = useCallback(
    async (objective: string, scope: AgentTaskScope, risk: CommandRisk, targetAgentId: string) => {
      const trimmedObjective = objective.trim();
      if (!trimmedObjective) return;

      const requestedAt = new Date().toISOString();
      const request: AgentTaskRequest = {
        id: createTaskId(),
        objective: trimmedObjective,
        scope,
        risk,
        role,
        targetAgentId,
        requestedAt,
      };

      if (!canSubmitAgentTask(role, request)) {
        dispatch({
          type: 'request-blocked',
          message: {
            id: `${request.id}-blocked`,
            author: 'system',
            body: 'This access scope cannot submit that kind of agent task. Use Command Inbox for existing proposals or switch role.',
            timestamp: requestedAt,
          },
          timestamp: requestedAt,
        } satisfies AgentTaskingAction);
        return;
      }

      dispatch({ type: 'request-started', request } satisfies AgentTaskingAction);

      try {
        const result = await gateway.submitTask(request);
        ingestEvents(result.missionControlEvents);
        dispatch({
          type: 'request-succeeded',
          message: result.message,
          proposals: result.proposals,
          timestamp: result.message.timestamp,
        } satisfies AgentTaskingAction);
      } catch (error) {
        const timestamp = new Date().toISOString();
        dispatch({
          type: 'request-failed',
          message: {
            id: `${request.id}-failed`,
            author: 'system',
            body: error instanceof Error ? error.message : 'Agent task gateway failed.',
            timestamp,
          },
          error: error instanceof Error ? error.message : 'Agent task gateway failed.',
          timestamp,
        } satisfies AgentTaskingAction);
      }
    },
    [gateway, ingestEvents, role],
  );

  return useMemo(
    () => ({
      role,
      state,
      gatewayMode: gateway.mode,
      submitTask,
    }),
    [gateway.mode, role, state, submitTask],
  );
}
