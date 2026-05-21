import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';

import { createId } from '../../lib/createId';
import {
  DesktopBridgePanel,
  WorkspaceActionRowList,
  WorkspaceButton,
  WorkspaceCatalogGrid,
  WorkspaceContentHeader,
  WorkspaceContentShell,
  WorkspaceMetricGrid,
  WorkspaceRowList,
  WorkspaceSectionFrame,
  WorkspaceSummaryPanel,
} from './workspaceBlocks';
import { defaultDesktopApps, rememberDesktopApp, type DesktopAppRecord } from './workspaceDesktopApps';
import {
  createLocalFileObjectUrl,
  createLocalFileRecord,
  formatLocalFileSize,
  generalUseFolderLabel,
  readLocalFileTextPreview,
  revokeLocalFileObjectUrl,
  type LocalFileRecord,
  type LocalFolderEntry,
} from './workspaceLocalFiles';
import { getMarketGraph, marketCategories, type MarketGraph } from './workspaceMarketData';
import { isWorkspaceWidgetKind, type WorkspaceWidget } from './workspaceTypes';
import { getWidgetLabel, getWorkspaceLauncherEntries } from './workspaceWidgetCatalog';
import {
  createWorkflowDraft,
  getWorkflowSteps,
  getWorkflowTemplate,
  loadSavedWorkflows,
  openWorkflowHandout,
  saveSavedWorkflows,
  workflowSkills,
  workflowTemplates,
  type SavedWorkflow,
  type WorkflowDraft,
} from './workflowStudioModel';

export function OverviewWidget() {
  const stats = [
    { label: 'system', value: '98%' },
    { label: 'devices', value: '24' },
    { label: 'alerts', value: '12' },
    { label: 'workspace mode', value: 'drag / resize / stack / fade', wide: true },
  ];

  return (
    <WorkspaceContentShell className="overview-surface">
      <WorkspaceContentHeader
        eyebrow="System overview"
        title="status / devices / alerts"
        metaEyebrow="workspace"
        meta="live frame"
      />
      <WorkspaceSummaryPanel className="overview-summary" title="workspace health">
        Core workspace telemetry now uses the same header, status, and stage cadence as Markets before expanding into the live command summary.
      </WorkspaceSummaryPanel>
      <WorkspaceSectionFrame className="overview-dashboard" eyebrow="telemetry" title="command summary" meta={`${stats.length} signals`}>
        <div className="widget-grid">
          <div className="stats-arc" />
          <WorkspaceMetricGrid metrics={stats} />
        </div>
      </WorkspaceSectionFrame>
    </WorkspaceContentShell>
  );
}

export function GraphWidget() {
  return (
    <WorkspaceContentShell className="graph-surface">
      <WorkspaceContentHeader
        eyebrow="Telemetry graph"
        title="signal trace / trend line"
        metaEyebrow="scope"
        meta="3 channels"
      />
      <WorkspaceSummaryPanel className="graph-summary" title="signal monitor">
        Live trace staging now follows the shared Markets hierarchy, keeping chart context above the flexible graph body rather than embedded in bespoke chrome.
      </WorkspaceSummaryPanel>
      <WorkspaceSectionFrame className="graph-stage" eyebrow="chart" title="live trace" meta="sparkline">
        <div className="spark-panel">
          <div className="spark-line spark-a" />
          <div className="spark-line spark-b" />
          <div className="spark-line spark-c" />
          <div className="spark-grid" />
          <div className="spark-axis" />
        </div>
      </WorkspaceSectionFrame>
    </WorkspaceContentShell>
  );
}

export function TradingGraphWidget({ graph }: { graph: MarketGraph }) {
  const summary = [
    { label: 'horizon', value: graph.horizon },
    { label: 'signal', value: graph.change },
    { label: 'notes', value: graph.note, wide: true },
  ];

  return (
    <WorkspaceContentShell className="trading-graph-surface">
      <WorkspaceContentHeader
        className="trading-graph-header"
        eyebrow="market graph"
        title={graph.label}
        metaEyebrow={graph.ticker}
        meta={graph.category}
      />
      <WorkspaceSummaryPanel className="trading-graph-routing" title="graph routing">
        Selecting a market item in the markets widget brings this graph forward and swaps the market context. No ceremony, just the useful bit.
      </WorkspaceSummaryPanel>
      <WorkspaceSectionFrame className="trading-graph-body" eyebrow="chart" title="active market trace" meta={graph.ticker}>
        <WorkspaceMetricGrid className="trading-graph-summary" metrics={summary} />
        <div className="trading-graph-stage">
          <div className="trading-graph-grid" />
          <div className="trading-graph-line trading-a" />
          <div className="trading-graph-line trading-b" />
          <div className="trading-graph-volume" />
        </div>
      </WorkspaceSectionFrame>
    </WorkspaceContentShell>
  );
}

export function SpreadsheetWidget() {
  const columns = ['Q1', 'Q2', 'Q3', 'Q4'];
  const rows = [
    ['Revenue', '18.2', '21.5', '24.0', '26.8'],
    ['Costs', '9.1', '9.6', '10.3', '11.4'],
    ['Margin', '50%', '55%', '57%', '58%'],
    ['Forecast', '14', '16', '18', '20'],
  ];

  return (
    <WorkspaceContentShell className="sheet-surface">
      <WorkspaceContentHeader
        eyebrow="Spreadsheet"
        title="formula bar / grid / cells"
        metaEyebrow="model"
        meta={`${rows.length} rows`}
      />
      <WorkspaceSummaryPanel title="quarterly operating model">
        A compact tabular workspace for reviewing revenue, cost, margin, and forecast figures without adding another bespoke header stack.
      </WorkspaceSummaryPanel>
      <WorkspaceSectionFrame className="sheet-grid-frame" eyebrow="grid" title="financial snapshot" meta={`${columns.length} quarters`}>
        <div className="sheet-grid">
          <div className="sheet-corner" />
          {columns.map((col) => (
            <div className="sheet-head" key={col}>{col}</div>
          ))}
          {rows.map((row) => (
            <div className="sheet-row" key={row[0]}>
              <div className="sheet-row-label">{row[0]}</div>
              {row.slice(1).map((cell, index) => (
                <div className="sheet-cell" key={`${row[0]}-${index}`}>{cell}</div>
              ))}
            </div>
          ))}
        </div>
      </WorkspaceSectionFrame>
    </WorkspaceContentShell>
  );
}

export function DocsWidget() {
  const outlineRows = [
    { id: 'title', primary: 'Title', secondary: 'Mission Control Center Brief', meta: 'ready' },
    { id: 'abstract', primary: 'Abstract', secondary: 'Operational summary', meta: 'draft' },
    { id: 'sections', primary: 'Sections', secondary: 'Architecture · Systems · Risks', meta: 'in progress' },
    { id: 'appendix', primary: 'Appendix', secondary: 'References and links', meta: 'pending' },
  ];

  return (
    <WorkspaceContentShell className="docs-surface">
      <WorkspaceContentHeader
        eyebrow="Docs"
        title="briefing workspace"
        metaEyebrow="outline"
        meta={`${outlineRows.length} sections`}
      />
      <WorkspaceSummaryPanel title="Mission Control Center Brief">
        Operational note. This panel behaves like a writing surface: clean sections, careful emphasis, and no unnecessary spectacle.
      </WorkspaceSummaryPanel>
      <div className="docs-layout">
        <WorkspaceSectionFrame className="docs-sidebar" eyebrow="outline" title="document map" meta="live draft">
          <WorkspaceRowList rows={outlineRows} className="docs-outline-list" ariaLabel="Document outline" />
        </WorkspaceSectionFrame>
        <WorkspaceSectionFrame className="docs-page" eyebrow="document" title="writing surface" meta="ready">
          <div className="docs-lines" aria-label="Document layout preview">
            <span />
            <span />
            <span />
            <span />
          </div>
        </WorkspaceSectionFrame>
      </div>
    </WorkspaceContentShell>
  );
}

