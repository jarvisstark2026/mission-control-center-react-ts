import { startTransition, useCallback, useEffect, useMemo, useReducer, useRef } from 'react';

import type { ShellRole } from '../shell/roles';
import {
  createInitialMissionControlState,
  getAllowedCommandActions,
  missionControlReducer,
  type MissionControlReducerAction,
} from './missionControlReducer';
import { createMissionCommandGateway, type MissionCommandGatewayMode } from './missionCommandGateway';
import { loadPersistedMissionControlState, savePersistedMissionControlState } from './missionControlStorage';
import { createMissionControlTransport } from './missionControlTransport';
import type { CommandAction, IntegrationPermission, MissionControlEvent, MissionControlState } from './missionControlTypes';

export type MissionControlRuntime = {
  role: ShellRole;
  state: MissionControlState;
  commandGatewayMode: MissionCommandGatewayMode;
  ingestEvents: (events: MissionControlEvent[]) => void;
  actOnCommand: (commandId: string, action: CommandAction) => void;
  acknowledgeNotification: (notificationId: string) => void;
  setIntegrationPermission: (integrationId: string, permission: IntegrationPermission) => void;
};

type MissionControlImportMetaEnv = ImportMetaEnv & {
  readonly VITE_MISSION_CONTROL_SSE_URL?: string;
  readonly VITE_MISSION_COMMAND_API_URL?: string;
  readonly VITE_MISSION_COMMAND_EXECUTOR_MODE?: string;
};

function getMissionControlSseUrl() {
  return (import.meta.env as MissionControlImportMetaEnv).VITE_MISSION_CONTROL_SSE_URL;
}

function getMissionCommandApiUrl() {
  return (import.meta.env as MissionControlImportMetaEnv).VITE_MISSION_COMMAND_API_URL;
}

function getMissionCommandExecutorMode() {
  return (import.meta.env as MissionControlImportMetaEnv).VITE_MISSION_COMMAND_EXECUTOR_MODE;
}

export function useMissionControl(role: ShellRole): MissionControlRuntime {
  const commandGateway = useMemo(() => createMissionCommandGateway(getMissionCommandApiUrl(), getMissionCommandExecutorMode()), []);
  const [state, dispatch] = useReducer(missionControlReducer, undefined, () =>
    loadPersistedMissionControlState(createInitialMissionControlState()),
  );
  const stateRef = useRef(state);

  useEffect(() => {
    const transport = createMissionControlTransport(getMissionControlSseUrl());
    const connection = transport.connect(
      (events) => {
        startTransition(() => dispatch({ type: 'events', events }));
      },
      (connectionState) => {
        startTransition(() => dispatch({ type: 'connection', connection: connectionState }));
      },
    );

    return () => connection.close();
  }, []);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    savePersistedMissionControlState(stateRef.current);
  }, [state.commands, state.notifications]);

  const ingestEvents = useCallback((events: MissionControlEvent[]) => {
    if (!events.length) return;

    startTransition(() => {
      dispatch({
        type: 'events',
        events,
      } satisfies MissionControlReducerAction);
    });
  }, []);

  const dispatchCommandAction = useCallback(
    (commandId: string, action: CommandAction) => {
      const command = state.commands.find((item) => item.id === commandId);
      if (!command || !getAllowedCommandActions(command, role).includes(action)) return;

      startTransition(() => {
        dispatch({
          type: 'command-action',
          commandId,
          action,
          role,
        } satisfies MissionControlReducerAction);
      });

      if (action !== 'approve' && action !== 'override') return;

      const requestedAt = new Date().toISOString();
      window.setTimeout(() => {
        startTransition(() => {
          dispatch({
            type: 'command-execution',
            commandId,
            status: 'running',
            result: `${commandGateway.mode === 'backend' ? 'Backend' : commandGateway.mode === 'allowlist' ? 'Allowlisted' : 'Local dry-run'} gateway is executing the command.`,
            actor: `${commandGateway.mode}-command-gateway`,
            timestamp: new Date().toISOString(),
          } satisfies MissionControlReducerAction);
        });
      }, 90);

      void commandGateway
        .executeCommand({
          command,
          action,
          role,
          requestedAt,
        })
        .then((result) => {
          startTransition(() => {
            dispatch({
              type: 'command-execution',
              commandId,
              status: result.status,
              result: result.result,
              actor: `${result.gatewayMode}-command-gateway`,
              timestamp: result.completedAt,
              rollbackAvailable: result.rollbackAvailable,
            } satisfies MissionControlReducerAction);
          });
        })
        .catch((error: unknown) => {
          startTransition(() => {
            dispatch({
              type: 'command-execution',
              commandId,
              status: 'failed',
              result: error instanceof Error ? error.message : 'Command gateway failed before returning a result.',
              actor: `${commandGateway.mode}-command-gateway`,
              timestamp: new Date().toISOString(),
              rollbackAvailable: false,
            } satisfies MissionControlReducerAction);
          });
        });
    },
    [commandGateway, role, state.commands],
  );

  const acknowledgeNotification = useCallback(
    (notificationId: string) => {
      startTransition(() => {
        dispatch({
          type: 'acknowledge-notification',
          notificationId,
          role,
        } satisfies MissionControlReducerAction);
      });
    },
    [role],
  );

  const setIntegrationPermission = useCallback(
    (integrationId: string, permission: IntegrationPermission) => {
      startTransition(() => {
        dispatch({
          type: 'set-integration-permission',
          integrationId,
          permission,
          role,
        } satisfies MissionControlReducerAction);
      });
    },
    [role],
  );

  return useMemo(
    () => ({
      role,
      state,
      commandGatewayMode: commandGateway.mode,
      ingestEvents,
      actOnCommand: dispatchCommandAction,
      acknowledgeNotification,
      setIntegrationPermission,
    }),
    [acknowledgeNotification, commandGateway.mode, dispatchCommandAction, ingestEvents, role, setIntegrationPermission, state],
  );
}
