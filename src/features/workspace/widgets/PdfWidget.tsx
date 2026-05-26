import { useEffect, useState } from 'react';

import { WorkspaceContentHeader, WorkspaceContentShell, WorkspaceEmptyState, WorkspaceSectionFrame, WorkspaceStatusStrip } from '../workspaceBlocks';
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
      <WorkspaceStatusStrip
        source={pdfFile ? 'file' : 'unavailable'}
        status={pdfFile ? 'active local PDF' : 'no PDF loaded'}
        count={pdfFile ? pdfFile.path : 'load from File Explorer'}
      />
      <WorkspaceSectionFrame className="pdf-page-section" eyebrow="document" title={pdfFile ? 'PDF preview' : 'no PDF loaded'} meta="pdf">
        {pdfFile && objectUrl ? (
          <iframe className="pdf-preview-frame" src={objectUrl} title={pdfFile.path} />
        ) : (
          <WorkspaceEmptyState source="file" title="No PDF loaded" detail="Load a local PDF from File Explorer or Preview." />
        )}
      </WorkspaceSectionFrame>
    </WorkspaceContentShell>
  );
}