export function SlidesWidget() {
  const slides = ['Vision', 'Stack', 'Workflows', 'Launch'];
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const activeSlide = slides[activeSlideIndex] ?? slides[0];

  const slideCards = slides.map((slide, index) => ({
    id: slide.toLowerCase(),
    label: `${index + 1}. ${slide}`,
    note: index === activeSlideIndex ? 'active frame' : 'jump to frame',
    badge: `slide ${index + 1}`,
    active: index === activeSlideIndex,
  }));

  return (
    <WorkspaceContentShell className="slides-surface">
      <WorkspaceContentHeader
        eyebrow="Slides"
        title="presentation stage"
        metaEyebrow="slide"
        meta={`${activeSlideIndex + 1} / ${slides.length}`}
      />
      <WorkspaceSummaryPanel title={activeSlide}>
        Presentation staging for the command story, now sharing the same header and summary hierarchy as Markets.
      </WorkspaceSummaryPanel>
      <WorkspaceSectionFrame className="slides-stage" eyebrow="stage" title="active frame" meta="preview">
        <div className="slides-canvas">
          <strong>Presentation</strong>
          <p>{activeSlide}</p>
          <small>
            Slide {activeSlideIndex + 1} of {slides.length} · command story
          </small>
        </div>
      </WorkspaceSectionFrame>
      <WorkspaceSectionFrame className="slides-strip-frame" eyebrow="slides" title="navigation" meta={`${slides.length} frames`}>
        <WorkspaceCatalogGrid
          className="slides-strip"
          variant="launcher"
          items={slideCards}
          ariaLabel="Slide navigation"
          onSelect={(item) => {
            const nextIndex = slides.findIndex((slide) => slide.toLowerCase() === item.id);
            if (nextIndex >= 0) {
              setActiveSlideIndex(nextIndex);
            }
          }}
        />
      </WorkspaceSectionFrame>
    </WorkspaceContentShell>
  );
}

export function ImageWidget() {
  return (
    <WorkspaceContentShell className="image-surface">
      <WorkspaceContentHeader
        eyebrow="Image workspace"
        title="preview / annotate / crop"
        metaEyebrow="asset"
        meta="drop-ready"
      />
      <WorkspaceSummaryPanel className="image-summary" title="asset staging">
        Preview assets inside the shared workspace shell before annotation tools are connected.
      </WorkspaceSummaryPanel>
      <WorkspaceSectionFrame className="image-frame-section" eyebrow="canvas" title="no asset loaded" meta="image">
        <div className="image-frame">
          <div className="image-placeholder">
            <span>no asset loaded</span>
            <small>drop / annotate / crop</small>
          </div>
        </div>
      </WorkspaceSectionFrame>
    </WorkspaceContentShell>
  );
}

export function PdfWidget() {
  return (
    <WorkspaceContentShell className="pdf-surface">
      <WorkspaceContentHeader
        eyebrow="PDF workspace"
        title="read / search / export"
        metaEyebrow="document"
        meta="page preview"
      />
      <WorkspaceSummaryPanel className="pdf-summary" title="document preview">
        Read-only page staging now follows the same header, summary, and section hierarchy as Markets.
      </WorkspaceSummaryPanel>
      <WorkspaceSectionFrame className="pdf-page-section" eyebrow="document" title="preview page" meta="pdf">
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
      </WorkspaceSectionFrame>
    </WorkspaceContentShell>
  );
}

export function AudioWidget() {
  return (
    <WorkspaceContentShell className="audio-widget-shell">
      <WorkspaceContentHeader
        eyebrow="Audio workspace"
        title="signal monitor"
        metaEyebrow="input"
        meta="12 bands"
      />
      <WorkspaceSummaryPanel className="audio-summary-panel" title="audio telemetry">
        Signal monitoring now follows the shared Markets hierarchy: title, concise status, then the active stage.
      </WorkspaceSummaryPanel>
      <WorkspaceSectionFrame className="media-widget-stage" eyebrow="spectrum" title="active waveform" meta="visualiser">
        <div className="audio-surface">
          <div className="audio-ring audio-ring-a" />
          <div className="audio-ring audio-ring-b" />
          <div className="audio-bars">
            {Array.from({ length: 12 }).map((_, index) => (
              <i key={index} style={{ height: `${36 + ((index * 11) % 54)}%` }} />
            ))}
          </div>
        </div>
      </WorkspaceSectionFrame>
    </WorkspaceContentShell>
  );
}

export function MapWidget() {
  return (
    <WorkspaceContentShell className="map-widget-shell">
      <WorkspaceContentHeader
        eyebrow="Navigation"
        title="route overview"
        metaEyebrow="waypoints"
        meta="3 markers"
      />
      <WorkspaceSummaryPanel className="map-summary-panel" title="route telemetry">
        Navigation now follows the shared Markets hierarchy: concise status first, then the active map stage.
      </WorkspaceSummaryPanel>
      <WorkspaceSectionFrame className="media-widget-stage" eyebrow="map" title="active route" meta="local grid">
        <div className="map-surface">
          <div className="map-grid" />
          <div className="map-route map-route-a" />
          <div className="map-route map-route-b" />
          <div className="map-point map-point-a" />
          <div className="map-point map-point-b" />
          <div className="map-point map-point-c" />
        </div>
      </WorkspaceSectionFrame>
    </WorkspaceContentShell>
  );
}

export function DiagramWidget() {
  return (
    <WorkspaceContentShell className="diagram-widget-shell">
      <WorkspaceContentHeader
        eyebrow="Diagram"
        title="system topology"
        metaEyebrow="nodes"
        meta="3 linked"
      />
      <WorkspaceSummaryPanel className="diagram-summary-panel" title="topology status">
        Diagram canvases share the same shell rhythm as Markets while keeping the node graph itself intact.
      </WorkspaceSummaryPanel>
      <WorkspaceSectionFrame className="media-widget-stage" eyebrow="canvas" title="dependency map" meta="flow">
        <div className="diagram-surface">
          <div className="diagram-node diagram-node-a" />
          <div className="diagram-node diagram-node-b" />
          <div className="diagram-node diagram-node-c" />
          <div className="diagram-link diagram-link-a" />
          <div className="diagram-link diagram-link-b" />
          <div className="diagram-link diagram-link-c" />
        </div>
      </WorkspaceSectionFrame>
    </WorkspaceContentShell>
  );
}

