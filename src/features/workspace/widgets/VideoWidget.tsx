import { useEffect, useState } from 'react';

import type { ShellRole } from '../../shell/roles';
import type { OperationalOsRuntime } from '../../operational-os';
import { WorkspaceEvidenceAttachPanel } from '../WorkspaceEvidenceAttachPanel';
import { WorkspaceButton,
  WorkspaceCompactList,  WorkspaceContentShell,
  WorkspaceEmptyState,
  WorkspaceSectionFrame,
  WorkspaceStatusStrip } from '../workspaceBlocks';
import { createLocalFileEvidenceInput, createUrlEvidenceInput } from '../workspaceEvidenceModel';
import { createLocalFileObjectUrl, formatLocalFileSize, revokeLocalFileObjectUrl, type LocalFileRecord } from '../workspaceLocalFiles';
import { addMediaSource, loadVideoMediaState, saveVideoMediaState, type MediaSourceRecord } from '../workspaceWidgetFeatureModels';
import { usePersistentWorkspaceState } from '../usePersistentWorkspaceState';

export type VideoWidgetProps = {
  role: ShellRole;
  operationalOs: OperationalOsRuntime;
  files?: LocalFileRecord[];
  activeFileId?: string | null;
  selectedFileId?: string | null;
  onBrowseFiles?: (files: FileList | File[]) => Promise<LocalFileRecord[]>;
  onOpenPreview?: (file: LocalFileRecord) => void;
};

function getBestVideoFile(files: LocalFileRecord[], activeFileId?: string | null, selectedFileId?: string | null) {
  return (
    files.find((record) => record.id === activeFileId && record.previewKind === 'video') ??
    files.find((record) => record.id === selectedFileId && record.previewKind === 'video') ??
    files.find((record) => record.previewKind === 'video') ??
    null
  );
}

export function VideoWidget({ role, operationalOs, files = [], activeFileId = null, selectedFileId = null, onBrowseFiles, onOpenPreview }: VideoWidgetProps) {
  const [videoState, setVideoState] = usePersistentWorkspaceState(loadVideoMediaState, saveVideoMediaState);
  const [sourceName, setSourceName] = useState('Video source');
  const [sourceUrl, setSourceUrl] = useState('');
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [playbackStatus, setPlaybackStatus] = useState('Ready');

  const videoFiles = files.filter((record) => record.previewKind === 'video');
  const selectedFile = getBestVideoFile(files, activeFileId, selectedFileId);
  const selectedSource = videoState.sources.find((source) => source.id === videoState.selectedSourceId) ?? videoState.sources[0] ?? null;
  const activeSource = selectedFile ? { kind: 'file' as const, title: selectedFile.file.name, url: fileUrl, detail: formatLocalFileSize(selectedFile.file.size) } : selectedSource ? { kind: 'browser' as const, title: selectedSource.name, url: selectedSource.url, detail: selectedSource.url } : null;

  useEffect(() => {
    const nextUrl = selectedFile ? createLocalFileObjectUrl(selectedFile) : null;
    setFileUrl(nextUrl);
    return () => revokeLocalFileObjectUrl(nextUrl);
  }, [selectedFile]);

  const saveSource = () => {
    setVideoState((current) => addMediaSource(current, 'video', { name: sourceName, url: sourceUrl }));
    setSourceName('Video source');
    setSourceUrl('');
  };

  const sourceItems = [
    ...videoFiles.slice(0, 4).map((file) => ({
      id: file.id,
      meta: 'file',
      title: file.file.name,
      detail: `${formatLocalFileSize(file.file.size)} / ${file.path}`,
      state: file.id === selectedFile?.id ? 'active' : 'file',
      action: {
        label: file.id === selectedFile?.id ? 'Preview' : 'Open',
        onClick: () => onOpenPreview?.(file),
      },
    })),
    ...videoState.sources.slice(0, 5).map((source: MediaSourceRecord) => ({
      id: source.id,
      meta: 'browser',
      title: source.name,
      detail: source.url,
      state: source.id === selectedSource?.id && !selectedFile ? 'active' : 'browser',
      action: {
        label: source.id === selectedSource?.id && !selectedFile ? 'Active' : 'Use',
        disabled: source.id === selectedSource?.id && !selectedFile,
        onClick: () => setVideoState((current) => ({ ...current, selectedSourceId: source.id, updatedAt: new Date().toISOString() })),
      },
    })),
  ];

  return (
    <WorkspaceContentShell className="video-widget-shell widget-feature-shell">
      <WorkspaceStatusStrip
        source={activeSource?.kind === 'file' ? 'file' : activeSource?.kind === 'browser' ? 'browser' : 'unavailable'}
        status={activeSource ? playbackStatus : 'source required'}
        count={`${videoFiles.length} local / ${videoState.sources.length} saved`}
        updatedAt={activeSource?.detail ?? 'load or save a source'}
        action={{
          label: 'Browse',
          onClick: () => document.getElementById('video-widget-file-input')?.click(),
          disabled: !onBrowseFiles,
          title: 'Load video files from this workspace',
        }}
      />

      <WorkspaceEvidenceAttachPanel
        role={role}
        operationalOs={operationalOs}
        evidence={
          selectedFile
            ? createLocalFileEvidenceInput(selectedFile, 'video-widget')
            : activeSource?.url
              ? createUrlEvidenceInput(activeSource.url, `${activeSource.title} video source`, 'video-widget', `${activeSource.kind} video / ${activeSource.detail}`)
              : { type: 'file', title: 'Video source', source: 'video-widget', summary: 'Video source required.' }
        }
        disabled={!selectedFile && !activeSource?.url}
        disabledReason={!selectedFile && !activeSource?.url ? 'Load or save a video source before attaching evidence.' : undefined}
      />

      <WorkspaceSectionFrame className="media-widget-stage video-feature-stage" eyebrow="playback" title="active source" meta={activeSource?.kind ?? 'source required'}>
        {activeSource?.url ? (
          <video
            className="video-feature-player"
            src={activeSource.url}
            controls
            playsInline
            preload="metadata"
            onPlay={() => setPlaybackStatus('Playing')}
            onPause={() => setPlaybackStatus('Paused')}
            onLoadedMetadata={() => setPlaybackStatus('Loaded')}
            onError={() => setPlaybackStatus('Playback failed')}
          />
        ) : (
          <WorkspaceEmptyState source="file" title="Video source required" detail="Browse a local file or save a trusted URL before playback." />
        )}

        <input
          id="video-widget-file-input"
          className="widget-hidden-file-input"
          type="file"
          accept="video/*,.mp4,.webm,.mov,.m4v,.mkv,.ogv"
          multiple
          onChange={(event) => {
            const nextFiles = event.currentTarget.files;
            if (nextFiles?.length) void onBrowseFiles?.(nextFiles);
            event.currentTarget.value = '';
          }}
        />

        <div className="widget-feature-form widget-feature-inline-form">
          <label>
            <span>Name</span>
            <input value={sourceName} onChange={(event) => setSourceName(event.target.value)} placeholder="Camera, render, stream" />
          </label>
          <label>
            <span>URL</span>
            <input value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://...mp4 or WebM" />
          </label>
          <WorkspaceButton variant="secondary" onClick={saveSource} disabled={!sourceName.trim() || !sourceUrl.trim()}>
            Save source
          </WorkspaceButton>
        </div>

        <WorkspaceCompactList items={sourceItems} empty="Video sources appear after local import or URL save." ariaLabel="Video sources" />
      </WorkspaceSectionFrame>
    </WorkspaceContentShell>
  );
}
