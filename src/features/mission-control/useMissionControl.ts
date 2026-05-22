import { useCallback, useEffect, useMemo, useReducer } from 'react';

import type { ShellRole } from '../shell/roles';
import {
  createInitialMissionControlState,
  missionControlReducer,
  type MissionControlReducerAction,
} from './missionControlReducer';
import { createMissionControlTransport } from './missionControlTransport';
import type { CommandAction, IntegrationPermission, MissionControlState } from './missionControlTypes';

export type MissionControlRuntime = {
  role: ShellRole;
  state: MissionControlState;
  actOnCommand: (commandId: string, action: CommandAction) => void;
  acknowledgeNotification: (notificationId: string) => void;
  setIntegrationPermission: (integrationId: string, permission: IntegrationPermission) => void;
};

type MissionControlImportMetaEnv = ImportMetaEnv & {
  readonly VITE_MISSION_CONTROL_SSE_URL?: string;
};

function getMissionControlSseUrl() {
  return (import.meta.env as MissionControlImportMetaEnv).VITE_MISSION_CONTROL_SSE_URL;
}

export function useMissionControl(role: ShellRole): MissionControlRuntime {
  const [state, dispatch] = useReducer(missionControlReducer, undefined, createInitialMissionControlState);

  useEffect(() => {
    const transport = createMissionControlTransport(getMissionControlSseUrl());
    const connection = transport.connect(
      (events) => dispatch({ type: 'events', events }),
      (connectionState) => dispatch({ type: 'connection', connection: connectionState }),
    );

    return () => connection.close();
  }, []);

  const dispatchCommandAction = useCallback(
    (commandId: string, action: CommandAction) => {
      dispatch({
        type: 'command-action',
        commandId,
        action,
        role,
      } satisfies MissionControlReducerAction);
    },
    [role],
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
      actOnCommand: dispatchCommandAction,
      acknowledgeNotification,
      setIntegrationPermission,
    }),
    [acknowledgeNotification, dispatchCommandAction, role, setIntegrationPermission, state],
  );
}