export function ProjectWidget() {
  const projectLanes = ['layout', 'assets', 'review', 'deploy'];

  return (
    <WorkspaceContentShell className="project-surface">
      <WorkspaceContentHeader
        eyebrow="Project list"
        title="tasks / backlog"
        metaEyebrow="delivery"
        meta={`${projectLanes.length} lanes`}
      />
      <WorkspaceSummaryPanel title="active build queue">
        Track delivery stages with the same compact hierarchy used by Markets.
      </WorkspaceSummaryPanel>
      <WorkspaceSectionFrame className="project-lanes" eyebrow="progress" title="current stages" meta="completion">
        <div className="project-lane-list" aria-label="Project progress lanes">
          {projectLanes.map((label, index) => (
            <div className="project-row" key={label}>
              <span>{label}</span>
              <div className="project-track" aria-label={`${label} ${50 + index * 10}% complete`}>
                <i style={{ width: `${50 + index * 10}%` }} />
              </div>
            </div>
          ))}
        </div>
      </WorkspaceSectionFrame>
    </WorkspaceContentShell>
  );
}

export function NewsWidget({
  activeGraph,
  onSelectGraph,
}: {
  activeGraph: MarketGraph;
  onSelectGraph: (graph: MarketGraph) => void;
}) {
  const newsItems = marketCategories.flatMap((category) =>
    category.graphs.map((graph) => ({
      id: graph.id,
      label: graph.label,
      note: `${graph.category} · ${graph.note}`,
      badge: graph.change,
      active: graph.id === activeGraph.id,
    })),
  );

  return (
    <WorkspaceContentShell className="news-surface">
      <WorkspaceContentHeader
        eyebrow="News feed"
        title="market pulse / watchlist"
        metaEyebrow="active"
        meta={activeGraph.ticker}
      />
      <WorkspaceSummaryPanel className="news-summary" title={activeGraph.label}>
        {activeGraph.note}. Selecting a pulse keeps the market graph in sync without borrowing the entire Markets shell wholesale.
      </WorkspaceSummaryPanel>
      <WorkspaceSectionFrame className="news-feed-section" eyebrow="feed" title="signal headlines" meta={`${newsItems.length} items`}>
        <WorkspaceCatalogGrid
          className="news-feed-grid"
          variant="market"
          ariaLabel="Market news signals"
          items={newsItems}
          onSelect={(item) => onSelectGraph(getMarketGraph(item.id))}
        />
      </WorkspaceSectionFrame>
    </WorkspaceContentShell>
  );
}

export function VideoWidget() {
  return (
    <WorkspaceContentShell className="video-widget-shell">
      <WorkspaceContentHeader
        eyebrow="Video"
        title="preview monitor"
        metaEyebrow="source"
        meta="standby"
      />
      <WorkspaceSummaryPanel className="video-summary-panel" title="preview status">
        Playback chrome now uses the shared content hierarchy before handing the remaining space to the monitor stage.
      </WorkspaceSummaryPanel>
      <WorkspaceSectionFrame className="media-widget-stage" eyebrow="playback" title="frame preview" meta="offline">
        <div className="video-surface">
          <div className="video-frame" />
          <div className="video-overlay">preview</div>
        </div>
      </WorkspaceSectionFrame>
    </WorkspaceContentShell>
  );
}

