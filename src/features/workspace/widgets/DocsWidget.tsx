import { WorkspaceContentHeader, WorkspaceContentShell, WorkspaceSectionFrame, WorkspaceSummaryPanel } from '../workspaceBlocks';
import { loadLocalDocumentState, saveLocalDocumentState } from '../workspaceEvidenceModel';
import { usePersistentWorkspaceState } from '../usePersistentWorkspaceState';

export function DocsWidget() {
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
      <WorkspaceSummaryPanel title={documentState.title}>
        Local notes are persisted in this browser and can be used as evidence beside Command Inbox decisions.
      </WorkspaceSummaryPanel>
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
