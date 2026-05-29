import { useEffect, useState } from 'react';

import { WorkspaceContentShell, WorkspaceEmptyState, WorkspaceSectionFrame, WorkspaceStatusStrip } from '../workspaceBlocks';
import { createLocalFileObjectUrl, formatLocalFileSize, revokeLocalFileObjectUrl, type LocalFileRecord } from '../workspaceLocalFiles';
import { WorkspaceEvidenceAttachPanel } from '../WorkspaceEvidenceAttachPanel';
import type { OperationalOsRuntime } from '../../operational-os';
import type { ShellRole } from '../../shell/roles';

export function ImageWidget({ file, role, operationalOs }: { file?: LocalFileRecord | null; role: ShellRole; operationalOs: OperationalOsRuntime }) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const imageFile = file?.previewKind === 'image' ? file : null;

  useEffect(() => {
    if (!imageFile) {
      setObjectUrl(null);
      return undefined;
    }

    const nextUrl = createLocalFileObjectUrl(imageFile);
    setObjectUrl(nextUrl);

    return () => revokeLocalFileObjectUrl(nextUrl);
  }, [imageFile]);

  return (
    <WorkspaceContentShell className="image-surface">
      <WorkspaceStatusStrip
        source={imageFile ? 'file' : 'unavailable'}
        status={imageFile ? 'active local image' : 'no image loaded'}
        count={imageFile ? imageFile.path : 'load from File Explorer'}
      />
      {imageFile ? (
        <WorkspaceEvidenceAttachPanel
          role={role}
          operationalOs={operationalOs}
          evidence={{
            type: 'image',
            title: imageFile.file.name,
            source: imageFile.path,
            summary: `Local image file, ${formatLocalFileSize(imageFile.file.size)}.`,
          }}
        />
      ) : null}
      <WorkspaceSectionFrame className="image-frame-section" eyebrow="canvas" title={imageFile ? 'image preview' : 'no image loaded'} meta="image">
        <div className="image-frame">
          {imageFile && objectUrl ? (
            <img className="image-preview-media" src={objectUrl} alt={imageFile.path} />
          ) : (
            <WorkspaceEmptyState source="file" title="No image loaded" detail="Load a local image from File Explorer or Preview." />
          )}
        </div>
      </WorkspaceSectionFrame>
    </WorkspaceContentShell>
  );
}
