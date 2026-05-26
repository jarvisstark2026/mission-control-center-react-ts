import { useEffect, useState } from 'react';

import { WorkspaceContentHeader, WorkspaceContentShell, WorkspaceEmptyState, WorkspaceSectionFrame, WorkspaceStatusStrip } from '../workspaceBlocks';
import { createLocalFileObjectUrl, formatLocalFileSize, revokeLocalFileObjectUrl, type LocalFileRecord } from '../workspaceLocalFiles';

export function ImageWidget({ file }: { file?: LocalFileRecord | null }) {
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
      <WorkspaceContentHeader
        eyebrow="Image workspace"
        title={imageFile ? imageFile.file.name : 'preview / annotate / crop'}
        metaEyebrow="asset"
        meta={imageFile ? formatLocalFileSize(imageFile.file.size) : 'drop-ready'}
      />
      <WorkspaceStatusStrip
        source={imageFile ? 'file' : 'unavailable'}
        status={imageFile ? 'active local image' : 'no image loaded'}
        count={imageFile ? imageFile.path : 'load from File Explorer'}
      />
      <WorkspaceSectionFrame className="image-frame-section" eyebrow="canvas" title={imageFile ? 'image preview' : 'no image loaded'} meta="image">
        <div className="image-frame">
          {imageFile && objectUrl ? (
            <img className="image-preview-media" src={objectUrl} alt={imageFile.path} />
          ) : (
            <WorkspaceEmptyState source="file" title="No image loaded" detail="Use File Explorer or Preview to load a local image, then inspect it here." />
          )}
        </div>
      </WorkspaceSectionFrame>
    </WorkspaceContentShell>
  );
}