export function PreviewWidget({
  file,
  onBrowseFiles,
  onOpenPreview,
}: {
  file: LocalFileRecord | null;
  onBrowseFiles: (files: FileList | File[]) => Promise<LocalFileRecord[]>;
  onOpenPreview: (file: LocalFileRecord) => void;
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
    setStatus(`Opening ${file.previewKind} preview…`);
    setTextPreview('');

    if (file.previewKind === 'text') {
      void readLocalFileTextPreview(file.file, 16000)
        .then((content) => {
          if (cancelled) return;
          setTextPreview(content);
          setStatus(`Text preview ready · ${formatLocalFileSize(file.file.size)}`);
        })
        .catch(() => {
          if (cancelled) return;
          setTextPreview('');
          setStatus('Text preview unavailable for this file.');
        });
    } else {
      setStatus(`Ready · ${formatLocalFileSize(file.file.size)}`);
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
        <WorkspaceSummaryPanel className="preview-empty-summary" title="pick a file to inspect">
          Images, audio, video, PDFs, and text files render here. The rest will be handled with less glamour, but still gracefully.
        </WorkspaceSummaryPanel>
        <WorkspaceSectionFrame className="preview-empty-frame" eyebrow="preview stage" title="no file selected" meta="local only">
          <div className="preview-empty-state">
            <div className="preview-orb preview-orb-a" />
            <div className="preview-orb preview-orb-b" />
            <div className="preview-ring" />
            <div className="preview-scan" />
            <WorkspaceButton className="preview-empty-button" onClick={handleBrowsePreviewFiles}>
              Preview a file
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
        meta={`${file.file.type || 'unknown type'} · ${formatLocalFileSize(file.file.size)}`}
      />

      <WorkspaceSummaryPanel className="preview-file-summary" title={file.file.name}>
        {status}
      </WorkspaceSummaryPanel>

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
            <pre className="preview-media preview-media-text">{textPreview || 'Loading text preview…'}</pre>
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

export function ModelStudioWidget() {
  const simulationCards = [
    { label: 'Structural integrity', value: '92%', note: 'frame / joints / load paths' },
    { label: 'Bend response', value: '0.18 mm', note: 'deformation under torque' },
    { label: 'Stress hotspots', value: '03', note: 'redline zones and stress peaks' },
    { label: 'Heat map', value: '64°C', note: 'thermal climb under runtime load' },
  ];

  const gestureChips = ['drag', 'pinch', 'orbit', 'slice', 'measure', 'simulate'];

  return (
    <WorkspaceContentShell className="model-studio-surface">
      <WorkspaceContentHeader
        className="model-studio-head"
        eyebrow="3D asset authoring"
        title="sculpt / gesture / simulate"
        metaEyebrow="real-time engineering"
        meta="structures · bending · heat · stress"
      />
      <WorkspaceSummaryPanel className="model-studio-overview" title="creation surface">
        Designed as a fluid creation surface first, with touch, stylus, and spatial capture ready to slot in when the hardware catches up.
      </WorkspaceSummaryPanel>

      <div className="model-studio-layout">
        <WorkspaceSectionFrame className="model-studio-canvas-frame" eyebrow="model viewport" title="spatial capture rig" meta="orbit / slice">
          <div className="model-studio-canvas">
            <div className="model-studio-grid" />
            <div className="model-studio-rig">
              <div className="model-studio-shell model-studio-shell-a" />
              <div className="model-studio-shell model-studio-shell-b" />
              <div className="model-studio-shell model-studio-shell-c" />
            </div>
            <div className="model-studio-axis model-studio-axis-x" />
            <div className="model-studio-axis model-studio-axis-y" />
            <div className="model-studio-axis model-studio-axis-z" />
          </div>
        </WorkspaceSectionFrame>

        <WorkspaceSectionFrame className="model-studio-panel" eyebrow="simulation" title="engineering passes" meta={`${simulationCards.length} checks`}>
          <div className="model-studio-tools">
            {gestureChips.map((chip) => (
              <WorkspaceButton variant="compact" key={chip} className="model-studio-chip">
                {chip}
              </WorkspaceButton>
            ))}
          </div>

          <div className="model-studio-simulations">
            {simulationCards.map((card, index) => (
              <article className="model-studio-sim" key={card.label}>
                <div className="model-studio-sim-head">
                  <span>{card.label}</span>
                  <strong>{card.value}</strong>
                </div>
                <div className="model-studio-sim-bar">
                  <i style={{ width: `${58 - index * 9}%` }} />
                </div>
                <small>{card.note}</small>
              </article>
            ))}
          </div>
        </WorkspaceSectionFrame>
      </div>
    </WorkspaceContentShell>
  );
}

export function WorkflowWidget() {
  const [savedWorkflows, setSavedWorkflows] = useState<SavedWorkflow[]>(() => loadSavedWorkflows());
  const [draft, setDraft] = useState<WorkflowDraft>(() => createWorkflowDraft('workflow-studio'));
  const [newStep, setNewStep] = useState('');
  const [status, setStatus] = useState('Ready to build a workflow.');

  useEffect(() => {
    if (!saveSavedWorkflows(savedWorkflows)) {
      setStatus('Workflow library could not be saved locally.');
    }
  }, [savedWorkflows]);

  const template = getWorkflowTemplate(draft.templateId);
  const steps = getWorkflowSteps(draft);
  const selectedSkills = workflowSkills.filter((skill) => draft.skillIds.includes(skill.id));
  const selectedSkillIds = new Set(draft.skillIds);
  const canAddCustomStep = newStep.trim().length > 0;
  const svgWidth = Math.max(620, steps.length * 170);

  const selectTemplate = (templateId: string) => {
    const nextTemplate = getWorkflowTemplate(templateId);
    setDraft((current) => ({
      ...current,
      templateId: nextTemplate.id,
      name: current.name.trim() ? current.name : `${nextTemplate.title} workflow`,
      note: current.note.trim() ? current.note : nextTemplate.summary,
      skillIds: [...nextTemplate.skillIds],
    }));
    setStatus(`Loaded ${nextTemplate.title} template.`);
  };

  const toggleSkill = (skillId: string) => {
    setDraft((current) => {
      const skillSet = new Set(current.skillIds);
      if (skillSet.has(skillId)) {
        skillSet.delete(skillId);
      } else {
        skillSet.add(skillId);
      }

      return { ...current, skillIds: Array.from(skillSet) };
    });
  };

  const addCustomStep = () => {
    const trimmed = newStep.trim();
    if (!trimmed) return;

    setDraft((current) => ({ ...current, customSteps: [...current.customSteps, trimmed] }));
    setNewStep('');
    setStatus('Custom step added.');
  };

  const removeCustomStep = (stepIndex: number) => {
    const templateStepCount = template.steps.length;
    const customIndex = stepIndex - templateStepCount;
    if (customIndex < 0) return;

    setDraft((current) => ({
      ...current,
      customSteps: current.customSteps.filter((_, index) => index !== customIndex),
    }));
    setStatus('Custom step removed.');
  };

  const startNewWorkflow = () => {
    setDraft(createWorkflowDraft(template.id));
    setNewStep('');
    setStatus(`Started a new ${template.title} workflow.`);
  };

  const saveWorkflow = () => {
    const workflowId = draft.id ?? createId('workflow');
    const existing = savedWorkflows.find((item) => item.id === workflowId);
    const workflowName = draft.name.trim() || `${template.title} workflow`;
    const nextWorkflow: SavedWorkflow = {
      ...draft,
      name: workflowName,
      id: workflowId,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };

    setSavedWorkflows((current) => [nextWorkflow, ...current.filter((item) => item.id !== workflowId)].slice(0, 12));
    setDraft((current) => ({ ...current, id: workflowId, name: workflowName }));
    setStatus(`Saved ${nextWorkflow.name}.`);
  };

  const loadWorkflow = (workflow: SavedWorkflow) => {
    setDraft({
      id: workflow.id,
      name: workflow.name,
      templateId: workflow.templateId,
      note: workflow.note,
      skillIds: [...workflow.skillIds],
      customSteps: [...workflow.customSteps],
    });
    setNewStep('');
    setStatus(`Loaded ${workflow.name}.`);
  };

  const printWorkflow = () => {
    const printableDraft = { ...draft, name: draft.name.trim() || `${template.title} workflow` };
    const success = openWorkflowHandout(printableDraft);
    setStatus(success ? `Print handout opened for ${printableDraft.name}.` : 'Popup blocked. Allow popups to print or export as PDF.');
  };

  const copySteps = async () => {
    const workflowName = draft.name.trim() || `${template.title} workflow`;
    const instructions = steps.map((step, index) => `${index + 1}. ${step}`).join('\n');
    try {
      await navigator.clipboard.writeText(`${workflowName}\n\n${instructions}`);
      setStatus('Workflow instructions copied to clipboard.');
    } catch {
      setStatus('Clipboard access was unavailable.');
    }
  };

  const diagramNodes = steps.map((step, index) => {
    const x = 90 + index * 150;
    const fill = index === 0 ? '#77d1ff' : index === steps.length - 1 ? '#b4ffc2' : '#dbe7ff';

    return (
      <g key={`${step}-${index}`}>
        {index > 0 ? <line x1={x - 60} y1={96} x2={x - 30} y2={96} stroke="rgba(255,255,255,0.46)" strokeWidth="2" strokeLinecap="round" /> : null}
        <circle cx={x} cy={96} r="28" fill={fill} fillOpacity="0.22" stroke={fill} strokeOpacity="0.88" strokeWidth="2" />
        <text x={x} y={100} textAnchor="middle" fill="#f7fbff" fontSize="15" fontFamily="Inter, system-ui, sans-serif">
          {index + 1}
        </text>
        <text x={x} y={146} textAnchor="middle" fill="rgba(255,255,255,0.86)" fontSize="11" fontFamily="Inter, system-ui, sans-serif">
          {step}
        </text>
      </g>
    );
  });

  return (
    <WorkspaceContentShell className="workflow-surface">
      <WorkspaceContentHeader
        className="workflow-head"
        eyebrow="Workflow studio"
        title={draft.name}
        metaEyebrow={template.title}
        meta={`${steps.length} steps · ${selectedSkills.length} skills`}
      />
      <WorkspaceSummaryPanel className="workflow-summary" title={template.title}>
        {status}
      </WorkspaceSummaryPanel>

      <WorkspaceSectionFrame className="workflow-actions" eyebrow="workflow controls" meta="save / export / reset">
        <WorkspaceButton className="workflow-action" onClick={saveWorkflow}>
          Save workflow
        </WorkspaceButton>
        <WorkspaceButton className="workflow-action" onClick={printWorkflow}>
          Print / Save PDF
        </WorkspaceButton>
        <WorkspaceButton variant="secondary" className="workflow-action is-muted" onClick={copySteps}>
          Copy steps
        </WorkspaceButton>
        <WorkspaceButton variant="secondary" className="workflow-action is-muted" onClick={startNewWorkflow}>
          New workflow
        </WorkspaceButton>
      </WorkspaceSectionFrame>

      <div className="workflow-layout">
        <WorkspaceSectionFrame className="workflow-column workflow-library" eyebrow="Workflow library" title="templates and skills" meta="starter set">
          <WorkspaceSectionFrame className="workflow-group" eyebrow="Workflow library" title="template catalog" meta="starter templates">
            <WorkspaceCatalogGrid
              className="workflow-template-list"
              variant="market"
              ariaLabel="Workflow templates"
              items={workflowTemplates.map((item) => ({
                id: item.id,
                label: item.title,
                note: item.summary,
                badge: `${item.steps.length} steps`,
                state: `${item.skillIds.length} skills`,
                active: item.id === template.id,
              }))}
              onSelect={(item) => selectTemplate(item.id)}
            />
          </WorkspaceSectionFrame>

          <WorkspaceSectionFrame className="workflow-group" eyebrow="Skill library" title="helper skills" meta="toggle helper skills">
            <WorkspaceCatalogGrid
              className="workflow-skill-list"
              variant="market"
              ariaLabel="Workflow skills"
              items={workflowSkills.map((skill) => {
                const isSelectedSkill = selectedSkillIds.has(skill.id);

                return {
                  id: skill.id,
                  label: skill.title,
                  note: skill.summary,
                  badge: isSelectedSkill ? 'on' : 'off',
                  active: isSelectedSkill,
                };
              })}
              onSelect={(item) => toggleSkill(item.id)}
            />
          </WorkspaceSectionFrame>
        </WorkspaceSectionFrame>

        <WorkspaceSectionFrame className="workflow-column workflow-canvas" eyebrow="Workflow visualisation" title="step map" meta="step by step">
          <div className="workflow-diagram" aria-label="Workflow visualisation">
            <svg viewBox={`0 0 ${svgWidth} 180`} role="img" aria-label="Workflow diagram">
              <rect x="0" y="0" width={svgWidth} height="180" fill="transparent" />
              {diagramNodes}
            </svg>
          </div>

          <ol className="workflow-step-list" aria-label="Workflow instructions">
            {steps.map((step, index) => (
              <li className="workflow-step" key={`${step}-${index}`}>
                <span>Step {index + 1}</span>
                <strong>{step}</strong>
                {index >= template.steps.length ? (
                  <WorkspaceButton variant="compact" className="workflow-step-remove" onClick={() => removeCustomStep(index)}>
                    Remove
                  </WorkspaceButton>
                ) : null}
              </li>
            ))}
          </ol>

          <div className="workflow-status">{status}</div>
        </WorkspaceSectionFrame>

        <WorkspaceSectionFrame className="workflow-column workflow-editor" eyebrow="User workflow" title="edit and save" meta="local draft">
          <WorkspaceSectionFrame className="workflow-group" eyebrow="User workflow" meta="edit and save">
            <label className="workflow-field">
              <span>Workflow name</span>
              <input
                type="text"
                value={draft.name}
                onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                placeholder="Give the workflow a useful name"
              />
            </label>
            <label className="workflow-field">
              <span>Notes</span>
              <textarea
                value={draft.note}
                onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))}
                placeholder="What should the person or agent know before starting?"
                rows={4}
              />
            </label>
            <label className="workflow-field">
              <span>Add step</span>
              <div className="workflow-inline-input">
                <input
                  type="text"
                  value={newStep}
                  onChange={(event) => setNewStep(event.target.value)}
                  onKeyDown={(event) => event.key === 'Enter' && canAddCustomStep && addCustomStep()}
                  placeholder="Add a custom step"
                />
                <WorkspaceButton variant="secondary" className="workflow-inline-add" onClick={addCustomStep} disabled={!canAddCustomStep}>
                  Add
                </WorkspaceButton>
              </div>
            </label>
          </WorkspaceSectionFrame>

          <WorkspaceSectionFrame className="workflow-group" eyebrow="Saved workflows" meta={`${savedWorkflows.length} stored locally`}>
            <WorkspaceCatalogGrid
              className="workflow-saved-list"
              variant="market"
              ariaLabel="Saved workflows"
              items={savedWorkflows.length ? savedWorkflows.map((workflow) => ({
                id: workflow.id,
                label: workflow.name,
                note: getWorkflowTemplate(workflow.templateId).title,
                badge: `${getWorkflowSteps(workflow).length} steps`,
                state: `${workflow.skillIds.length} skills`,
                active: workflow.id === draft.id,
              })) : []}
              onSelect={(item) => {
                const workflow = savedWorkflows.find((entry) => entry.id === item.id);
                if (workflow) loadWorkflow(workflow);
              }}
            />
            {savedWorkflows.length ? null : <div className="workflow-empty">No saved workflows yet. Save one and it will stay available locally.</div>}
          </WorkspaceSectionFrame>
        </WorkspaceSectionFrame>
      </div>
    </WorkspaceContentShell>
  );
}

