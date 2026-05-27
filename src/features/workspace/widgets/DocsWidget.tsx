import { WorkspaceContentHeader, WorkspaceContentShell, WorkspaceSectionFrame, WorkspaceStatusStrip } from '../workspaceBlocks';
import { loadLocalDocumentState, saveLocalDocumentState } from '../workspaceEvidenceModel';
import { usePersistentWorkspaceState } from '../usePersistentWorkspaceState';
import { WorkspaceEvidenceAttachPanel } from '../WorkspaceEvidenceAttachPanel';
import type { OperationalOsRuntime } from '../../operational-os';
import type { ShellRole } from '../../shell/roles';

export function DocsWidget({ role, operationalOs }: { role: ShellRole; operationalOs: OperationalOsRuntime }) {
  const [documentState, setDocumentState] = usePersistentWorkspaceState(loadLocalDocumentState, saveLocalDocumentState);
  const wordCount = documentState.body.trim().split(/\s+/).filter(Boolean).length;
  const updatedTime = new Date(documentState.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <WorkspaceContentShell className="docs-surface">
      <WorkspaceContentHeader
        eyebrow="Docs"
        title="local evidence note"
        metaEyebrow="saved"
        meta={`${wordCount} words - ${updatedTime}`}
      />
      <WorkspaceStatusStrip source="local" status={documentState.title} count={`${wordCount} words`} updatedAt={`saved ${updatedTime}`} />
      <WorkspaceEvidenceAttachPanel
        role={role}
        operationalOs={operationalOs}
        evidence={{
          type: 'note',
          title: documentState.title,
          source: 'docs-widget',
          summary: documentState.body.slice(0, 240),
        }}
        disabled={!documentState.body.trim()}
        disabledReason={!documentState.body.trim() ? 'Write a note before attaching evidence.' : undefined}
      />
      <div className="docs-layout">
        <WorkspaceSectionFrame className="docs-sidebar" eyebrow="outline" title="note status" meta="local draft">
          <div className="docs-evidence-summary">
            <span>Storage</span>
            <strong>localStorage</strong>
            <small>No upload, no agent, no backend.</small>
          </div>
          <div className="docs-evidence-summary">
            <span>Use case</span>
            <strong>Decision evidence</strong>
            <small>Paste findings, links, and observations before opening an approval.</small>
          </div>
        </WorkspaceSectionFrame>
        <WorkspaceSectionFrame className="docs-page" eyebrow="document" title="writing surface" meta="editable">
          <input
            className="docs-title-input"
            aria-label="Document title"
            value={documentState.title}
            onChange={(event) =>
              setDocumentState((current) => ({
                ...current,
                title: event.target.value,
                updatedAt: new Date().toISOString(),
              }))
            }
          />
          <textarea
            className="docs-body-input"
            aria-label="Document body"
            value={documentState.body}
            onChange={(event) =>
              setDocumentState((current) => ({
                ...current,
                body: event.target.value,
                updatedAt: new Date().toISOString(),
              }))
            }
          />
        </WorkspaceSectionFrame>
      </div>
    </WorkspaceContentShell>
  );
}
