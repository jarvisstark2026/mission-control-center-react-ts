import type { ShellRole } from '../shell/roles';
import type { CommandRequest } from '../mission-control';

export type AuditEntry = {
  id: string;
  type: string;
  actor: string;
  timestamp: string;
  detail: string;
};

export type GoalStatus =
  | 'draft'
  | 'active'
  | 'waiting-approval'
  | 'blocked'
  | 'running'
  | 'completed'
  | 'failed'
  | 'archived';

export type GoalPriority = 'low' | 'normal' | 'high' | 'critical';

export type Goal = {
  id: string;
  title: string;
  objective: string;
  status: GoalStatus;
  priority: GoalPriority;
  ownerRole: ShellRole;
  assignedAgentIds: string[];
  workflowRunId?: string;
  commandIds: string[];
  evidenceIds: string[];
  auditTrail: AuditEntry[];
  createdAt: string;
  updatedAt: string;
};

export type EvidenceRecord = {
  id: string;
  type: 'url' | 'file' | 'note' | 'pdf' | 'image' | 'spreadsheet' | 'json';
  title: string;
  source: string;
  summary?: string;
  linkedGoalIds: string[];
  linkedCommandIds: string[];
  createdAt: string;
};

export type AppPortalProfile = {
  id: string;
  name: string;
  type: 'web' | 'desktop' | 'protocol' | 'tauri-window';
  launchTarget: string;
  embedMode: 'iframe' | 'external-window' | 'tracked-native' | 'unsupported';
  allowedRoles: ShellRole[];
  lastOpenedAt?: string;
};

export type JsonSurfaceSchemaHint =
  | 'raw'
  | 'table'
  | 'cards'
  | 'timeline'
  | 'metrics'
  | 'checklist'
  | 'command-proposal';

export type JsonSurfaceDocument = {
  id: string;
  title: string;
  source: 'paste' | 'file' | 'bridge' | 'url';
  schemaHint?: JsonSurfaceSchemaHint;
  payload: unknown;
  createdAt: string;
};

export type OperationalOsState = {
  goals: Goal[];
  evidence: EvidenceRecord[];
  appProfiles: AppPortalProfile[];
  jsonDocuments: JsonSurfaceDocument[];
  version: number;
  updatedAt: string;
};

export type CreateGoalInput = {
  title: string;
  objective: string;
  priority: GoalPriority;
  ownerRole: ShellRole;
  assignedAgentIds?: string[];
};

export type CreateEvidenceInput = Pick<EvidenceRecord, 'type' | 'title' | 'source' | 'summary'> & {
  goalId?: string | null;
  commandId?: string | null;
};

export type CreateJsonSurfaceInput = Pick<JsonSurfaceDocument, 'title' | 'source' | 'schemaHint' | 'payload'>;

export type CreateAppPortalProfileInput = Pick<AppPortalProfile, 'name' | 'type' | 'launchTarget' | 'embedMode' | 'allowedRoles'>;

export type OperationalOsRuntime = {
  state: OperationalOsState;
  createGoal: (input: CreateGoalInput) => Goal;
  updateGoalStatus: (goalId: string, status: GoalStatus, detail?: string) => void;
  linkCommandToGoal: (goalId: string, commandId: string) => void;
  addEvidence: (input: CreateEvidenceInput) => EvidenceRecord;
  linkEvidenceToGoal: (goalId: string, evidenceId: string) => void;
  addJsonDocument: (input: CreateJsonSurfaceInput) => JsonSurfaceDocument;
  removeJsonDocument: (documentId: string) => void;
  addAppProfile: (input: CreateAppPortalProfileInput) => AppPortalProfile;
  markAppProfileOpened: (profileId: string) => void;
};

export type CommandGoalLink = Pick<CommandRequest, 'id' | 'title' | 'status' | 'risk' | 'scope'>;
