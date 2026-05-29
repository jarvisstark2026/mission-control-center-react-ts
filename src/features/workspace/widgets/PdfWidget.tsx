import { useEffect, useState } from 'react';

import { WorkspaceContentShell, WorkspaceEmptyState, WorkspaceSectionFrame, WorkspaceStatusStrip } from '../workspaceBlocks';
import { createLocalFileObjectUrl, formatLocalFileSize, revokeLocalFileObjectUrl, type LocalFileRecord } from '../workspaceLocalFiles';
import { WorkspaceEvidenceAttachPanel } from '../WorkspaceEvidenceAttachPanel';
import type { OperationalOsRuntime } from '../../operational-os';
import type { ShellRole } from '../../shell/roles';

export function PdfWidget({ file, role, operationalOs }: { file?: LocalFileRecord | null; role: ShellRole; operationalOs: OperationalOsRuntime }) {
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
      <WorkspaceStatusStrip
        source={pdfFile ? 'file' : 'unavailable'}
        status={pdfFile ? 'active local PDF' : 'no PDF loaded'}
        count={pdfFile ? pdfFile.path : 'load from File Explorer'}
      />
      {pdfFile ? (
        <WorkspaceEvidenceAttachPanel
          role={role}
          operationalOs={operationalOs}
          evidence={{
            type: 'pdf',
            title: pdfFile.file.name,
            source: pdfFile.path,
            summary: `Local PDF file, ${formatLocalFileSize(pdfFile.file.size)}.`,
          }}
        />
      ) : null}
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
