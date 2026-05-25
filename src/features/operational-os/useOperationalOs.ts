import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { CommandRequest } from '../mission-control';
import {
  addAppPortalProfileToState,
  addEvidenceToState,
  addGoalToState,
  addJsonDocumentToState,
  createAppPortalProfile,
  createEvidence,
  createGoal,
  createJsonSurfaceDocument,
  linkCommandToGoalInState,
  linkEvidenceToGoalInState,
  markAppPortalProfileOpenedInState,
  reduceOperationalOsState,
  removeJsonDocumentFromState,
  syncOperationalOsWithCommands,
  updateGoalStatusInState,
} from './operationalOsModel';
import { loadPersistedOperationalOsState, savePersistedOperationalOsState } from './operationalOsStorage';
import type {
  CreateAppPortalProfileInput,
  CreateEvidenceInput,
  CreateGoalInput,
  CreateJsonSurfaceInput,
  GoalStatus,
  OperationalOsRuntime,
  OperationalOsState,
} from './operationalOsTypes';

function getCommandSignature(commands: CommandRequest[]) {
  return commands.map((command) => `${command.id}:${command.status}:${command.goalId ?? ''}:${(command.evidenceIds ?? []).join(',')}`).join('|');
}

export function useOperationalOs(commands: CommandRequest[] = []): OperationalOsRuntime {
  const [state, setState] = useState<OperationalOsState>(() => loadPersistedOperationalOsState());
  const stateRef = useRef(state);
  const commandSignature = useMemo(() => getCommandSignature(commands), [commands]);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    savePersistedOperationalOsState(stateRef.current);
  }, [state.version]);

  useEffect(() => {
    setState((current) => syncOperationalOsWithCommands(current, commands));
  }, [commandSignature, commands]);

  const createGoalAction = useCallback((input: CreateGoalInput) => {
    const goal = createGoal(input);
    setState((current) => reduceOperationalOsState(current, (state) => addGoalToState(state, goal)));
    return goal;
  }, []);

  const updateGoalStatus = useCallback((goalId: string, status: GoalStatus, detail?: string) => {
    setState((current) => reduceOperationalOsState(current, (state) => updateGoalStatusInState(state, goalId, status, detail)));
  }, []);

  const linkCommandToGoal = useCallback((goalId: string, commandId: string) => {
    setState((current) => reduceOperationalOsState(current, (state) => linkCommandToGoalInState(state, goalId, commandId)));
  }, []);

  const addEvidence = useCallback((input: CreateEvidenceInput) => {
    const evidence = createEvidence(input);
    setState((current) => reduceOperationalOsState(current, (state) => addEvidenceToState(state, evidence)));
    return evidence;
  }, []);

  const linkEvidenceToGoal = useCallback((goalId: string, evidenceId: string) => {
    setState((current) => reduceOperationalOsState(current, (state) => linkEvidenceToGoalInState(state, goalId, evidenceId)));
  }, []);

  const addJsonDocument = useCallback((input: CreateJsonSurfaceInput) => {
    const document = createJsonSurfaceDocument(input);
    setState((current) => reduceOperationalOsState(current, (state) => addJsonDocumentToState(state, document)));
    return document;
  }, []);

  const removeJsonDocument = useCallback((documentId: string) => {
    setState((current) => reduceOperationalOsState(current, (state) => removeJsonDocumentFromState(state, documentId)));
  }, []);

  const addAppProfile = useCallback((input: CreateAppPortalProfileInput) => {
    const profile = createAppPortalProfile(input);
    setState((current) => reduceOperationalOsState(current, (state) => addAppPortalProfileToState(state, profile)));
    return profile;
  }, []);

  const markAppProfileOpened = useCallback((profileId: string) => {
    setState((current) => reduceOperationalOsState(current, (state) => markAppPortalProfileOpenedInState(state, profileId)));
  }, []);

  return useMemo(
    () => ({
      state,
      createGoal: createGoalAction,
      updateGoalStatus,
      linkCommandToGoal,
      addEvidence,
      linkEvidenceToGoal,
      addJsonDocument,
      removeJsonDocument,
      addAppProfile,
      markAppProfileOpened,
    }),
    [
      addAppProfile,
      addEvidence,
      addJsonDocument,
      createGoalAction,
      linkCommandToGoal,
      linkEvidenceToGoal,
      markAppProfileOpened,
      removeJsonDocument,
      state,
      updateGoalStatus,
    ],
  );
}
