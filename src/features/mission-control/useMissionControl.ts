import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';

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
import type { CommandAction, IntegrationPermission, MissionControlState } from './missionControlTypes';

export type MissionControlRuntime = {
  role: ShellRole;
  state: MissionControlState;
  commandGatewayMode: MissionCommandGatewayMode;
  actOnCommand: (commandId: string, action: CommandAction) => void;
  acknowledgeNotification: (notificationId: string) => void;
  setIntegrationPermission: (integrationId: string, permission: IntegrationPermission) => void;
};

type MissionControlImportMetaEnv = ImportMetaEnv & {
  readonly VITE_MISSION_CONTROL_SSE_URL?: string;
  readonly VITE_MISSION_COMMAND_API_URL?: string;
};

function getMissionControlSseUrl() {
  return (import.meta.env as MissionControlImportMetaEnv).VITE_MISSION_CONTROL_SSE_URL;
}

function getMissionCommandApiUrl() {
  return (import.meta.env as MissionControlImportMetaEnv).VITE_MISSION_COMMAND_API_URL;
}

export function useMissionControl(role: ShellRole): MissionControlRuntime {
  const commandGateway = useMemo(() => createMissionCommandGateway(getMissionCommandApiUrl()), []);
  const [state, dispatch] = useReducer(missionControlReducer, undefined, () =>
    loadPersistedMissionControlState(createInitialMissionControlState()),
  );
  const stateRef = useRef(state);

  useEffect(() => {
    const transport = createMissionControlTransport(getMissionControlSseUrl());
    const connection = transport.connect(
      (events) => dispatch({ type: 'events', events }),
      (connectionState) => dispatch({ type: 'connection', connection: connectionState }),
    );

    return () => connection.close();
  }, []);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    savePersistedMissionControlState(stateRef.current);
  }, [state.commands, state.notifications]);

  const dispatchCommandAction = useCallback(
    (commandId: string, action: CommandAction) => {
      const command = state.commands.find((item) => item.id === commandId);
      if (!command || !getAllowedCommandActions(command, role).includes(action)) return;

      dispatch({
        type: 'command-action',
        commandId,
        action,
        role,
      } satisfies MissionControlReducerAction);

      if (action !== 'approve' && action !== 'override') return;

      const requestedAt = new Date().toISOString();
      window.setTimeout(() => {
        dispatch({
          type: 'command-execution',
          commandId,
          status: 'running',
          result: `${commandGateway.mode === 'backend' ? 'Backend' : 'Local mock'} gateway is executing the command.`,
          actor: `${commandGateway.mode}-command-gateway`,
          timestamp: new Date().toISOString(),
        } satisfies MissionControlReducerAction);
      }, 90);

      void commandGateway
        .executeCommand({
          command,
          action,
          role,
          requestedAt,
        })
        .then((result) => {
          dispatch({
            type: 'command-execution',
            commandId,
            status: result.status,
            result: result.result,
            actor: `${result.gatewayMode}-command-gateway`,
            timestamp: result.completedAt,
            rollbackAvailable: result.rollbackAvailable,
          } satisfies MissionControlReducerAction);
        })
        .catch((error: unknown) => {
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
    },
    [commandGateway, role, state.commands],
  );

  const acknowledgeNotification = useCallback(
    (notificationId: string) => {
      dispatch({
        type: 'acknowledge-notification',
        notificationId,
        role,
      } satisfies MissionControlReducerAction);
    },
    [role],
  );

  const setIntegrationPermission = useCallback(
    (integrationId: string, permission: IntegrationPermission) => {
      dispatch({
        type: 'set-integration-permission',
        integrationId,
        permission,
        role,
      } satisfies MissionControlReducerAction);
    },
    [role],
  );

  return useMemo(
    () => ({
      role,
      state,
      commandGatewayMode: commandGateway.mode,
      actOnCommand: dispatchCommandAction,
      acknowledgeNotification,
      setIntegrationPermission,
    }),
    [acknowledgeNotification, commandGateway.mode, dispatchCommandAction, role, setIntegrationPermission, state],
  );
}
