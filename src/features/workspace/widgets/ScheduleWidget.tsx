import { useMemo, useState } from 'react';

import { WorkspaceButton, WorkspaceCompactList, WorkspaceContentShell, WorkspaceSectionFrame, WorkspaceStatusStrip } from '../workspaceBlocks';
import { WorkspaceEvidenceAttachPanel } from '../WorkspaceEvidenceAttachPanel';
import type { OperationalOsRuntime } from '../../operational-os';
import type { ShellRole } from '../../shell/roles';
import { createScheduleEvidenceInput } from '../workspaceEvidenceModel';
import {
  completeScheduleBlock,
  createScheduleBlock,
  filterScheduleBlocks,
  loadLocalSchedule,
  postponeScheduleBlock,
  removeScheduleBlock,
  saveLocalSchedule,
  updateScheduleBlock,
  type LocalScheduleBlock,
  type LocalScheduleStatus,
} from '../workspaceScheduleModel';
import type { WorkspaceWidget } from '../workspaceTypes';
import { usePersistentWorkspaceState } from '../usePersistentWorkspaceState';

const scheduleFilters: LocalScheduleStatus[] = ['today', 'upcoming', 'done'];

function getDraftFromBlock(block: LocalScheduleBlock) {
  return {
    time: block.time,
    date: block.date,
    title: block.title,
    note: block.note,
    linkedWorkflowTemplateId: block.linkedWorkflowTemplateId ?? '',
  };
}

function getEmptyScheduleDraft() {
  return {
    time: '09:00',
    date: new Date().toISOString().slice(0, 10),
    title: '',
    note: '',
    linkedWorkflowTemplateId: '',
  };
}

