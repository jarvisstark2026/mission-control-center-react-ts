import { useEffect, useState } from 'react';

import { canEditEvidence, type CreateEvidenceInput, type EvidenceRecord, type Goal, type OperationalOsRuntime } from '../operational-os';
import type { ShellRole } from '../shell/roles';
import { WorkspaceButton, WorkspaceSectionFrame } from './workspaceBlocks';

function getDefaultGoal(goals: Goal[]) {
  return goals.find((goal) => goal.status === 'waiting-approval') ?? goals.find((goal) => goal.status === 'active') ?? goals[0] ?? null;
}

export function WorkspaceEvidenceAttachPanel({
  role,
  operationalOs,
  evidence,
  disabled = false,
  disabledReason,
  onAttached,
}: {
  role: ShellRole;
  operationalOs: OperationalOsRuntime;
  evidence: Pick<CreateEvidenceInput, 'type' | 'title' | 'source' | 'summary'>;
  disabled?: boolean;
  disabledReason?: string;
  onAttached?: (record: EvidenceRecord) => void;
}) {
  const goals = operationalOs.state.goals.filter((goal) => goal.status !== 'archived');
  const defaultGoal = getDefaultGoal(goals);
  const [goalId, setGoalId] = useState(defaultGoal?.id ?? '');
  const canAttach = canEditEvidence(role);
  const selectedGoal = goals.find((goal) => goal.id === goalId) ?? null;

  useEffect(() => {
    if (goalId && goals.some((goal) => goal.id === goalId)) return;
    setGoalId(defaultGoal?.id ?? '');
  }, [defaultGoal?.id, goalId, goals]);

  const attachEvidence = () => {
    if (!canAttach || disabled) return;
    const record = operationalOs.addEvidence({
      ...evidence,
      goalId: selectedGoal?.id ?? null,
    });
    onAttached?.(record);
  };

  return (
    <WorkspaceSectionFrame
      className="workspace-evidence-attach-panel"
      eyebrow="evidence"
      title={selectedGoal ? `Attach to ${selectedGoal.title}` : 'Attach local evidence'}
      meta={evidence.type}
    >
      <div className="workspace-evidence-attach-row">
        <label>
          <span>goal</span>
          <select value={goalId} disabled={!canAttach || disabled || goals.length === 0} onChange={(event) => setGoalId(event.currentTarget.value)}>
            <option value="">Unlinked local evidence</option>
            {goals.map((goal) => (
              <option key={goal.id} value={goal.id}>
                {goal.title}
              </option>
            ))}
          </select>
        </label>
        <WorkspaceButton variant="secondary" disabled={!canAttach || disabled} onClick={attachEvidence}>
          Attach evidence
        </WorkspaceButton>
      </div>
      <small>
        {disabledReason ?? (selectedGoal ? `${selectedGoal.evidenceIds.length} linked records / ${evidence.source}` : `unlinked / ${evidence.source}`)}
      </small>
    </WorkspaceSectionFrame>
  );
}
