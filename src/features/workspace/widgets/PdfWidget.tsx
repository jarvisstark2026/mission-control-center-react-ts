import { useEffect, useState } from 'react';

import { WorkspaceContentHeader, WorkspaceContentShell, WorkspaceSectionFrame, WorkspaceSummaryPanel } from '../workspaceBlocks';
import { createLocalFileObjectUrl, formatLocalFileSize, revokeLocalFileObjectUrl, type LocalFileRecord } from '../workspaceLocalFiles';

export function PdfWidget({ file }: { file?: LocalFileRecord | null }) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const pdfFile = file?.previewKind === 'pdf' ? file : null;

  useEffect(() => {
    if (!pdfFile) {
      setObjectUrl(null);
      return undefined;
    }

    const nextUrl = createLocalFileObjectUrl(pdfFile);
    setObjectUrl(nextUrl);

    return () => revokeLocalFileObjectUrl(nextUrl);
  }, [pdfFile]);

  return (
    <WorkspaceContentShell className="pdf-surface">
      <WorkspaceContentHeader
        eyebrow="PDF workspace"
        title={pdfFile ? pdfFile.file.name : 'read / search / export'}
        metaEyebrow="document"
        meta={pdfFile ? formatLocalFileSize(pdfFile.file.size) : 'page preview'}
      />
      <WorkspaceSummaryPanel className="pdf-summary" title={pdfFile ? 'active local PDF' : 'document preview'}>
        {pdfFile ? `${pdfFile.path}. This PDF is loaded from the local file intake.` : 'Use File Explorer or Preview to load a local PDF.'}
      </WorkspaceSummaryPanel>
      <WorkspaceSectionFrame className="pdf-page-section" eyebrow="document" title={pdfFile ? 'PDF preview' : 'no PDF loaded'} meta="pdf">
        {pdfFile && objectUrl ? (
          <iframe className="pdf-preview-frame" src={objectUrl} title={pdfFile.path} />
        ) : (
          <div className="pdf-page">
            <div className="pdf-ribbon" />
            <div className="pdf-lines">
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
          </div>
        )}
      </WorkspaceSectionFrame>
    </WorkspaceContentShell>
  );
}