export function ScheduleWidget({
  onLaunchWorkspaceWidget,
  role,
  operationalOs,
}: {
  onLaunchWorkspaceWidget?: (kind: WorkspaceWidget['kind']) => void;
  role: ShellRole;
  operationalOs: OperationalOsRuntime;
}) {
  const [blocks, setBlocks] = usePersistentWorkspaceState(loadLocalSchedule, saveLocalSchedule);
  const [activeFilter, setActiveFilter] = useState<LocalScheduleStatus>('today');
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [draft, setDraft] = useState(getEmptyScheduleDraft);

  const visibleBlocks = useMemo(() => filterScheduleBlocks(blocks, activeFilter), [activeFilter, blocks]);
  const openBlocks = blocks.filter((block) => block.status !== 'done');
  const nextBlock = filterScheduleBlocks(blocks, 'today')[0] ?? filterScheduleBlocks(blocks, 'upcoming')[0] ?? null;
  const selectedBlock = selectedBlockId ? blocks.find((block) => block.id === selectedBlockId) ?? null : null;
  const evidenceInput = createScheduleEvidenceInput(blocks, selectedBlock?.id ?? null);
  const priorityRows = openBlocks.slice(0, 3).map((block) => ({
    id: block.id,
    meta: block.status,
    title: `${block.time} / ${block.date}`,
    detail: block.note || 'local schedule block',
    state: block.status === 'today' ? 'ready' : 'pending',
    action: {
      label: selectedBlock?.id === block.id ? 'Selected' : 'Select',
      onClick: () => setSelectedBlockId(block.id),
    },
  }));

  const resetDraft = () => {
    setEditingBlockId(null);
    setDraft(getEmptyScheduleDraft());
  };

  const saveDraft = () => {
    if (!draft.title.trim()) return;

    if (editingBlockId) {
      setBlocks((current) =>
        updateScheduleBlock(current, editingBlockId, {
          time: draft.time,
          date: draft.date,
          title: draft.title,
          note: draft.note,
          linkedWorkflowTemplateId: draft.linkedWorkflowTemplateId.trim() || null,
        }),
      );
    } else {
      const nextBlockRecord = createScheduleBlock({
          time: draft.time,
          date: draft.date,
          title: draft.title,
          note: draft.note,
          linkedWorkflowTemplateId: draft.linkedWorkflowTemplateId.trim() || null,
        });
      setBlocks((current) => [...current, nextBlockRecord]);
      setSelectedBlockId(nextBlockRecord.id);
    }

    resetDraft();
  };

  const startEditing = (block: LocalScheduleBlock) => {
    setEditingBlockId(block.id);
    setSelectedBlockId(block.id);
    setDraft(getDraftFromBlock(block));
  };

  return (
    <WorkspaceContentShell className="schedule-surface">
      <WorkspaceStatusStrip
        source="local"
        status={nextBlock ? 'Next block ready' : 'No open blocks'}
        count={`${openBlocks.length} open`}
        updatedAt={nextBlock ? `${nextBlock.time} / ${nextBlock.date}` : 'browser saved'}
        action={{ label: editingBlockId ? 'Editing' : 'Add', onClick: saveDraft, disabled: !draft.title.trim() }}
      />
      <WorkspaceCompactList
        className="schedule-priority-list"
        items={priorityRows}
        empty="No local schedule blocks in this filter."
        ariaLabel="Priority schedule blocks"
      />
      <WorkspaceEvidenceAttachPanel
        role={role}
        operationalOs={operationalOs}
        evidence={evidenceInput}
        disabled={!blocks.length}
        disabledReason={!blocks.length ? 'No schedule blocks are available to attach.' : selectedBlock ? `selected / ${selectedBlock.status}` : 'agenda snapshot'}
      />

      <WorkspaceSectionFrame className="schedule-editor" eyebrow="local block" title={editingBlockId ? 'edit block' : 'create block'} meta="browser saved">
        <div className="schedule-form">
          <input
            aria-label="Schedule block time"
            type="time"
            value={draft.time}
            onChange={(event) => setDraft((current) => ({ ...current, time: event.target.value }))}
          />
          <input
            aria-label="Schedule block date"
            type="date"
            value={draft.date}
            onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))}
          />
          <input
            aria-label="Schedule block title"
            value={draft.title}
            onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
            onKeyDown={(event) => event.key === 'Enter' && saveDraft()}
            placeholder="Block title"
          />
          <input
            aria-label="Schedule block note"
            value={draft.note}
            onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))}
            placeholder="Notes / context"
          />
          <input
            aria-label="Linked workflow template"
            value={draft.linkedWorkflowTemplateId}
            onChange={(event) => setDraft((current) => ({ ...current, linkedWorkflowTemplateId: event.target.value }))}
            placeholder="Workflow template id"
          />
          <WorkspaceButton onClick={saveDraft}>{editingBlockId ? 'Save block' : 'Add block'}</WorkspaceButton>
          {editingBlockId ? <WorkspaceButton variant="secondary" onClick={resetDraft}>Cancel</WorkspaceButton> : null}
        </div>
      </WorkspaceSectionFrame>

      <WorkspaceSectionFrame className="schedule-section" eyebrow="agenda" title="local day plan" meta="today / upcoming / done">
        <div className="schedule-filter-strip" role="tablist" aria-label="Schedule filters">
          {scheduleFilters.map((filter) => (
            <button
              key={filter}
              type="button"
              className={filter === activeFilter ? 'is-active' : undefined}
              onClick={() => setActiveFilter(filter)}
              role="tab"
              aria-selected={filter === activeFilter}
            >
              {filter}
            </button>
          ))}
        </div>

        <div className="schedule-rows" role="list" aria-label="Local schedule blocks">
          {visibleBlocks.length ? visibleBlocks.map((block) => (
            <article
              key={block.id}
              className="schedule-block-card"
              role="listitem"
              data-state={block.status}
              data-selected={selectedBlock?.id === block.id ? 'true' : 'false'}
            >
              <div className="schedule-block-time">
                <strong>{block.time}</strong>
                <span>{block.date}</span>
              </div>
              <div className="schedule-block-main">
                <strong>{block.title}</strong>
                <p>{block.note}</p>
                {block.linkedWorkflowTemplateId ? <small>Workflow: {block.linkedWorkflowTemplateId}</small> : null}
              </div>
              <div className="schedule-block-actions">
                <WorkspaceButton variant="compact" onClick={() => setSelectedBlockId(block.id)}>
                  {selectedBlock?.id === block.id ? 'Selected' : 'Select'}
                </WorkspaceButton>
                <WorkspaceButton variant="compact" onClick={() => startEditing(block)}>Edit</WorkspaceButton>
                <WorkspaceButton variant="compact" onClick={() => setBlocks((current) => completeScheduleBlock(current, block.id))} disabled={block.status === 'done'}>Done</WorkspaceButton>
                <WorkspaceButton variant="compact" onClick={() => setBlocks((current) => postponeScheduleBlock(current, block.id))}>Postpone</WorkspaceButton>
                {block.linkedWorkflowTemplateId ? (
                  <WorkspaceButton variant="compact" onClick={() => onLaunchWorkspaceWidget?.('flow')}>Start workflow</WorkspaceButton>
                ) : null}
                <WorkspaceButton variant="destructive" onClick={() => setBlocks((current) => removeScheduleBlock(current, block.id))}>Remove</WorkspaceButton>
              </div>
            </article>
          )) : (
            <div className="schedule-empty-state">No {activeFilter} blocks. Add one above or switch filters.</div>
          )}
        </div>
      </WorkspaceSectionFrame>
    </WorkspaceContentShell>
  );
}
