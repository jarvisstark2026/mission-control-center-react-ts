import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { WorkspaceButton, WorkspaceContentHeader, WorkspaceContentShell, WorkspaceEmptyState, WorkspaceSectionFrame, WorkspaceStatusStrip } from '../workspaceBlocks';
import { createLocalFileObjectUrl, formatLocalFileSize, readLocalFileTextPreview, revokeLocalFileObjectUrl, type LocalFileRecord } from '../workspaceLocalFiles';
import { WorkspaceEvidenceAttachPanel } from '../WorkspaceEvidenceAttachPanel';
import type { CreateEvidenceInput, OperationalOsRuntime } from '../../operational-os';
import type { ShellRole } from '../../shell/roles';

function getEvidenceTypeForFile(file: LocalFileRecord): CreateEvidenceInput['type'] {
  if (file.previewKind === 'image') return 'image';
  if (file.previewKind === 'pdf') return 'pdf';
  return 'file';
}

export function PreviewWidget({
  file,
  onBrowseFiles,
  onOpenPreview,
  role,
  operationalOs,
}: {
  file: LocalFileRecord | null;
  onBrowseFiles: (files: FileList | File[]) => Promise<LocalFileRecord[]>;
  onOpenPreview: (file: LocalFileRecord) => void;
  role: ShellRole;
  operationalOs: OperationalOsRuntime;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [textPreview, setTextPreview] = useState('');
  const [status, setStatus] = useState('Select a local file to preview it.');

  useEffect(() => {
    if (!file) {
      setObjectUrl(null);
      setTextPreview('');
      setStatus('Select a local file to preview it.');
      return undefined;
    }

    const nextUrl = createLocalFileObjectUrl(file);
    let cancelled = false;
    setObjectUrl(nextUrl);
    setStatus(`Opening ${file.previewKind} preview...`);
    setTextPreview('');

    if (file.previewKind === 'text') {
      void readLocalFileTextPreview(file.file, 16000)
        .then((content) => {
          if (cancelled) return;
          setTextPreview(content);
          setStatus(`Text preview ready - ${formatLocalFileSize(file.file.size)}`);
        })
        .catch(() => {
          if (cancelled) return;
          setTextPreview('');
          setStatus('Text preview unavailable for this file.');
        });
    } else {
      setStatus(`Ready - ${formatLocalFileSize(file.file.size)}`);
    }

    return () => {
      cancelled = true;
      revokeLocalFileObjectUrl(nextUrl);
    };
  }, [file]);

  const handleBrowsePreviewFiles = () => {
    fileInputRef.current?.click();
  };

  const handlePreviewFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    const imported = await onBrowseFiles(selectedFiles);
    imported.forEach((record) => onOpenPreview(record));
    event.target.value = '';
  };

  if (!file) {
    return (
      <WorkspaceContentShell className="preview-surface">
        <WorkspaceContentHeader
          eyebrow="Preview"
          title="local file inspector"
          metaEyebrow="drop-ready"
          meta="image / audio / video / pdf / text"
        />
        <WorkspaceStatusStrip source="file" status="no file selected" count="image / audio / video / pdf / text" />
        <WorkspaceSectionFrame className="preview-empty-frame" eyebrow="preview stage" title="no file selected" meta="local only">
          <div className="preview-empty-state">
            <WorkspaceEmptyState
              source="file"
              title="Pick a local file to inspect"
              detail="Images, audio, video, PDFs, and text files render here. Unsupported files still get an open/download handoff."
              action={{ label: 'Preview a file', onClick: handleBrowsePreviewFiles }}
            />
            <input
              ref={fileInputRef}
              className="preview-empty-input"
              type="file"
              multiple
              aria-hidden="true"
              tabIndex={-1}
              onChange={handlePreviewFileChange}
            />
          </div>
        </WorkspaceSectionFrame>
      </WorkspaceContentShell>
    );
  }

  return (
    <WorkspaceContentShell className="preview-surface preview-file-surface">
      <WorkspaceContentHeader
        eyebrow="Preview"
        title={file.path}
        metaEyebrow={file.previewKind}
        meta={`${file.file.type || 'unknown type'} - ${formatLocalFileSize(file.file.size)}`}
      />

      <WorkspaceStatusStrip source="file" status={status} count={file.file.name} updatedAt={formatLocalFileSize(file.file.size)} />
      <WorkspaceEvidenceAttachPanel
        role={role}
        operationalOs={operationalOs}
        evidence={{
          type: getEvidenceTypeForFile(file),
          title: file.file.name,
          source: file.path,
          summary: `Local ${file.previewKind} preview, ${formatLocalFileSize(file.file.size)}.`,
        }}
      />

      <WorkspaceSectionFrame className="preview-file-controls" eyebrow="preview controls" title="local intake" meta="selected file">
        <WorkspaceButton className="preview-empty-button" onClick={handleBrowsePreviewFiles}>
          Preview another file
        </WorkspaceButton>
        <input
          ref={fileInputRef}
          className="preview-empty-input"
          type="file"
          multiple
          aria-hidden="true"
          tabIndex={-1}
          onChange={handlePreviewFileChange}
        />
      </WorkspaceSectionFrame>

      <WorkspaceSectionFrame className="preview-file-frame" eyebrow="file stage" title="active preview" meta={file.previewKind}>
        <div className="preview-file-stage">
          {file.previewKind === 'image' && objectUrl ? (
            <figure className="preview-media preview-media-image">
              <img src={objectUrl} alt={file.path} />
            </figure>
          ) : null}

          {file.previewKind === 'video' && objectUrl ? (
            <div className="preview-media preview-media-video">
              <video controls src={objectUrl} />
            </div>
          ) : null}

          {file.previewKind === 'audio' && objectUrl ? (
            <div className="preview-media preview-media-audio">
              <audio controls src={objectUrl} />
            </div>
          ) : null}

          {file.previewKind === 'pdf' && objectUrl ? (
            <iframe className="preview-media preview-media-pdf" src={objectUrl} title={file.path} />
          ) : null}

          {file.previewKind === 'text' ? (
            <pre className="preview-media preview-media-text">{textPreview || 'Loading text preview...'}</pre>
          ) : null}

          {file.previewKind === 'unsupported' ? (
            <div className="preview-media preview-media-unsupported">
              <strong>No native preview for this file.</strong>
              <p>{status}</p>
              {objectUrl ? (
                <a className="preview-download-link" href={objectUrl} download={file.file.name}>
                  Open / download
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
      </WorkspaceSectionFrame>
    </WorkspaceContentShell>
  );
}

