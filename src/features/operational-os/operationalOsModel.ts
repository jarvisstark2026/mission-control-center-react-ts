import { createId } from '../../lib/createId';
import type { ShellRole } from '../shell/roles';
import type { CommandRequest } from '../mission-control';
import type {
  AppPortalProfile,
  AuditEntry,
  CreateAppPortalProfileInput,
  CreateEvidenceInput,
  CreateGoalInput,
  CreateJsonSurfaceInput,
  EvidenceRecord,
  Goal,
  GoalStatus,
  JsonSurfaceDocument,
  JsonSurfaceSchemaHint,
  OperationalOsState,
} from './operationalOsTypes';

const maxGoals = 36;
const maxEvidence = 80;
const maxJsonDocuments = 30;
const maxAppProfiles = 24;

function nowIso() {
  return new Date().toISOString();
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function createAudit(type: string, actor: string, detail: string, timestamp = nowIso()): AuditEntry {
  return {
    id: createId(`audit-${type}`),
    type,
    actor,
    detail,
    timestamp,
  };
}

export const defaultAppPortalProfiles: AppPortalProfile[] = [
  {
    id: 'codex-desktop',
    name: 'Codex desktop',
    type: 'protocol',
    launchTarget: 'codex://',
    embedMode: 'external-window',
    allowedRoles: ['admin', 'support', 'home'],
  },
  {
    id: 'hermes-bridge',
    name: 'Hermes bridge status',
    type: 'web',
    launchTarget: 'http://127.0.0.1:8787/status',
    embedMode: 'external-window',
    allowedRoles: ['admin', 'support'],
  },
  {
    id: 'local-tools',
    name: 'Local web tool',
    type: 'web',
    launchTarget: 'http://127.0.0.1:5173',
    embedMode: 'iframe',
    allowedRoles: ['admin', 'support', 'home', 'guest'],
  },
];

export function createInitialOperationalOsState(now = nowIso()): OperationalOsState {
  const starterGoal: Goal = {
    id: 'goal-mission-control-operational-loop',
    title: 'Connect Mission Control to an agent loop',
    objective: 'Use goals, workflows, evidence, and Command Inbox as the operating loop for Hermes or OpenClaw.',
    status: 'active',
    priority: 'high',
    ownerRole: 'admin',
    assignedAgentIds: ['jarvis-prime', 'workflow-agent'],
    commandIds: [],
    evidenceIds: ['evidence-agentos-operating-model'],
    auditTrail: [createAudit('created', 'mission-control', 'Starter goal created from the operational OS model.', now)],
    createdAt: now,
    updatedAt: now,
  };

  const starterEvidence: EvidenceRecord = {
    id: 'evidence-agentos-operating-model',
    type: 'url',
    title: 'Agent OS operating model',
    source: 'https://agentos.guide/',
    summary: 'Local-first goal, agent, workflow, and execution patterns that Mission Control should support.',
    linkedGoalIds: [starterGoal.id],
    linkedCommandIds: [],
    createdAt: now,
  };

  const starterJson: JsonSurfaceDocument = {
    id: 'json-agent-bridge-status-template',
    title: 'Agent bridge status template',
    source: 'bridge',
    schemaHint: 'metrics',
    payload: {
      connector: 'local',
      provider: 'hermes',
      status: 'not-configured',
      endpoint: 'http://127.0.0.1:8787/status',
    },
    createdAt: now,
  };

  return {
    goals: [starterGoal],
    evidence: [starterEvidence],
    appProfiles: defaultAppPortalProfiles,
    jsonDocuments: [starterJson],
    version: 0,
    updatedAt: now,
  };
}

export function createGoal(input: CreateGoalInput, now = nowIso()): Goal {
  const title = input.title.trim() || 'Untitled goal';
  return {
    id: createId('goal'),
    title,
    objective: input.objective.trim() || title,
    status: 'active',
    priority: input.priority,
    ownerRole: input.ownerRole,
    assignedAgentIds: input.assignedAgentIds ?? [],
    commandIds: [],
    evidenceIds: [],
    auditTrail: [createAudit('created', input.ownerRole, `Goal "${title}" created.`, now)],
    createdAt: now,
    updatedAt: now,
  };
}

export function createEvidence(input: CreateEvidenceInput, now = nowIso()): EvidenceRecord {
  return {
    id: createId('evidence'),
    type: input.type,
    title: input.title.trim() || 'Untitled evidence',
    source: input.source.trim() || 'local',
    summary: input.summary?.trim() || undefined,
    linkedGoalIds: input.goalId ? [input.goalId] : [],
    linkedCommandIds: input.commandId ? [input.commandId] : [],
    createdAt: now,
  };
}

export function createJsonSurfaceDocument(input: CreateJsonSurfaceInput, now = nowIso()): JsonSurfaceDocument {
  return {
    id: createId('json-surface'),
    title: input.title.trim() || 'JSON document',
    source: input.source,
    schemaHint: input.schemaHint,
    payload: input.payload,
    createdAt: now,
  };
}

export function createAppPortalProfile(input: CreateAppPortalProfileInput): AppPortalProfile {
  return {
    id: createId('app-portal'),
    name: input.name.trim() || 'Untitled app',
    type: input.type,
    launchTarget: input.launchTarget.trim(),
    embedMode: input.embedMode,
    allowedRoles: input.allowedRoles.length ? input.allowedRoles : ['admin'],
  };
}

function getStatusFromCommands(commands: CommandRequest[], currentStatus: GoalStatus): GoalStatus {
  if (!commands.length) return currentStatus;
  if (commands.some((command) => command.status === 'pending')) return 'waiting-approval';
  if (commands.some((command) => command.status === 'queued' || command.status === 'running' || command.status === 'approved' || command.status === 'overridden')) return 'running';
  if (commands.some((command) => command.status === 'failed')) return 'failed';
  if (commands.some((command) => command.status === 'blocked' || command.status === 'rejected')) return 'blocked';
  if (commands.every((command) => command.status === 'succeeded')) return 'completed';
  return currentStatus;
}

export function syncOperationalOsWithCommands(state: OperationalOsState, commands: CommandRequest[]): OperationalOsState {
  let changed = false;
  const commandsByGoal = new Map<string, CommandRequest[]>();

  for (const command of commands) {
    if (!command.goalId) continue;
    const goalCommands = commandsByGoal.get(command.goalId) ?? [];
    goalCommands.push(command);
    commandsByGoal.set(command.goalId, goalCommands);
  }

  const goals = state.goals.map((goal) => {
    const goalCommands = commandsByGoal.get(goal.id) ?? [];
    if (!goalCommands.length) return goal;

    const commandIds = unique([...goal.commandIds, ...goalCommands.map((command) => command.id)]);
    const evidenceIds = unique([...goal.evidenceIds, ...goalCommands.flatMap((command) => command.evidenceIds ?? [])]);
    const status = getStatusFromCommands(goalCommands, goal.status);
    if (
      status === goal.status &&
      commandIds.length === goal.commandIds.length &&
      evidenceIds.length === goal.evidenceIds.length
    ) {
      return goal;
    }

    changed = true;
    return {
      ...goal,
      status,
      commandIds,
      evidenceIds,
      updatedAt: nowIso(),
    };
  });

  if (!changed) return state;
  return {
    ...state,
    goals,
    version: state.version + 1,
    updatedAt: nowIso(),
  };
}

export function reduceOperationalOsState(
  state: OperationalOsState,
  update: (state: OperationalOsState) => OperationalOsState,
): OperationalOsState {
  const next = update(state);
  return next === state ? state : { ...next, version: next.version + 1, updatedAt: nowIso() };
}

export function addGoalToState(state: OperationalOsState, goal: Goal): OperationalOsState {
  return {
    ...state,
    goals: [goal, ...state.goals.filter((item) => item.id !== goal.id)].slice(0, maxGoals),
  };
}

export function updateGoalStatusInState(state: OperationalOsState, goalId: string, status: GoalStatus, detail?: string): OperationalOsState {
  const timestamp = nowIso();
  return {
    ...state,
    goals: state.goals.map((goal) =>
      goal.id === goalId
        ? {
            ...goal,
            status,
            updatedAt: timestamp,
            auditTrail: [...goal.auditTrail, createAudit(status, 'mission-control', detail ?? `Goal moved to ${status}.`, timestamp)].slice(-18),
          }
        : goal,
    ),
  };
}

export function linkCommandToGoalInState(state: OperationalOsState, goalId: string, commandId: string): OperationalOsState {
  return {
    ...state,
    goals: state.goals.map((goal) =>
      goal.id === goalId ? { ...goal, commandIds: unique([...goal.commandIds, commandId]), updatedAt: nowIso() } : goal,
    ),
  };
}

export function addEvidenceToState(state: OperationalOsState, evidence: EvidenceRecord): OperationalOsState {
  const evidenceIdsByGoal = new Map(evidence.linkedGoalIds.map((goalId) => [goalId, evidence.id]));
  return {
    ...state,
    evidence: [evidence, ...state.evidence.filter((item) => item.id !== evidence.id)].slice(0, maxEvidence),
    goals: state.goals.map((goal) =>
      evidenceIdsByGoal.has(goal.id)
        ? { ...goal, evidenceIds: unique([...goal.evidenceIds, evidence.id]), updatedAt: nowIso() }
        : goal,
    ),
  };
}

export function linkEvidenceToGoalInState(state: OperationalOsState, goalId: string, evidenceId: string): OperationalOsState {
  return {
    ...state,
    evidence: state.evidence.map((item) =>
      item.id === evidenceId ? { ...item, linkedGoalIds: unique([...item.linkedGoalIds, goalId]) } : item,
    ),
    goals: state.goals.map((goal) =>
      goal.id === goalId ? { ...goal, evidenceIds: unique([...goal.evidenceIds, evidenceId]), updatedAt: nowIso() } : goal,
    ),
  };
}

export function addJsonDocumentToState(state: OperationalOsState, document: JsonSurfaceDocument): OperationalOsState {
  return {
    ...state,
    jsonDocuments: [document, ...state.jsonDocuments.filter((item) => item.id !== document.id)].slice(0, maxJsonDocuments),
  };
}

export function removeJsonDocumentFromState(state: OperationalOsState, documentId: string): OperationalOsState {
  return {
    ...state,
    jsonDocuments: state.jsonDocuments.filter((document) => document.id !== documentId),
  };
}

export function addAppPortalProfileToState(state: OperationalOsState, profile: AppPortalProfile): OperationalOsState {
  return {
    ...state,
    appProfiles: [profile, ...state.appProfiles.filter((item) => item.id !== profile.id)].slice(0, maxAppProfiles),
  };
}

export function markAppPortalProfileOpenedInState(state: OperationalOsState, profileId: string): OperationalOsState {
  const timestamp = nowIso();
  return {
    ...state,
    appProfiles: state.appProfiles.map((profile) =>
      profile.id === profileId ? { ...profile, lastOpenedAt: timestamp } : profile,
    ),
  };
}

export function canCreateGoal(role: ShellRole) {
  return role !== 'guest';
}

export function canEditEvidence(role: ShellRole) {
  return role !== 'guest';
}

export function canEditJsonSurface(role: ShellRole) {
  return role !== 'guest';
}

export function canUseAppProfile(profile: AppPortalProfile, role: ShellRole) {
  return role === 'admin' || profile.allowedRoles.includes(role);
}

export function detectJsonSurfaceSchema(payload: unknown): JsonSurfaceSchemaHint {
  if (Array.isArray(payload)) {
    if (payload.every((item) => typeof item === 'string' || (typeof item === 'object' && item !== null && ('done' in item || 'checked' in item)))) {
      return 'checklist';
    }
    if (payload.every((item) => typeof item === 'object' && item !== null && ('timestamp' in item || 'time' in item || 'date' in item))) {
      return 'timeline';
    }
    if (payload.every((item) => typeof item === 'object' && item !== null && !Array.isArray(item))) {
      return 'table';
    }
    return 'cards';
  }

  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    if ('command' in record || 'action' in record || 'proposal' in record) return 'command-proposal';
    if (Object.values(record).every((value) => typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null)) {
      return 'metrics';
    }
  }

  return 'raw';
}