export function ListWidget() {
  const rows = ['inbox', 'next action', 'blocked', 'archive'].map((item) => ({
    id: item,
    primary: item,
    secondary: 'open',
  }));

  return (
    <WorkspaceContentShell className="list-surface">
      <WorkspaceContentHeader
        eyebrow="Project list"
        title="tasks / backlog"
        metaEyebrow="queue"
        meta={`${rows.length} lanes`}
      />
      <WorkspaceSummaryPanel className="list-summary" title="active task lanes">
        Task rows now sit beneath the same header and summary tier used by Markets, rather than jumping straight into bespoke list chrome.
      </WorkspaceSummaryPanel>
      <WorkspaceSectionFrame className="list-section" eyebrow="items" title="current queue" meta="open states">
        <WorkspaceRowList className="list-rows" rows={rows} ariaLabel="Workspace list" />
      </WorkspaceSectionFrame>
    </WorkspaceContentShell>
  );
}

export function ScheduleWidget() {
  const slots = [
    { time: '07:30', label: 'Morning shift', note: 'brief / hydrate / review' },
    { time: '12:15', label: 'Project block', note: 'deep work / build' },
    { time: '16:30', label: 'Check-in', note: 'status / approvals' },
    { time: '21:00', label: 'Wrap-up', note: 'handoff / tidy / plan' },
  ];

  const rows = slots.map((slot) => ({
    id: slot.time,
    primary: slot.time,
    secondary: slot.label,
    meta: slot.note,
  }));

  return (
    <WorkspaceContentShell className="schedule-surface">
      <WorkspaceContentHeader
        eyebrow="Schedule"
        title="today / shift rhythm"
        metaEyebrow="timeline"
        meta={`${rows.length} blocks`}
      />
      <WorkspaceSummaryPanel className="schedule-summary" title="active day plan">
        Shift rhythm, check-ins, and project blocks now share the same header-summary-section cadence as the Markets shell.
      </WorkspaceSummaryPanel>
      <WorkspaceSectionFrame className="schedule-section" eyebrow="agenda" title="active day plan" meta="local time">
        <WorkspaceRowList className="schedule-rows" rows={rows} ariaLabel="Today schedule" />
      </WorkspaceSectionFrame>
    </WorkspaceContentShell>
  );
}

type LauncherWidgetProps = {
  onLaunchWorkspaceWidget: (kind: WorkspaceWidget['kind']) => void;
  workspaceWidgets: WorkspaceWidget[];
};

