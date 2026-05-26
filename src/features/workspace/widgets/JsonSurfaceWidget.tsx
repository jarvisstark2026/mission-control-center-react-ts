import { useMemo, useState } from 'react';

import type { CommandRisk, CommandScope, MissionControlEvent, MissionControlRuntime } from '../../mission-control';
import { canEditJsonSurface, detectJsonSurfaceSchema, type JsonSurfaceDocument, type JsonSurfaceSchemaHint, type OperationalOsRuntime } from '../../operational-os';
import type { ShellRole } from '../../shell/roles';
import { AttentionCard, EvidenceBlock } from '../operationalBlocks';
import { WorkspaceButton, WorkspaceContentHeader, WorkspaceContentShell, WorkspaceSectionFrame, WorkspaceStatusStrip } from '../workspaceBlocks';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringify(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function getPrimitive(value: unknown) {
  if (value === null) return 'null';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  return stringify(value);
}

function getCommandProposalPayload(payload: unknown) {
  if (!isRecord(payload)) return null;
  const command = isRecord(payload.command) ? payload.command : isRecord(payload.proposal) ? payload.proposal : payload;
  if (!isRecord(command)) return null;

  const title = typeof command.title === 'string' ? command.title : typeof command.action === 'string' ? command.action : null;
  if (!title) return null;

  return {
    title,
    summary: typeof command.summary === 'string' ? command.summary : typeof command.description === 'string' ? command.description : title,
    scope: ['household', 'system', 'support', 'security'].includes(command.scope as string) ? (command.scope as CommandScope) : 'system',
    risk: ['safe', 'elevated', 'critical'].includes(command.risk as string) ? (command.risk as CommandRisk) : 'safe',
    expectedResult: typeof command.expectedResult === 'string' ? command.expectedResult : 'The JSON proposal is staged for human approval.',
    reasoning: typeof command.reasoning === 'string' ? command.reasoning : 'JSON Surface detected a command-like payload and converted it into a gated proposal.',
  };
}

function createJsonCommandEvent(document: JsonSurfaceDocument): MissionControlEvent | null {
  const proposal = getCommandProposalPayload(document.payload);
  if (!proposal) return null;

  const timestamp = new Date().toISOString();
  const commandId = `json-command-${document.id}-${Date.now().toString(36)}`;
  return {
    type: 'command',
    command: {
      id: commandId,
      title: proposal.title,
      summary: proposal.summary,
      source: 'json-surface',
      evidenceIds: [document.id],
      agent: {
        agentId: 'json-surface',
        agentName: 'JSON Surface',
        profile: 'support-diagnostics',
      },
      reasoning: proposal.reasoning,
      expectedResult: proposal.expectedResult,
      scope: proposal.scope,
      risk: proposal.risk,
      status: 'pending',
      requestedAt: timestamp,
      execution: {
        status: 'not-started',
        result: 'Waiting in Command Inbox before any JSON-described action can run.',
        rollbackAvailable: proposal.risk === 'safe',
      },
      auditTrail: [
        {
          id: `audit-${commandId}-proposed`,
          type: 'proposed',
          actor: 'json-surface',
          timestamp,
          detail: `JSON Surface staged "${proposal.title}" from ${document.title}.`,
        },
      ],
    },
  };
}

function JsonRenderer({ document }: { document: JsonSurfaceDocument }) {
  const hint = document.schemaHint ?? detectJsonSurfaceSchema(document.payload);
  const payload = document.payload;

  if (hint === 'table' && Array.isArray(payload)) {
    const columns = Array.from(new Set(payload.flatMap((row) => (isRecord(row) ? Object.keys(row) : [])))).slice(0, 6);
    return (
      <div className="json-surface-table" role="table">
        <div role="row" className="json-surface-table-head">
          {columns.map((column) => <span key={column} role="columnheader">{column}</span>)}
        </div>
        {payload.slice(0, 8).map((row, index) => (
          <div role="row" key={index}>
            {columns.map((column) => <span key={column} role="cell">{getPrimitive(isRecord(row) ? row[column] : '')}</span>)}
          </div>
        ))}
      </div>
    );
  }

  if (hint === 'metrics' && isRecord(payload)) {
    return (
      <div className="json-surface-metrics">
        {Object.entries(payload).slice(0, 12).map(([key, value]) => (
          <div className="metric-tile" key={key}>
            <span>{key}</span>
            <strong>{getPrimitive(value)}</strong>
          </div>
        ))}
      </div>
    );
  }

  if (hint === 'checklist' && Array.isArray(payload)) {
    return (
      <div className="json-surface-checklist">
        {payload.slice(0, 12).map((item, index) => (
          <div className="mission-control-row" key={index} data-state={isRecord(item) && (item.done || item.checked) ? 'done' : 'open'}>
            <span>{isRecord(item) && (item.done || item.checked) ? 'done' : 'open'}</span>
            <strong>{typeof item === 'string' ? item : getPrimitive(isRecord(item) ? item.title ?? item.label ?? item : item)}</strong>
          </div>
        ))}
      </div>
    );
  }

  if (hint === 'timeline' && Array.isArray(payload)) {
    return (
      <div className="mission-control-compact-list">
        {payload.slice(0, 10).map((item, index) => (
          <div className="mission-control-row" key={index}>
            <span>{getPrimitive(isRecord(item) ? item.timestamp ?? item.time ?? item.date ?? index + 1 : index + 1)}</span>
            <strong>{getPrimitive(isRecord(item) ? item.title ?? item.name ?? item.event ?? 'event' : item)}</strong>
            <small>{isRecord(item) ? getPrimitive(item.detail ?? item.status ?? '') : ''}</small>
          </div>
        ))}
      </div>
    );
  }

  return <pre className="json-surface-raw">{stringify(payload)}</pre>;
}

export function JsonSurfaceWidget({
  role,
  operationalOs,
  missionControl,
}: {
  role: ShellRole;
  operationalOs: OperationalOsRuntime;
  missionControl: MissionControlRuntime;
}) {
  const documents = operationalOs.state.jsonDocuments;
  const [selectedId, setSelectedId] = useState(documents[0]?.id ?? '');
  const selectedDocument = documents.find((document) => document.id === selectedId) ?? documents[0] ?? null;
  const [title, setTitle] = useState('');
  const [jsonText, setJsonText] = useState('');
  const [status, setStatus] = useState('Paste JSON from an agent, file, or bridge response.');
  const canEdit = canEditJsonSurface(role);
  const detectedHint = useMemo<JsonSurfaceSchemaHint>(() => {
    try {
      return detectJsonSurfaceSchema(JSON.parse(jsonText || 'null'));
    } catch {
      return 'raw';
    }
  }, [jsonText]);

  const addDocument = () => {
    try {
      const payload = JSON.parse(jsonText);
      const document = operationalOs.addJsonDocument({
        title: title || 'Agent JSON',
        source: 'paste',
        schemaHint: detectJsonSurfaceSchema(payload),
        payload,
      });
      operationalOs.addEvidence({
        type: 'json',
        title: document.title,
        source: 'json-surface',
        summary: `JSON document rendered as ${document.schemaHint ?? 'raw'}.`,
      });
      setSelectedId(document.id);
      setTitle('');
      setJsonText('');
      setStatus(`${document.title} added.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Invalid JSON.');
    }
  };

  const stageCommand = () => {
    if (!selectedDocument) return;
    const event = createJsonCommandEvent(selectedDocument);
    if (!event) {
      setStatus('Selected JSON does not contain a command-like proposal.');
      return;
    }
    missionControl.ingestEvents([event]);
    setStatus('JSON proposal staged in Command Inbox.');
  };

  return (
      <WorkspaceContentShell className="mission-control-surface json-surface">
      <WorkspaceContentHeader eyebrow="JSON Surface" title="agent data renderer" metaEyebrow="schema" meta={selectedDocument?.schemaHint ?? 'none'} />
      <WorkspaceStatusStrip
        source={selectedDocument?.source === 'bridge' ? 'bridge' : selectedDocument ? 'local' : 'unavailable'}
        status={status}
        count={`${documents.length} documents`}
        updatedAt={selectedDocument?.schemaHint ?? 'raw'}
      />

      {selectedDocument ? (
        <AttentionCard
          label={`${selectedDocument.source} / ${selectedDocument.schemaHint ?? detectJsonSurfaceSchema(selectedDocument.payload)}`}
          title={selectedDocument.title}
          risk={getCommandProposalPayload(selectedDocument.payload) ? 'warning' : 'notice'}
          actions={
            <>
              <WorkspaceButton variant="secondary" onClick={stageCommand}>
                Stage command
              </WorkspaceButton>
              <WorkspaceButton variant="destructive" disabled={!canEdit} onClick={() => operationalOs.removeJsonDocument(selectedDocument.id)}>
                Remove
              </WorkspaceButton>
            </>
          }
        >
          <EvidenceBlock label="document id" title={selectedDocument.id}>Created {selectedDocument.createdAt}.</EvidenceBlock>
          <JsonRenderer document={selectedDocument} />
        </AttentionCard>
      ) : null}

      <WorkspaceSectionFrame className="mission-control-list-frame" eyebrow="documents" title="rendered JSON" meta={`${documents.length} stored`}>
        <div className="mission-control-compact-list" role="list" aria-label="JSON documents">
          {documents.map((document) => (
            <button key={document.id} type="button" className="mission-control-row json-surface-document-button" aria-pressed={selectedDocument?.id === document.id} onClick={() => setSelectedId(document.id)}>
              <span>{document.source}</span>
              <strong>{document.title}</strong>
              <small>{document.schemaHint ?? detectJsonSurfaceSchema(document.payload)}</small>
            </button>
          ))}
        </div>
      </WorkspaceSectionFrame>

      {canEdit ? (
        <WorkspaceSectionFrame className="mission-control-list-frame json-surface-compose" eyebrow="input" title="paste JSON" meta={detectedHint}>
          <label className="goals-field">
            <span>title</span>
            <input value={title} onChange={(event) => setTitle(event.currentTarget.value)} placeholder="Bridge payload, task result, custom table..." />
          </label>
          <label className="goals-field">
            <span>json</span>
            <textarea value={jsonText} onChange={(event) => setJsonText(event.currentTarget.value)} rows={8} spellCheck={false} />
          </label>
          <WorkspaceButton variant="primary" disabled={!jsonText.trim()} onClick={addDocument}>
            Render JSON
          </WorkspaceButton>
        </WorkspaceSectionFrame>
      ) : null}
    </WorkspaceContentShell>
  );
}
