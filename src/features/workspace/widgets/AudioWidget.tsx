import { useEffect, useRef, useState } from 'react';

import type { AgentControlState } from '../../agent-control';
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
import {
  addMediaSource,
  createZeroAudioMetrics,
  loadAudioMediaState,
  saveAudioMediaState,
  summarizeAudioAnalyserData,
  type AudioMeterMetrics,
  type MediaSourceRecord,
} from '../workspaceWidgetFeatureModels';
import { usePersistentWorkspaceState } from '../usePersistentWorkspaceState';

export type AudioWidgetProps = {
  role: ShellRole;
  operationalOs: OperationalOsRuntime;
  agentControl?: AgentControlState;
  files?: LocalFileRecord[];
  activeFileId?: string | null;
  selectedFileId?: string | null;
  onBrowseFiles?: (files: FileList | File[]) => Promise<LocalFileRecord[]>;
  onOpenPreview?: (file: LocalFileRecord) => void;
};

type AudioContextConstructor = typeof AudioContext;

function getAudioContextConstructor(): AudioContextConstructor | null {
  if (typeof window === 'undefined') return null;
  return window.AudioContext ?? ((window as typeof window & { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext ?? null);
}

function formatAudioMetric(value: number) {
  return `${Math.round(value * 100)}%`;
}

function getBestAudioFile(files: LocalFileRecord[], activeFileId?: string | null, selectedFileId?: string | null) {
  return (
    files.find((record) => record.id === activeFileId && record.previewKind === 'audio') ??
    files.find((record) => record.id === selectedFileId && record.previewKind === 'audio') ??
    files.find((record) => record.previewKind === 'audio') ??
    null
  );
}

export function AudioWidget({
  role,
  operationalOs,
  agentControl,
  files = [],
  activeFileId = null,
  selectedFileId = null,
  onBrowseFiles,
  onOpenPreview,
}: AudioWidgetProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [audioState, setAudioState] = usePersistentWorkspaceState(loadAudioMediaState, saveAudioMediaState);
  const [sourceName, setSourceName] = useState('Audio source');
  const [sourceUrl, setSourceUrl] = useState('');
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [playbackStatus, setPlaybackStatus] = useState('Ready');
  const [meter, setMeter] = useState<AudioMeterMetrics>(() => createZeroAudioMetrics());
  const [meterError, setMeterError] = useState<string | null>(null);

  const audioFiles = files.filter((record) => record.previewKind === 'audio');
  const selectedFile = getBestAudioFile(files, activeFileId, selectedFileId);
  const selectedSource = audioState.sources.find((source) => source.id === audioState.selectedSourceId) ?? audioState.sources[0] ?? null;
  const activeSource = selectedFile ? { kind: 'file' as const, title: selectedFile.file.name, url: fileUrl, detail: formatLocalFileSize(selectedFile.file.size) } : selectedSource ? { kind: 'browser' as const, title: selectedSource.name, url: selectedSource.url, detail: selectedSource.url } : null;
  const bridgeConnected = agentControl?.connectors.some((connector) => connector.status === 'connected') ?? false;

  useEffect(() => {
    const nextUrl = selectedFile ? createLocalFileObjectUrl(selectedFile) : null;
    setFileUrl(nextUrl);
    return () => revokeLocalFileObjectUrl(nextUrl);
  }, [selectedFile]);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
      void audioContextRef.current?.close();
      audioContextRef.current = null;
    };
  }, []);

  const readAudioMeter = () => {
    const analyser = analyserRef.current;
    const context = audioContextRef.current;
    if (!analyser || !context) return;
    const frequencyData = new Uint8Array(analyser.frequencyBinCount);
    const timeDomainData = new Uint8Array(analyser.fftSize);
    analyser.getByteFrequencyData(frequencyData);
    analyser.getByteTimeDomainData(timeDomainData);
    setMeter(summarizeAudioAnalyserData(frequencyData, timeDomainData, context.sampleRate));
    animationFrameRef.current = requestAnimationFrame(readAudioMeter);
  };

  const ensureAudioMeter = async () => {
    const audio = audioRef.current;
    const AudioContextCtor = getAudioContextConstructor();
    if (!audio || !AudioContextCtor) {
      setMeterError('Web Audio analyser unavailable.');
      return;
    }
    try {
      if (!audioContextRef.current) audioContextRef.current = new AudioContextCtor();
      if (!analyserRef.current) {
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 2048;
        analyserRef.current.smoothingTimeConstant = 0.78;
      }
      if (!sourceNodeRef.current) {
        sourceNodeRef.current = audioContextRef.current.createMediaElementSource(audio);
        sourceNodeRef.current.connect(analyserRef.current);
        analyserRef.current.connect(audioContextRef.current.destination);
      }
      if (audioContextRef.current.state === 'suspended') await audioContextRef.current.resume();
      setMeterError(null);
      if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = requestAnimationFrame(readAudioMeter);
    } catch (error) {
      setMeterError(error instanceof Error ? error.message : 'Unable to start audio analyser.');
    }
  };

  const saveSource = () => {
    setAudioState((current) => addMediaSource(current, 'audio', { name: sourceName, url: sourceUrl }));
    setSourceName('Audio source');
    setSourceUrl('');
  };

  const sourceItems = [
    ...audioFiles.slice(0, 4).map((file) => ({
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
    ...audioState.sources.slice(0, 5).map((source: MediaSourceRecord) => ({
      id: source.id,
      meta: 'browser',
      title: source.name,
      detail: source.url,
      state: source.id === selectedSource?.id && !selectedFile ? 'active' : 'browser',
      action: {
        label: source.id === selectedSource?.id && !selectedFile ? 'Active' : 'Use',
        disabled: source.id === selectedSource?.id && !selectedFile,
        onClick: () => setAudioState((current) => ({ ...current, selectedSourceId: source.id, updatedAt: new Date().toISOString() })),
      },
    })),
  ];

  return (
    <WorkspaceContentShell className="audio-widget-shell widget-feature-shell">
      <WorkspaceStatusStrip
        source={activeSource?.kind === 'file' ? 'file' : activeSource?.kind === 'browser' ? 'browser' : bridgeConnected ? 'bridge' : 'unavailable'}
        status={activeSource ? playbackStatus : bridgeConnected ? 'agent activity available' : 'source required'}
        count={`amp ${formatAudioMetric(meter.amplitude)} / peak ${formatAudioMetric(meter.peak)}`}
        updatedAt={meter.dominantFrequencyHz ? `${meter.dominantFrequencyHz} Hz` : '-- Hz'}
        action={{
          label: 'Browse',
          onClick: () => document.getElementById('audio-widget-file-input')?.click(),
          disabled: !onBrowseFiles,
          title: 'Load audio files from this workspace',
        }}
      />

      <WorkspaceEvidenceAttachPanel
        role={role}
        operationalOs={operationalOs}
        evidence={
          selectedFile
            ? createLocalFileEvidenceInput(selectedFile, 'audio-widget')
            : activeSource?.url
              ? createUrlEvidenceInput(activeSource.url, `${activeSource.title} audio source`, 'audio-widget', `${activeSource.kind} audio / ${activeSource.detail}`)
              : { type: 'file', title: 'Audio source', source: 'audio-widget', summary: 'Audio source required.' }
        }
        disabled={!selectedFile && !activeSource?.url}
        disabledReason={!selectedFile && !activeSource?.url ? 'Load or save an audio source before attaching evidence.' : undefined}
      />

      <WorkspaceSectionFrame className="media-widget-stage audio-feature-stage" eyebrow="playback" title="real audio analyser" meta="Web Audio">
        {activeSource?.url ? (
          <audio
            ref={audioRef}
            className="audio-feature-player"
            src={activeSource.url}
            controls
            preload="metadata"
            crossOrigin="anonymous"
            onPlay={() => {
              setPlaybackStatus('Playing');
              void ensureAudioMeter();
            }}
            onPause={() => {
              setPlaybackStatus('Paused');
              if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
            }}
            onLoadedMetadata={() => setPlaybackStatus('Loaded')}
            onError={() => setPlaybackStatus('Playback failed')}
          />
        ) : (
          <WorkspaceEmptyState source="file" title="Audio source required" detail="Browse a local file or save a trusted URL. Meter values appear during playback." />
        )}

        <div className="audio-feature-meter" aria-label="Audio analyser values">
          <span><strong>AMP</strong>{formatAudioMetric(meter.amplitude)}</span>
          <span><strong>PEAK</strong>{formatAudioMetric(meter.peak)}</span>
          <span><strong>HZ</strong>{meter.dominantFrequencyHz ?? '--'}</span>
          <i style={{ transform: `scaleX(${Math.max(0.03, meter.amplitude)})` }} />
        </div>
        {meterError ? <small className="widget-feature-error">{meterError}</small> : null}

        <input
          id="audio-widget-file-input"
          className="widget-hidden-file-input"
          type="file"
          accept="audio/*,.mp3,.wav,.m4a,.aac,.flac,.ogg,.oga"
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
            <input value={sourceName} onChange={(event) => setSourceName(event.target.value)} placeholder="Mic mix, sample, feed" />
          </label>
          <label>
            <span>URL</span>
            <input value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://...mp3 or WAV" />
          </label>
          <WorkspaceButton variant="secondary" onClick={saveSource} disabled={!sourceName.trim() || !sourceUrl.trim()}>
            Save source
          </WorkspaceButton>
        </div>

        <WorkspaceCompactList items={sourceItems} empty="Audio sources appear after local import or URL save." ariaLabel="Audio sources" />
      </WorkspaceSectionFrame>
    </WorkspaceContentShell>
  );
}