export function LauncherWidget({ onLaunchWorkspaceWidget, workspaceWidgets }: LauncherWidgetProps) {
  const [desktopCommand, setDesktopCommand] = useState('');
  const [desktopApps, setDesktopApps] = useState<DesktopAppRecord[]>(defaultDesktopApps);

  const workspaceApps = getWorkspaceLauncherEntries();

  const openInstalledApp = () => {
    const nextName = desktopCommand.trim();
    if (!nextName) return;
    setDesktopApps((current) => rememberDesktopApp(current, nextName));
    setDesktopCommand('');
  };

  const recallInstalledApp = (app: DesktopAppRecord) => {
    setDesktopCommand(app.name);
    setDesktopApps((current) => rememberDesktopApp(current, app.name, { note: app.note }));
  };

  const getAppState = (kind: WorkspaceWidget['kind']) => {
    const widget = workspaceWidgets.find((item) => item.kind === kind);
    if (!widget) return 'closed';
    return widget.open ? 'open' : 'closed';
  };

  const workspaceCards = workspaceApps.map((app) => {
    const state = getAppState(app.kind);

    return {
      id: app.kind,
      label: getWidgetLabel(app.kind),
      note: state === 'open' ? 'open · double-click to focus' : 'double-click to open',
      badge: state,
      active: state === 'open',
      state,
    };
  });

  return (
    <WorkspaceContentShell className="launcher-surface">
      <WorkspaceContentHeader
        className="launcher-head"
        eyebrow="Workspace launcher"
        title="open installed apps into the workspace"
        metaEyebrow="command bridge"
        meta="launch / focus / stay in the workspace"
      />

      <WorkspaceSummaryPanel className="launcher-summary-panel" title="workspace hooks">
        Open or focus widgets in the workspace, with external apps routed through the bridge rather than a separate browser tantrum.
      </WorkspaceSummaryPanel>

      <WorkspaceSectionFrame className="launcher-desktop-section" eyebrow="desktop bridge" meta="installed apps and shortcuts">
        <DesktopBridgePanel
          eyebrow="installed apps"
          title="load installed apps into memory"
          description="Command line stays. The bridge now lives beside the workspace launcher rather than impersonating a separate universe."
          inputLabel="Installed app or command"
          inputValue={desktopCommand}
          inputPlaceholder="e.g. explorer.exe, obsidian, notepad.exe"
          submitLabel="Open installed app"
          apps={desktopApps}
          appsLabel="installed app list"
          onChangeInput={setDesktopCommand}
          onSubmit={openInstalledApp}
          onSelectApp={recallInstalledApp}
        >
          <WorkspaceCatalogGrid
            className="launcher-grid"
            variant="launcher"
            ariaLabel="Workspace launch shortcuts"
            items={workspaceCards}
            onDoubleSelect={(item) => {
              if (isWorkspaceWidgetKind(item.id)) {
                onLaunchWorkspaceWidget(item.id);
              }
            }}
          />
        </DesktopBridgePanel>
      </WorkspaceSectionFrame>
    </WorkspaceContentShell>
  );
}

export function BrowserWidget() {
  const [url, setUrl] = useState('https://example.org');
  const [frameUrl, setFrameUrl] = useState(url);

  const submitUrl = () => {
    let next = url.trim();
    if (!next) return;
    if (!/^https?:\/\//i.test(next)) {
      next = `https://${next.replace(/^data:/i, '')}`;
    }
    setFrameUrl(next);
    setUrl(next);
  };

  return (
    <WorkspaceContentShell className="browser-surface">
      <WorkspaceContentHeader
        className="browser-head"
        eyebrow="Browser"
        title="embedded web preview"
        metaEyebrow="active URL"
        meta={frameUrl.replace(/^https?:\/\//i, '')}
      />

      <WorkspaceSummaryPanel className="browser-summary-panel" title="embedded preview">
        Address controls and bookmarked pages now sit beneath the same status tier as Markets, while the iframe remains contained in the browser stage.
      </WorkspaceSummaryPanel>

      <WorkspaceSectionFrame className="browser-address-section" eyebrow="address" title="navigation controls" meta="URL / bookmarks">
        <div className="browser-bar">
          <input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && submitUrl()}
            aria-label="Browser URL"
            placeholder="Enter a website URL"
          />
          <WorkspaceButton className="browser-go-button" onClick={submitUrl}>Go</WorkspaceButton>
        </div>
        <WorkspaceCatalogGrid
          className="browser-bookmarks"
          variant="launcher"
          ariaLabel="Browser bookmarks"
          items={['https://example.org', 'https://developer.mozilla.org', 'https://news.ycombinator.com'].map((bookmark) => ({
            id: bookmark,
            label: bookmark.replace('https://', ''),
            note: 'bookmark',
          }))}
          onSelect={(item) => { setUrl(item.id); setFrameUrl(item.id); }}
        />
      </WorkspaceSectionFrame>

      <WorkspaceSectionFrame className="browser-frame-section" eyebrow="preview" title="remote page" meta="iframe">
        <iframe title="Browser preview" src={frameUrl} className="browser-frame" />
      </WorkspaceSectionFrame>
    </WorkspaceContentShell>
  );
}

type LiveTvSource = {
  name: string;
  badge: string;
  description: string;
  url: string;
  streamType: 'hls' | 'mp4';
};

const liveTvSources: LiveTvSource[] = [
  {
    name: 'Home tuner',
    badge: 'LAN',
    description: 'your local internet TV feed',
    url: 'http://192.168.1.50/live.m3u8',
    streamType: 'hls',
  },
  {
    name: 'Mux demo',
    badge: 'DEMO',
    description: 'public HLS test stream',
    url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    streamType: 'hls',
  },
  {
    name: 'Fallback clip',
    badge: 'MP4',
    description: 'basic playback fallback',
    url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    streamType: 'mp4',
  },
];

const defaultLiveTvSource = liveTvSources[0] ?? {
  name: 'Fallback clip',
  badge: 'MP4',
  description: 'basic playback fallback',
  url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
  streamType: 'mp4',
};

export function LiveTvWidget() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<{ destroy: () => void } | null>(null);
  const [draftUrl, setDraftUrl] = useState(defaultLiveTvSource.url);
  const [activeSource, setActiveSource] = useState<LiveTvSource>(defaultLiveTvSource);
  const [status, setStatus] = useState('Ready');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const video = videoRef.current;
    if (!video) return;

    const cleanupPlayer = () => {
      hlsRef.current?.destroy();
      hlsRef.current = null;
      video.pause();
      video.removeAttribute('src');
      video.load();
    };

    const source = activeSource;
    const sourceUrl = source.url.trim();
    if (!sourceUrl) {
      setStatus('No stream URL loaded');
      return;
    }

    setIsLoading(true);
    setStatus(`Tuning ${source.name}`);
    cleanupPlayer();

    const finishReady = () => {
      if (cancelled) return;
      setIsLoading(false);
      setStatus(`Live on ${source.name}`);
      void video.play().catch(() => undefined);
    };

    const attachDirectSource = () => {
      video.src = sourceUrl;
      video.load();
      finishReady();
    };

    const looksLikeHls = source.streamType === 'hls' || /\.m3u8($|\?)/i.test(sourceUrl);
    if (!looksLikeHls) {
      attachDirectSource();
      return () => {
        cancelled = true;
        cleanupPlayer();
      };
    }

    const canPlayHlsNatively = Boolean(video.canPlayType('application/vnd.apple.mpegurl'));
    if (canPlayHlsNatively) {
      attachDirectSource();
      return () => {
        cancelled = true;
        cleanupPlayer();
      };
    }

    void import('hls.js')
      .then(({ default: Hls }) => {
        if (cancelled) return;
        if (!Hls.isSupported()) {
          setIsLoading(false);
          setStatus('This browser cannot play HLS streams');
          return;
        }

        const player = new Hls({ lowLatencyMode: true, enableWorker: true });
        hlsRef.current = player;
        player.attachMedia(video);
        player.loadSource(sourceUrl);
        player.on(Hls.Events.MANIFEST_PARSED, () => finishReady());
        player.on(Hls.Events.ERROR, (_, data) => {
          if (cancelled) return;
          setIsLoading(false);
          setStatus(`Stream issue on ${source.name}: ${data?.details ?? 'unknown error'}`);
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setIsLoading(false);
        setStatus(`Failed to load HLS engine: ${error instanceof Error ? error.message : 'unknown error'}`);
      });

    return () => {
      cancelled = true;
      cleanupPlayer();
    };
  }, [activeSource]);

  const tuneCustomFeed = () => {
    const nextUrl = draftUrl.trim();
    if (!nextUrl) return;

    const isHlsFeed = /\.m3u8($|\?)/i.test(nextUrl);

    setActiveSource({
      name: 'Custom feed',
      badge: isHlsFeed ? 'HLS' : 'URL',
      description: 'your chosen internet TV source',
      url: nextUrl,
      streamType: isHlsFeed ? 'hls' : 'mp4',
    });
  };

  return (
    <WorkspaceContentShell className="live-tv-surface">
      <WorkspaceContentHeader
        eyebrow="Live TV"
        title={activeSource.name}
        metaEyebrow={isLoading ? 'tuning' : 'on air'}
        meta={status}
      />

      <WorkspaceSummaryPanel className="live-tv-status-panel" title={activeSource.description}>
        Internet TV playback stays inside the shared workspace shell, with source presets and custom feeds kept as local widget controls.
      </WorkspaceSummaryPanel>

      <WorkspaceSectionFrame className="live-tv-source-section" eyebrow="sources" title="channel presets" meta={`${liveTvSources.length} feeds`}>
        <WorkspaceCatalogGrid
          className="live-tv-preset-list"
          variant="live-tv"
          ariaLabel="Live TV sources"
          items={liveTvSources.map((source) => ({
            id: source.name,
            label: source.name,
            note: source.description,
            badge: source.badge,
            active: source.name === activeSource.name,
            state: source.streamType,
          }))}
          onSelect={(item) => {
            const source = liveTvSources.find((candidate) => candidate.name === item.id) ?? defaultLiveTvSource;
            setDraftUrl(source.url);
            setActiveSource(source);
          }}
        />
      </WorkspaceSectionFrame>

      <WorkspaceSectionFrame className="live-tv-controls-section" eyebrow="stream" title="custom feed" meta="HLS / MP4">
        <label className="live-tv-input">
          <span>Channel or stream URL</span>
          <input
            type="text"
            value={draftUrl}
            onChange={(event) => setDraftUrl(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && tuneCustomFeed()}
            placeholder="Paste an official HLS / MP4 source"
          />
        </label>

        <div className="live-tv-actions">
          <WorkspaceButton className="live-tv-tune-button" onClick={tuneCustomFeed}>
            Tune feed
          </WorkspaceButton>
          <small>Best with official HLS (.m3u8) feeds from your provider or home tuner.</small>
        </div>
      </WorkspaceSectionFrame>

      <WorkspaceSectionFrame className="live-tv-player-section" eyebrow="playback" title="active stream" meta={activeSource.streamType.toUpperCase()}>
        <video ref={videoRef} className="live-tv-frame" controls autoPlay playsInline preload="metadata" />
      </WorkspaceSectionFrame>
    </WorkspaceContentShell>
  );
}

export function FileExplorerWidget({
  files,
  activeFileId,
  selectedFileId,
  folderEntries,
  folderPath,
  canBrowseFolder,
  onBrowseFiles,
  onBrowseFolder,
  onOpenPreview,
  onSelectFile,
  onClearFiles,
}: {
  files: LocalFileRecord[];
  activeFileId: string | null;
  selectedFileId: string | null;
  folderEntries: LocalFolderEntry[];
  folderPath: string | null;
  canBrowseFolder: boolean;
  onBrowseFiles: (files: FileList | File[]) => Promise<LocalFileRecord[]>;
  onBrowseFolder: () => void;
  onOpenPreview: (file: LocalFileRecord) => void;
  onSelectFile: (id: string | null) => void;
  onClearFiles: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const activeFile = files.find((record) => record.id === activeFileId) ?? null;
  const hasRealFolderEntries = folderEntries.length > 0;
  const folderTreeEntries: LocalFolderEntry[] = hasRealFolderEntries
    ? folderEntries
    : files.length
      ? files.map((record) => ({
          id: record.id,
          name: record.file.name,
          path: record.path,
          kind: 'file' as const,
          depth: 0,
          file: record.file,
        }))
      : [
          {
            id: 'general-use-folder',
            name: generalUseFolderLabel,
            path: generalUseFolderLabel,
            kind: 'directory' as const,
            depth: 0,
          },
        ];
  const visibleFolderPath = folderPath ?? generalUseFolderLabel;
  const loadedEntryCount = hasRealFolderEntries ? folderEntries.length : files.length;
  const selectedCountLabel = `${files.length} ${files.length === 1 ? 'item' : 'items'} loaded`;
  const explorerStatusLabel = activeFile
    ? `Previewing ${activeFile.path}`
    : folderEntries.length
      ? `Folder: ${visibleFolderPath}`
      : 'General use folder ready';
  const getFolderEntrySelectionId = (entry: LocalFolderEntry) => (entry.file ? createLocalFileRecord(entry.file).id : entry.id);

  const folderCatalogItems = folderTreeEntries.map((entry) => {
    const selectionId = getFolderEntrySelectionId(entry);

    return {
      id: selectionId,
      label: entry.path,
      note: entry.file ? `${entry.kind} · ${formatLocalFileSize(entry.file.size)}` : `${entry.kind} · no file access`,
      badge: entry.depth > 0 ? `depth ${entry.depth}` : entry.kind,
      active: selectionId === selectedFileId || selectionId === activeFileId,
      state: entry.kind,
    };
  });

  const selectedFileCatalogItems = files.map((record) => ({
    id: record.id,
    label: record.path,
    note: `${record.previewKind} · ${record.file.type || 'unknown type'}`,
    badge: formatLocalFileSize(record.file.size),
    active: record.id === selectedFileId || record.id === activeFileId,
    state: record.previewKind,
  }));

  const handleBrowseFilesClick = () => {
    fileInputRef.current?.click();
  };

  const handleBrowseFolderClick = () => {
    void onBrowseFolder();
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    void onBrowseFiles(selectedFiles);
    event.target.value = '';
  };

  const handleFolderSelect = (entryId: string) => {
    const entry = folderTreeEntries.find((candidate) => getFolderEntrySelectionId(candidate) === entryId);
    if (!entry?.file) return;

    const fileRecord = createLocalFileRecord(entry.file);
    if (selectedFileId === fileRecord.id || activeFileId === fileRecord.id) {
      void onOpenPreview(fileRecord);
      return;
    }

    void onBrowseFiles([entry.file]);
    onSelectFile(fileRecord.id);
  };

  const handleSelectedFileSelect = (fileId: string) => {
    const record = files.find((candidate) => candidate.id === fileId);
    if (!record) return;

    if (selectedFileId === record.id || activeFileId === record.id) {
      void onOpenPreview(record);
      return;
    }

    onSelectFile(record.id);
  };

  return (
    <WorkspaceContentShell className="file-explorer-surface">
      <WorkspaceContentHeader
        className="file-explorer-head"
        eyebrow="Local file browser"
        title="Choose files or folders from this PC."
        metaEyebrow={selectedCountLabel}
        meta={explorerStatusLabel}
      />

      <WorkspaceSummaryPanel className="file-explorer-summary" title={loadedEntryCount ? `${loadedEntryCount} ${loadedEntryCount === 1 ? 'entry' : 'entries'}` : 'No entries loaded'}>
        Single-click selects · click again opens preview.
      </WorkspaceSummaryPanel>

      <WorkspaceSectionFrame className="file-explorer-toolbar-frame" eyebrow="file controls" title="local intake" meta="browse / clear">
        <div className="file-explorer-toolbar">
          <WorkspaceButton onClick={handleBrowseFilesClick}>
            Browse items
          </WorkspaceButton>
          <WorkspaceButton
            variant="secondary"
            onClick={handleBrowseFolderClick}
            disabled={!canBrowseFolder}
            title={canBrowseFolder ? 'Open a general-use folder picker' : 'Folder picker is not available in this browser'}
          >
            Open folder
          </WorkspaceButton>
          <WorkspaceButton variant="secondary" onClick={onClearFiles} disabled={!files.length && !folderEntries.length}>
            Clear loaded files
          </WorkspaceButton>
          <input
            ref={fileInputRef}
            className="file-explorer-input"
            type="file"
            multiple
            aria-hidden="true"
            tabIndex={-1}
            onChange={handleFileChange}
          />
        </div>
      </WorkspaceSectionFrame>

      <div className="file-explorer-body">
        {hasRealFolderEntries || files.length ? (
          <>
            <WorkspaceSectionFrame className="file-explorer-folder-tree" eyebrow={hasRealFolderEntries ? 'Folder tree' : 'Selected files'} meta={`${folderTreeEntries.length} items · depth ${Math.max(...folderTreeEntries.map((entry) => entry.depth), 0)}`}>
              <WorkspaceCatalogGrid
                className="file-explorer-catalog file-explorer-folder-catalog"
                variant="desktop"
                ariaLabel={hasRealFolderEntries ? 'Folder tree' : 'Selected files'}
                items={folderCatalogItems}
                onSelect={(item) => handleFolderSelect(item.id)}
              />
            </WorkspaceSectionFrame>

            {hasRealFolderEntries && files.length ? (
              <WorkspaceSectionFrame className="file-explorer-selection-frame" eyebrow="Selected local files" meta={`${files.length} item${files.length === 1 ? '' : 's'}`}>
                <WorkspaceCatalogGrid
                  className="file-explorer-catalog file-explorer-selection-catalog"
                  variant="desktop"
                  ariaLabel="Selected local files"
                  items={selectedFileCatalogItems}
                  onSelect={(item) => handleSelectedFileSelect(item.id)}
                />
              </WorkspaceSectionFrame>
            ) : null}
          </>
        ) : (
          <WorkspaceSummaryPanel className="file-explorer-empty-panel" title="General use folder ready.">
            Select files or open a folder from your PC, then click once to select an item and click it again to open it in the preview panel.
          </WorkspaceSummaryPanel>
        )}
      </div>
    </WorkspaceContentShell>
  );
}


export function NativeAppWidget() {
  const [desktopCommand, setDesktopCommand] = useState('');
  const [apps, setApps] = useState<DesktopAppRecord[]>(defaultDesktopApps);

  const openInstalledApp = () => {
    const nextName = desktopCommand.trim();
    if (!nextName) return;
    setApps((current) => rememberDesktopApp(current, nextName));
    setDesktopCommand('');
  };

  const recallInstalledApp = (app: DesktopAppRecord) => {
    setDesktopCommand(app.name);
    setApps((current) => rememberDesktopApp(current, app.name, { note: app.note }));
  };

  return (
    <WorkspaceContentShell className="native-app-surface">
      <WorkspaceContentHeader
        eyebrow="Desktop bridge"
        title="open installed app / external window"
        metaEyebrow="local"
        meta="installed apps"
      />

      <WorkspaceSummaryPanel className="native-app-summary" title="bridge status">
        Browser containment remains intact; operating-system ambitions are routed through the external app bridge.
      </WorkspaceSummaryPanel>

      <WorkspaceSectionFrame className="native-app-bridge-section" eyebrow="desktop controls" title="app command" meta={`${apps.length} remembered`}>
        <DesktopBridgePanel
          eyebrow="desktop bridge"
          title="open installed app / external window"
          description="Bridge installed apps and external windows without pretending the browser can do an operating system’s job on its own."
          inputLabel="App or command"
          inputValue={desktopCommand}
          inputPlaceholder="e.g. obsidian, explorer.exe, notepad.exe"
          submitLabel="Open app"
          apps={apps}
          onChangeInput={setDesktopCommand}
          onSubmit={openInstalledApp}
          onSelectApp={recallInstalledApp}
          className="native-app-bridge"
        />
      </WorkspaceSectionFrame>
    </WorkspaceContentShell>
  );
}


export function WindowManagerWidget({
  widgets,
  onFocusWidget,
  onCloseWidget,
}: {
  widgets: WorkspaceWidget[];
  onFocusWidget: (id: string) => void;
  onCloseWidget: (id: string) => void;
}) {
  const openWidgets = [...widgets]
    .filter((widget) => widget.open)
    .sort((left, right) => right.zIndex - left.zIndex);

  return (
    <WorkspaceContentShell className="window-manager-surface">
      <WorkspaceContentHeader
        eyebrow="Window registry"
        title="Open windows and pinned surfaces"
        meta={`${openWidgets.length} open · ${widgets.length} total`}
      />
      <WorkspaceSummaryPanel className="window-manager-note" title="window controls">
        Open surfaces stay listed here. Pinned windows cannot be closed.
      </WorkspaceSummaryPanel>
      <WorkspaceSectionFrame className="window-manager-list-frame" eyebrow="registry" title="open surfaces" meta={`${openWidgets.length} active`}>
        {openWidgets.length > 0 ? (
          <WorkspaceActionRowList
            className="window-manager-list"
            ariaLabel="Open widgets"
            rows={openWidgets.map((widget) => ({
              id: widget.id,
              primary: widget.title,
              secondary: widget.kind,
              meta: `z${widget.zIndex}${widget.pinned ? ' · pinned' : ''}`,
              pinned: widget.pinned,
            }))}
            onFocusRow={onFocusWidget}
            onCloseRow={onCloseWidget}
          />
        ) : (
          <p className="window-manager-empty">No windows are open. Remarkably, the machine is being tidy on its own.</p>
        )}
      </WorkspaceSectionFrame>
    </WorkspaceContentShell>
  );
}

