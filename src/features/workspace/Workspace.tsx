import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, ChangeEvent } from 'react';

import { StatusChip } from '../../components/ui/StatusChip';
import { DesktopBridgePanel, WorkspaceActionRowList, WorkspaceButton, WorkspaceCatalogGrid, WorkspaceContentHeader, WorkspaceContentShell, WorkspaceMetricGrid, WorkspaceRowList, WorkspaceSectionFrame, WorkspaceSummaryPanel } from './workspaceBlocks';
import { WorkspaceAtmosphere, WorkspaceCanvas } from './WorkspaceCanvas';
import type { ResizeEdge } from './WorkspaceResizeHandles';
import { WorkspaceWindow } from './WorkspaceWindow';
import { defaultDesktopApps, rememberDesktopApp, type DesktopAppRecord } from './workspaceDesktopApps';
import type { WorkspaceWidget } from './workspaceTypes';
import { calculateCenteredWidgetPosition, calculatePartiallyOffscreenDragPosition } from './workspaceGeometry';
import { createLocalFileObjectUrl, createLocalFileRecord, clearPersistedLocalFiles, formatLocalFileSize, generalUseFolderLabel, measureImageDimensions, readFolderEntries, readLocalFileTextPreview, readPersistedLocalFiles, revokeLocalFileObjectUrl, writePersistedLocalFiles, type LocalFileRecord, type LocalFolderEntry, type LocalImageDimensions, type ShowDirectoryPickerFn } from './workspaceLocalFiles';
import { clampNumber, clearStoredWidgetState, loadStoredWidgetState, saveStoredWidgetState } from './workspaceStorage';
import { getFocusedWidget, getWidgetLabel, getWorkspaceLauncherEntries, launchableWindowKinds, widgetBlueprints, widgetPresets } from './workspaceWidgetCatalog';
import { createWorkflowDraft, getWorkflowSteps, getWorkflowTemplate, loadSavedWorkflows, openWorkflowHandout, saveSavedWorkflows, workflowSkills, workflowTemplates, type SavedWorkflow, type WorkflowDraft } from './workflowStudioModel';
import { buildPanelWindowUrl, buildWorkspaceHubUrl } from './workspacePanelRouting';
import { VisualLab } from '../visual-lab/VisualLab';
import './workspace.css';

const defaultOpenKinds = new Set<WorkspaceWidget['kind']>([
  'overview',
  'graph',
  'trading-graph',
  'browser',
  'schedule',
  'launcher',
  'file-explorer',
  'sheet',
]);

const initialWidgetState = widgetPresets.map((widget) => ({
  ...widget,
  open: defaultOpenKinds.has(widget.kind),
}));

function createInitialWidgetState() {
  return initialWidgetState.map((widget) => ({ ...widget }));
}

function createCompactLayout(boundsWidth: number, boundsHeight: number): WorkspaceWidget[] {
  const isNarrow = boundsWidth < 760;
  const stackWidth = isNarrow
    ? Math.max(260, Math.min(boundsWidth - 16, 360))
    : Math.max(260, Math.min(boundsWidth - 16, 420));
  const totalWidgets = widgetPresets.length;
  const openCount = isNarrow ? 1 : boundsHeight < 760 ? 2 : 3;
  const topInset = isNarrow ? 52 : 58;
  const bottomInset = 12;
  const gap = isNarrow ? 6 : 8;
  const closedHeight = isNarrow ? 40 : 44;

  const availableHeight = Math.max(0, boundsHeight - topInset - bottomInset - gap * (totalWidgets - 1));
  const openHeightBudget = Math.max(0, availableHeight - closedHeight * (totalWidgets - openCount));
  const openHeight = Math.max(120, Math.min(isNarrow ? 220 : 160, Math.floor(openHeightBudget / openCount)));

  const openHeights =
    openCount === 1
      ? [Math.max(140, openHeight)]
      : openCount === 2
        ? [openHeight + 10, Math.max(112, openHeight - 6)]
        : [openHeight + 12, Math.max(112, openHeight + 2), Math.max(112, openHeight - 10)];

  let nextY = topInset;

  return widgetPresets.map((widget, index) => {
    const isOpen = index < openCount;
    const height = isOpen ? openHeights[index] ?? openHeight : closedHeight;
    const nextWidget = {
      ...widget,
      x: 8,
      y: nextY,
      width: Math.max(widget.minWidth, stackWidth),
      height,
      zIndex: totalWidgets - index,
      open: isOpen,
    };

    nextY += height + gap;
    return nextWidget;
  });
}

type InteractionState = {
  id: string;
  mode: 'drag' | 'resize';
  edge?: ResizeEdge;
  pointerId: number;
  startX: number;
  startY: number;
  startLeft: number;
  startTop: number;
  startWidth: number;
  startHeight: number;
};

function OverviewWidget() {
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
      <WorkspaceSectionFrame className="overview-dashboard" eyebrow="telemetry" title="command summary" meta={`${stats.length} signals`}>
        <div className="widget-grid">
          <div className="stats-arc" />
          <WorkspaceMetricGrid metrics={stats} />
        </div>
      </WorkspaceSectionFrame>
    </WorkspaceContentShell>
  );
}

function GraphWidget() {
  return (
    <WorkspaceContentShell className="graph-surface">
      <WorkspaceContentHeader
        eyebrow="Telemetry graph"
        title="signal trace / trend line"
        metaEyebrow="scope"
        meta="3 channels"
      />
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

type MarketGraph = {
  id: string;
  categoryId: string;
  category: string;
  label: string;
  ticker: string;
  change: string;
  horizon: string;
  note: string;
};

type MarketCategory = {
  id: string;
  label: string;
  summary: string;
  graphs: MarketGraph[];
};

const marketCategories: MarketCategory[] = [
  {
    id: 'equities',
    label: 'Equities',
    summary: 'indices and large caps',
    graphs: [
      { id: 'spx', categoryId: 'equities', category: 'Equities', label: 'S&P 500', ticker: 'SPX', change: '+0.8%', horizon: '1D / 4H', note: 'broad market benchmark and risk appetite' },
      { id: 'ndx', categoryId: 'equities', category: 'Equities', label: 'Nasdaq 100', ticker: 'NDX', change: '+1.4%', horizon: '1D / 1H', note: 'tech-heavy momentum and volatility' },
      { id: 'ukx', categoryId: 'equities', category: 'Equities', label: 'FTSE 100', ticker: 'UKX', change: '+0.3%', horizon: '1D / 1H', note: 'steady large-cap index with defensive tilt' },
    ],
  },
  {
    id: 'crypto',
    label: 'Crypto',
    summary: 'high beta and weekend noise',
    graphs: [
      { id: 'btc', categoryId: 'crypto', category: 'Crypto', label: 'Bitcoin', ticker: 'BTC/USD', change: '+2.1%', horizon: '1D / 30M', note: 'primary crypto risk gauge' },
      { id: 'eth', categoryId: 'crypto', category: 'Crypto', label: 'Ethereum', ticker: 'ETH/USD', change: '+1.6%', horizon: '1D / 30M', note: 'smart contract network and beta proxy' },
      { id: 'sol', categoryId: 'crypto', category: 'Crypto', label: 'Solana', ticker: 'SOL/USD', change: '+3.4%', horizon: '1D / 15M', note: 'fast moving altcoin trend tracker' },
    ],
  },
  {
    id: 'fx',
    label: 'FX',
    summary: 'currency crosses and macro drift',
    graphs: [
      { id: 'eurusd', categoryId: 'fx', category: 'FX', label: 'Euro / Dollar', ticker: 'EUR/USD', change: '-0.2%', horizon: '1D / 1H', note: 'core reserve currency cross' },
      { id: 'gbpusd', categoryId: 'fx', category: 'FX', label: 'Pound / Dollar', ticker: 'GBP/USD', change: '+0.1%', horizon: '1D / 1H', note: 'UK rate sensitivity and risk tone' },
      { id: 'usdjpy', categoryId: 'fx', category: 'FX', label: 'Dollar / Yen', ticker: 'USD/JPY', change: '+0.6%', horizon: '1D / 1H', note: 'carry, intervention risk, and funding stress' },
    ],
  },
  {
    id: 'commodities',
    label: 'Commodities',
    summary: 'energy, metals, and inflation pressure',
    graphs: [
      { id: 'gold', categoryId: 'commodities', category: 'Commodities', label: 'Gold', ticker: 'XAU/USD', change: '+0.4%', horizon: '1D / 4H', note: 'safe haven and real-rate mirror' },
      { id: 'brent', categoryId: 'commodities', category: 'Commodities', label: 'Brent crude', ticker: 'BRENT', change: '-0.7%', horizon: '1D / 1H', note: 'energy pulse and inflation input' },
      { id: 'silver', categoryId: 'commodities', category: 'Commodities', label: 'Silver', ticker: 'XAG/USD', change: '+0.9%', horizon: '1D / 4H', note: 'industrial demand and precious metal mix' },
    ],
  },
];

const marketGraphIndex = new Map(marketCategories.flatMap((category) => category.graphs.map((graph) => [graph.id, graph] as const)));
const defaultMarketGraph = marketCategories[0]?.graphs[0] ?? {
  id: 'spx',
  categoryId: 'equities',
  category: 'Equities',
  label: 'S&P 500',
  ticker: 'SPX',
  change: '+0.8%',
  horizon: '1D / 4H',
  note: 'broad market benchmark and risk appetite',
};

function getMarketGraph(graphId: string) {
  return marketGraphIndex.get(graphId) ?? defaultMarketGraph;
}

function TradingGraphWidget({ graph }: { graph: MarketGraph }) {
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
      <WorkspaceMetricGrid className="trading-graph-summary" metrics={summary} />
      <div className="trading-graph-body">
        <div className="trading-graph-grid" />
        <div className="trading-graph-line trading-a" />
        <div className="trading-graph-line trading-b" />
        <div className="trading-graph-volume" />
      </div>
      <WorkspaceSummaryPanel title="graph routing">
        Selecting a market item in the markets widget brings this graph forward and swaps the market context. No ceremony, just the useful bit.
      </WorkspaceSummaryPanel>
    </WorkspaceContentShell>
  );
}

function MarketsWidget({
  activeGraph,
  onSelectGraph,
}: {
  activeGraph: MarketGraph;
  onSelectGraph: (graph: MarketGraph) => void;
}) {
  return (
    <WorkspaceContentShell className="markets-surface">
      <WorkspaceContentHeader
        className="markets-head"
        eyebrow="Markets"
        title="custom graph library / watchlist"
        metaEyebrow={activeGraph.category}
        meta={activeGraph.ticker}
      />
      <WorkspaceSummaryPanel className="markets-summary" title={activeGraph.label}>
        {activeGraph.note}
      </WorkspaceSummaryPanel>
      <div className="markets-categories">
        {marketCategories.map((category) => (
          <WorkspaceSectionFrame
            className="market-category"
            key={category.id}
            eyebrow={category.label}
            title={category.summary}
            meta={`${category.graphs.length} graphs`}
          >
            <WorkspaceCatalogGrid
              className="market-graph-list"
              variant="market"
              ariaLabel={`${category.label} graphs`}
              items={category.graphs.map((graph) => ({
                id: graph.id,
                label: graph.label,
                note: `${graph.horizon} · ${graph.change}`,
                badge: graph.ticker,
                active: graph.id === activeGraph.id,
                state: graph.category,
              }))}
              onSelect={(item) => {
                const graph = getMarketGraph(item.id);
                onSelectGraph(graph);
              }}
            />
          </WorkspaceSectionFrame>
        ))}
      </div>
    </WorkspaceContentShell>
  );
}

function SpreadsheetWidget() {
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

function DocsWidget() {
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

function SlidesWidget() {
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

function ImageWidget() {
  return (
    <WorkspaceContentShell className="image-surface">
      <WorkspaceContentHeader
        eyebrow="Image workspace"
        title="preview / annotate / crop"
        metaEyebrow="asset"
        meta="drop-ready"
      />
      <WorkspaceSectionFrame className="image-frame-section" eyebrow="canvas" title="no asset loaded" meta="image">
        <div className="image-frame">
          <div className="image-placeholder">
            <span>no asset loaded</span>
            <small>drop / annotate / crop</small>
          </div>
        </div>
      </WorkspaceSectionFrame>
      <WorkspaceSummaryPanel className="image-footer" title="image controls">
        Preview assets inside the shared workspace shell before annotation tools are connected.
      </WorkspaceSummaryPanel>
    </WorkspaceContentShell>
  );
}

function PdfWidget() {
  return (
    <WorkspaceContentShell className="pdf-surface">
      <WorkspaceContentHeader
        eyebrow="PDF workspace"
        title="read / search / export"
        metaEyebrow="document"
        meta="page preview"
      />
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

function AudioWidget() {
  return (
    <WorkspaceContentShell className="audio-widget-shell">
      <WorkspaceContentHeader
        eyebrow="Audio workspace"
        title="signal monitor"
        metaEyebrow="input"
        meta="12 bands"
      />
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

function MapWidget() {
  return (
    <WorkspaceContentShell className="map-widget-shell">
      <WorkspaceContentHeader
        eyebrow="Navigation"
        title="route overview"
        metaEyebrow="waypoints"
        meta="3 markers"
      />
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

function DiagramWidget() {
  return (
    <WorkspaceContentShell className="diagram-widget-shell">
      <WorkspaceContentHeader
        eyebrow="Diagram"
        title="system topology"
        metaEyebrow="nodes"
        meta="3 linked"
      />
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

function ProjectWidget() {
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
        {projectLanes.map((label, index) => (
          <div className="project-row" key={label}>
            <span>{label}</span>
            <div className="project-track" aria-label={`${label} ${50 + index * 10}% complete`}>
              <i style={{ width: `${50 + index * 10}%` }} />
            </div>
          </div>
        ))}
      </WorkspaceSectionFrame>
    </WorkspaceContentShell>
  );
}

function NewsWidget({
  activeGraph,
  onSelectGraph,
}: {
  activeGraph: MarketGraph;
  onSelectGraph: (graph: MarketGraph) => void;
}) {
  return <MarketsWidget activeGraph={activeGraph} onSelectGraph={onSelectGraph} />;
}

function VideoWidget() {
  return (
    <WorkspaceContentShell className="video-widget-shell">
      <WorkspaceContentHeader
        eyebrow="Video"
        title="preview monitor"
        metaEyebrow="source"
        meta="standby"
      />
      <WorkspaceSectionFrame className="media-widget-stage" eyebrow="playback" title="frame preview" meta="offline">
        <div className="video-surface">
          <div className="video-frame" />
          <div className="video-overlay">preview</div>
        </div>
      </WorkspaceSectionFrame>
    </WorkspaceContentShell>
  );
}

function PreviewWidget({
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

      <WorkspaceSectionFrame className="preview-file-foot" eyebrow="status" title={status}>
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
    </WorkspaceContentShell>
  );
}

function ModelStudioWidget() {
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
      <WorkspaceSummaryPanel className="model-studio-overview" title="touch / stylus / spatial capture ready">
        Future support for real 3D-space input can slot in here when the hardware catches up.
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

          <WorkspaceSummaryPanel className="model-studio-footer" title="creation surface">
            Designed as a fluid creation surface first, with engineering-grade simulation bolted on rather than the other way round.
          </WorkspaceSummaryPanel>
        </WorkspaceSectionFrame>
      </div>
    </WorkspaceContentShell>
  );
}

function WorkflowWidget() {
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
    const workflowId = draft.id ?? `workflow-${Date.now()}`;
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
        <aside className="workflow-column workflow-library">
          <WorkspaceSectionFrame className="workflow-group" eyebrow="Workflow library" meta="starter templates">
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

          <WorkspaceSectionFrame className="workflow-group" eyebrow="Skill library" meta="toggle helper skills">
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
        </aside>

        <WorkspaceSectionFrame className="workflow-column workflow-canvas" eyebrow="Workflow visualisation" meta="step by step">
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
                  <button type="button" className="workflow-step-remove" onClick={() => removeCustomStep(index)}>
                    Remove
                  </button>
                ) : null}
              </li>
            ))}
          </ol>

          <div className="workflow-status">{status}</div>
        </WorkspaceSectionFrame>

        <aside className="workflow-column workflow-editor">
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
        </aside>
      </div>
    </WorkspaceContentShell>
  );
}

function ListWidget() {
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
      <WorkspaceSectionFrame className="list-section" eyebrow="items" title="current queue" meta="open states">
        <WorkspaceRowList className="list-rows" rows={rows} ariaLabel="Workspace list" />
      </WorkspaceSectionFrame>
    </WorkspaceContentShell>
  );
}

function ScheduleWidget() {
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

function LauncherWidget({ onLaunchWorkspaceWidget, workspaceWidgets }: LauncherWidgetProps) {
  const [desktopCommand, setDesktopCommand] = useState('');
  const [desktopApps, setDesktopApps] = useState<DesktopAppRecord[]>(defaultDesktopApps);

  const workspaceApps = getWorkspaceLauncherEntries();
  const hasDesktopCommand = desktopCommand.trim().length > 0;

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
      note: state === 'open' ? 'open · click to focus' : app.note,
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
        open / focus / stay in the workspace
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
            onSelect={(item) => onLaunchWorkspaceWidget(item.id as WorkspaceWidget['kind'])}
          />
        </DesktopBridgePanel>
      </WorkspaceSectionFrame>

      <WorkspaceSummaryPanel className="launcher-note-panel" title="launcher note">
        The launcher now opens widgets where they belong: in the workspace, not as a separate browser tantrum.
      </WorkspaceSummaryPanel>
    </WorkspaceContentShell>
  );
}

function BrowserWidget() {
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

const defaultLiveTvSource = liveTvSources[0] as LiveTvSource;

function LiveTvWidget() {
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

function LocalFileMiniPreview({ file }: { file: LocalFileRecord }) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [textSnippet, setTextSnippet] = useState('');

  useEffect(() => {
    let cancelled = false;
    setObjectUrl(null);
    setTextSnippet('');

    if (file.previewKind === 'image') {
      const nextUrl = createLocalFileObjectUrl(file);
      setObjectUrl(nextUrl);
      return () => {
        cancelled = true;
        revokeLocalFileObjectUrl(nextUrl);
      };
    }

    if (file.previewKind === 'text') {
      void readLocalFileTextPreview(file.file, 96, { compactWhitespace: true })
        .then((content) => {
          if (cancelled) return;
          setTextSnippet(content);
        })
        .catch(() => {
          if (cancelled) return;
          setTextSnippet('Text preview unavailable');
        });
    }

    return () => {
      cancelled = true;
    };
  }, [file]);

  if (file.previewKind === 'image' && objectUrl) {
    return <img className="file-explorer-item-preview-image" src={objectUrl} alt="" aria-hidden="true" />;
  }

  if (file.previewKind === 'text') {
    return <span className="file-explorer-item-preview-text">{textSnippet || 'Text file'}</span>;
  }

  return <span className={`file-explorer-item-preview-badge kind-${file.previewKind}`}>{file.previewKind}</span>;
}

function FileExplorerWidget({
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

      <div className="file-explorer-toolbar">
        <WorkspaceButton className="file-explorer-button" onClick={handleBrowseFilesClick}>
          Browse items
        </WorkspaceButton>
        <WorkspaceButton
          variant="secondary"
          className="file-explorer-button is-muted"
          onClick={handleBrowseFolderClick}
          disabled={!canBrowseFolder}
          title={canBrowseFolder ? 'Open a general-use folder picker' : 'Folder picker is not available in this browser'}
        >
          Open folder
        </WorkspaceButton>
        <WorkspaceButton variant="secondary" className="file-explorer-button is-muted" onClick={onClearFiles} disabled={!files.length && !folderEntries.length}>
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
            Select files or open a folder from your PC, then single-click an item to select it and double-click to open it in the preview panel. The browser cannot rummage through the drive uninvited, which is arguably for the best.
          </WorkspaceSummaryPanel>
        )}
      </div>

      <div className="file-explorer-footer">
        <span>{loadedEntryCount ? `${loadedEntryCount} ${loadedEntryCount === 1 ? 'entry' : 'entries'}` : 'No entries loaded'}</span>
        <small>Single-click selects · click again opens preview.</small>
      </div>
    </WorkspaceContentShell>
  );
}


function NativeAppWidget() {
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


function WindowManagerWidget({
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
        className="window-manager-head"
        eyebrow="Window registry"
        title="Open windows and pinned surfaces"
        meta={`${openWidgets.length} open · ${widgets.length} total`}
      />
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
      <WorkspaceSummaryPanel className="window-manager-note" title="window controls">
        Open surfaces stay listed here. Pinned windows cannot be closed.
      </WorkspaceSummaryPanel>
    </WorkspaceContentShell>
  );
}

type WorkspaceWidgetCardProps = {
  widget: WorkspaceWidget;
  onStartDrag: (event: ReactPointerEvent<HTMLElement>, id: string) => void;
  onStartResize: (event: ReactPointerEvent<HTMLElement>, id: string, edge: ResizeEdge) => void;
  onToggleOpen: (id: string) => void;
  onRecenter: (id: string) => void;
  onClose: (id: string) => void;
  showChrome?: boolean;
  localFiles: LocalFileRecord[];
  activeLocalFileId: string | null;
  selectedLocalFileId: string | null;
  folderEntries: LocalFolderEntry[];
  folderPath: string | null;
  canBrowseFolder: boolean;
  activeMarketGraph: MarketGraph;
  onBrowseFiles: (files: FileList | File[]) => Promise<LocalFileRecord[]>;
  onBrowseFolder: () => void;
  onOpenPreview: (file: LocalFileRecord) => void;
  onSelectFile: (id: string | null) => void;
  onClearFiles: () => void;
  onLaunchWorkspaceWidget: (kind: WorkspaceWidget['kind']) => void;
  onSelectMarketGraph: (graph: MarketGraph) => void;
  workspaceWidgets: WorkspaceWidget[];
  onFocusWidget: (id: string) => void;
  onCloseWidget: (id: string) => void;
};

function WorkspaceWidgetCard(props: WorkspaceWidgetCardProps) {
  const {
    widget,
    onStartDrag,
    onStartResize,
    onToggleOpen,
    onRecenter,
    onClose,
    showChrome = true,
    localFiles,
    activeLocalFileId,
    selectedLocalFileId,
    folderEntries,
    folderPath,
    canBrowseFolder,
    activeMarketGraph,
    onBrowseFiles,
    onBrowseFolder,
    onOpenPreview,
    onSelectFile,
    onClearFiles,
    onLaunchWorkspaceWidget,
    onSelectMarketGraph,
    workspaceWidgets,
    onFocusWidget,
    onCloseWidget,
  } = props;
  const previewFile = widget.previewFileId ? localFiles.find((record) => record.id === widget.previewFileId) ?? null : null;

  return (
    <WorkspaceWindow
      widget={widget}
      bodyClassName={`widget-body ${widget.kind === 'file-explorer' ? 'widget-body-file-explorer' : ''} ${widget.kind === 'window-manager' ? 'widget-body-window-manager' : ''}`}
      onStartDrag={onStartDrag}
      onStartResize={onStartResize}
      onToggleOpen={onToggleOpen}
      onRecenter={onRecenter}
      onClose={onClose}
      showChrome={showChrome}
    >
        {widget.kind === 'file-explorer' && (
          <FileExplorerWidget
            files={localFiles}
            activeFileId={activeLocalFileId}
            selectedFileId={selectedLocalFileId}
            folderEntries={folderEntries}
            folderPath={folderPath}
            canBrowseFolder={canBrowseFolder}
            onBrowseFiles={onBrowseFiles}
            onBrowseFolder={onBrowseFolder}
            onOpenPreview={onOpenPreview}
            onSelectFile={onSelectFile}
            onClearFiles={onClearFiles}
          />
        )}
        {widget.kind === 'window-manager' && <WindowManagerWidget widgets={workspaceWidgets} onFocusWidget={onFocusWidget} onCloseWidget={onCloseWidget} />}
        {widget.kind !== 'file-explorer' && widget.kind !== 'window-manager' && (
          <div className="widget-scroll-pane">
            {widget.kind === 'overview' && <OverviewWidget />}
            {widget.kind === 'graph' && <GraphWidget />}
            {widget.kind === 'trading-graph' && <TradingGraphWidget graph={activeMarketGraph} />}
            {widget.kind === 'sheet' && <SpreadsheetWidget />}
            {widget.kind === 'docs' && <DocsWidget />}
            {widget.kind === 'slides' && <SlidesWidget />}
            {widget.kind === 'image' && <ImageWidget />}
            {widget.kind === 'pdf' && <PdfWidget />}
            {widget.kind === 'audio' && <AudioWidget />}
            {widget.kind === 'map' && <MapWidget />}
            {widget.kind === 'diagram' && <DiagramWidget />}
            {widget.kind === 'project' && <ProjectWidget />}
            {widget.kind === 'news' && <NewsWidget activeGraph={activeMarketGraph} onSelectGraph={onSelectMarketGraph} />}
            {widget.kind === 'schedule' && <ScheduleWidget />}
            {widget.kind === 'launcher' && <LauncherWidget onLaunchWorkspaceWidget={onLaunchWorkspaceWidget} workspaceWidgets={workspaceWidgets} />}
            {widget.kind === 'browser' && <BrowserWidget />}
            {widget.kind === 'watch-video' && <LiveTvWidget />}
            {widget.kind === 'native-app' && <NativeAppWidget />}
            {widget.kind === 'video' && <VideoWidget />}
            {widget.kind === '3d' && <PreviewWidget file={previewFile} onBrowseFiles={onBrowseFiles} onOpenPreview={onOpenPreview} />}
            {widget.kind === '3d-studio' && <ModelStudioWidget />}
            {widget.kind === 'flow' && <WorkflowWidget />}
            {widget.kind === 'list' && <ListWidget />}
          </div>
        )}
    </WorkspaceWindow>
  );
}

type WorkspaceProps = {
  panelKind?: WorkspaceWidget['kind'] | null;
};

export function Workspace({ panelKind = null }: WorkspaceProps) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const storedWidgets = useMemo(() => loadStoredWidgetState({ presets: initialWidgetState, defaultOpenKinds, blueprints: widgetBlueprints }), []);
  const widgetsRef = useRef(storedWidgets ?? initialWidgetState);
  const interactionRef = useRef<InteractionState | null>(null);
  const compactLayoutAppliedRef = useRef(Boolean(storedWidgets));
  const [widgets, setWidgets] = useState(storedWidgets ?? initialWidgetState);
  const [bounds, setBounds] = useState({ width: 0, height: 0 });
  const [nextLaunchIndex, setNextLaunchIndex] = useState(0);
  const [localFiles, setLocalFiles] = useState<LocalFileRecord[]>([]);
  const [selectedLocalFileId, setSelectedLocalFileId] = useState<string | null>(null);
  const [activeLocalFileId, setActiveLocalFileId] = useState<string | null>(null);
  const [folderEntries, setFolderEntries] = useState<LocalFolderEntry[]>([]);
  const [folderPath, setFolderPath] = useState<string | null>(generalUseFolderLabel);
  const persistedLocalFilesLoadedRef = useRef(false);
  const [activeMarketGraphId, setActiveMarketGraphId] = useState(defaultMarketGraph.id);
  const canBrowseFolder = typeof window !== 'undefined' && typeof (window as Window & { showDirectoryPicker?: ShowDirectoryPickerFn }).showDirectoryPicker === 'function';

  useEffect(() => {
    widgetsRef.current = widgets;
  }, [widgets]);

  useEffect(() => {
    if (panelKind || bounds.width < 860) return;
    void saveStoredWidgetState(widgets);
  }, [bounds.width, panelKind, widgets]);

  useEffect(() => {
    let cancelled = false;

    void readPersistedLocalFiles().then((records) => {
      if (cancelled) return;
      setLocalFiles(records);
      setSelectedLocalFileId(null);
      setActiveLocalFileId(null);
      persistedLocalFilesLoadedRef.current = true;
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!persistedLocalFilesLoadedRef.current) return;
    void writePersistedLocalFiles(localFiles);
  }, [localFiles]);

  useEffect(() => {
    if (activeLocalFileId) return;

    const previewWidget = widgetsRef.current.find((widget) => widget.kind === '3d' && widget.previewFileId);
    if (!previewWidget?.previewFileId) return;

    const restoredFile = localFiles.find((record) => record.id === previewWidget.previewFileId) ?? null;
    if (!restoredFile) return;

    setSelectedLocalFileId(restoredFile.id);
    setActiveLocalFileId(restoredFile.id);
  }, [activeLocalFileId, localFiles]);

  useEffect(() => {
    const updateBounds = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      setBounds({ width: rect.width, height: rect.height });
    };

    updateBounds();

    const observer = new ResizeObserver(updateBounds);
    if (canvasRef.current) observer.observe(canvasRef.current);

    window.addEventListener('resize', updateBounds);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateBounds);
    };
  }, []);

  useEffect(() => {
    if (!bounds.width || !bounds.height) return;

    const isCompact = bounds.width < 860;
    if (!isCompact) {
      compactLayoutAppliedRef.current = false;
      return;
    }

    if (compactLayoutAppliedRef.current || interactionRef.current) return;

    compactLayoutAppliedRef.current = true;
    setWidgets(createCompactLayout(bounds.width, bounds.height));
  }, [bounds.height, bounds.width]);

  useEffect(() => {
    const stopInteraction = () => {
      interactionRef.current = null;
    };

    window.addEventListener('pointerup', stopInteraction);
    window.addEventListener('pointercancel', stopInteraction);
    window.addEventListener('blur', stopInteraction);

    return () => {
      window.removeEventListener('pointerup', stopInteraction);
      window.removeEventListener('pointercancel', stopInteraction);
      window.removeEventListener('blur', stopInteraction);
    };
  }, []);

  const orderedWidgets = useMemo(() => [...widgets].sort((a, b) => a.zIndex - b.zIndex), [widgets]);
  const nextLaunchKind = launchableWindowKinds[nextLaunchIndex % launchableWindowKinds.length];

  const openPanelWindow = (kind: WorkspaceWidget['kind']) => {
    if (typeof window === 'undefined') return;

    const url = buildPanelWindowUrl(kind);
    const popup = window.open(url.toString(), '_blank', 'popup=yes,width=1280,height=900');
    if (!popup) {
      window.location.assign(url.toString());
      return;
    }

    popup.focus?.();
    setNextLaunchIndex((current) => current + 1);
  };

  const returnToHub = () => {
    if (typeof window === 'undefined') return;

    const url = buildWorkspaceHubUrl();

    if (url.toString() === window.location.href) return;

    window.history.replaceState({}, '', url.toString());
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const openNextPanelWindow = () => {
    openPanelWindow(nextLaunchKind);
  };

  const resetWorkspaceLayout = () => {
    interactionRef.current = null;
    const resetWidgets = createInitialWidgetState();
    widgetsRef.current = resetWidgets;
    void clearStoredWidgetState();
    setNextLaunchIndex(0);
    setWidgets(resetWidgets);
  };

  const raiseWidget = (id: string) => {
    setWidgets((current) => {
      const highest = current.reduce((max, widget) => Math.max(max, widget.zIndex), 0);
      return current.map((widget) => (widget.id === id ? { ...widget, zIndex: highest + 1 } : widget));
    });
  };

  const startDrag = (event: ReactPointerEvent<HTMLElement>, id: string) => {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest('button, input, textarea, select, a, video, [role="button"]')) return;

    const widget = widgetsRef.current.find((item) => item.id === id);
    const canvas = canvasRef.current;
    if (!widget || !canvas) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    raiseWidget(id);

    interactionRef.current = {
      id,
      mode: 'drag',
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startLeft: widget.x,
      startTop: widget.y,
      startWidth: widget.width,
      startHeight: widget.height,
    };
  };

  const startResize = (event: ReactPointerEvent<HTMLElement>, id: string, edge: ResizeEdge) => {
    if (event.button !== 0) return;

    const widget = widgetsRef.current.find((item) => item.id === id);
    if (!widget) return;

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    raiseWidget(id);

    interactionRef.current = {
      id,
      mode: 'resize',
      edge,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startLeft: widget.x,
      startTop: widget.y,
      startWidth: widget.width,
      startHeight: widget.height,
    };
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const interaction = interactionRef.current;
    if (!interaction || !canvasRef.current) return;

    const canvasRect = canvasRef.current.getBoundingClientRect();
    const currentWidget = widgetsRef.current.find((widget) => widget.id === interaction.id);
    if (!currentWidget) return;

    const deltaX = event.clientX - interaction.startX;
    const deltaY = event.clientY - interaction.startY;

    if (interaction.mode === 'drag') {
      const { left: nextLeft, top: nextTop } = calculatePartiallyOffscreenDragPosition({
        proposedLeft: interaction.startLeft + deltaX,
        proposedTop: interaction.startTop + deltaY,
        canvasWidth: canvasRect.width,
        canvasHeight: canvasRect.height,
        widgetWidth: currentWidget.width,
        widgetHeight: currentWidget.open ? currentWidget.height : 58,
      });

      setWidgets((current) =>
        current.map((widget) =>
          widget.id === interaction.id
            ? {
                ...widget,
                x: nextLeft,
                y: nextTop,
              }
            : widget,
        ),
      );
      return;
    }

    const isClosed = !currentWidget.open;
    const edge = interaction.edge ?? 'corner';
    let nextLeft = interaction.startLeft;
    let nextWidth = interaction.startWidth;
    let nextHeight = interaction.startHeight;

    if (edge === 'left') {
      nextLeft = interaction.startLeft + deltaX;
      nextWidth = interaction.startWidth - deltaX;
    } else if (edge === 'right') {
      nextWidth = interaction.startWidth + deltaX;
    } else if (edge === 'bottom') {
      nextHeight = interaction.startHeight + deltaY;
    } else {
      nextWidth = interaction.startWidth + deltaX;
      nextHeight = interaction.startHeight + deltaY;
    }

    if (isClosed) {
      nextHeight = interaction.startHeight;
      if (edge !== 'left') nextLeft = interaction.startLeft;
    }

    nextWidth = Math.max(currentWidget.minWidth, nextWidth);
    nextHeight = Math.max(currentWidget.minHeight, nextHeight);

    if (edge === 'left' && nextWidth === currentWidget.minWidth) {
      nextLeft = interaction.startLeft + (interaction.startWidth - currentWidget.minWidth);
    }

    setWidgets((current) =>
      current.map((widget) =>
        widget.id === interaction.id
          ? {
              ...widget,
              x: edge === 'left' ? nextLeft : widget.x,
              y: widget.y,
              width: nextWidth,
              height: nextHeight,
            }
          : widget,
      ),
    );
  };

  const stopInteraction = () => {
    interactionRef.current = null;
  };

  const toggleWidget = (id: string) => {
    raiseWidget(id);
    setWidgets((current) =>
      current.map((widget) =>
        widget.id === id ? { ...widget, open: !widget.open, zIndex: widget.zIndex + 1 } : widget,
      ),
    );
  };

  const recenterWidget = (id: string) => {
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    const canvasWidth = Math.max(320, canvasRect?.width ?? bounds.width ?? 0);
    const canvasHeight = Math.max(240, canvasRect?.height ?? bounds.height ?? 0);

    setWidgets((current) => {
      const highest = current.reduce((max, widget) => Math.max(max, widget.zIndex), 0);
      const next = current.map((widget) => {
        if (widget.id !== id) return widget;

        const { left, top } = calculateCenteredWidgetPosition({
          canvasWidth,
          canvasHeight,
          widgetWidth: widget.width,
          widgetHeight: widget.open ? widget.height : 58,
        });

        return {
          ...widget,
          x: left,
          y: top,
          zIndex: highest + 1,
        };
      });
      widgetsRef.current = next;
      return next;
    });
  };

  const closeWidget = (id: string) => {
    setWidgets((current) =>
      current.map((widget) =>
        widget.id === id
          ? {
              ...widget,
              open: false,
              zIndex: widget.zIndex + 1,
            }
          : widget,
      ),
    );
  };

  const focusWidget = (id: string, open = true) => {
    raiseWidget(id);
    if (!open) return;

    setWidgets((current) =>
      current.map((widget) =>
        widget.id === id
          ? {
              ...widget,
              open: true,
              zIndex: widget.zIndex + 1,
            }
          : widget,
      ),
    );
  };

  const openWorkspaceWidget = (kind: WorkspaceWidget['kind']) => {
    const target = widgetsRef.current.find((widget) => widget.kind === kind);
    if (target) {
      focusWidget(target.id);
      return;
    }

    setWidgets((current) => {
      const highest = current.reduce((max, widget) => Math.max(max, widget.zIndex), 0);
      const nextWidget = getFocusedWidget(kind, bounds.width || 1200, bounds.height || 800);
      const next = [...current, { ...nextWidget, zIndex: highest + 1 }];
      widgetsRef.current = next;
      return next;
    });
  };

  const openMarketGraph = (graph: MarketGraph) => {
    setActiveMarketGraphId(graph.id);
    openWorkspaceWidget('trading-graph');
  };

  const browseFolder = async () => {
    const picker = (window as Window & { showDirectoryPicker?: ShowDirectoryPickerFn }).showDirectoryPicker;
    if (!picker) return;

    try {
      const handle = await picker({ mode: 'read', startIn: 'documents' });
      setFolderPath(handle.name ?? generalUseFolderLabel);
      const entries = await readFolderEntries(handle);
      setFolderEntries(entries);
      const files = entries.flatMap((entry) => (entry.file ? [entry.file] : []));
      if (files.length) {
        await importLocalFiles(files);
      }
      focusWidget('file-explorer');
    } catch {
      // Native picker cancelled; nothing to do. A rare moment of restraint.
    }
  };

  const openPreviewWidget = (file: LocalFileRecord, dimensions: LocalImageDimensions | null = null) => {
    const blueprint = widgetBlueprints['3d'];
    const viewportWidth = Math.max(320, bounds.width || window.innerWidth || blueprint.minWidth);
    const viewportHeight = Math.max(240, bounds.height || window.innerHeight || blueprint.minHeight);
    const chromeWidth = 36;
    const chromeHeight = 108;
    const highest = widgetsRef.current.reduce((max, widget) => Math.max(max, widget.zIndex), 0);
    const existing = widgetsRef.current.find((widget) => widget.kind === '3d' && widget.previewFileId === file.id);

    if (existing) {
      setWidgets((current) => {
        const next = current.map((widget) =>
          widget.id === existing.id
            ? {
                ...widget,
                open: true,
                subtitle: file.path,
                zIndex: highest + 1,
              }
            : widget,
        );
        widgetsRef.current = next;
        return next;
      });
      return;
    }

    const scale = dimensions ? Math.min((viewportWidth * 0.88) / dimensions.width, (viewportHeight * 0.86) / dimensions.height, 1) : 1;
    const nextWidth = dimensions ? Math.max(blueprint.minWidth, Math.round(dimensions.width * scale) + chromeWidth) : blueprint.minWidth;
    const nextHeight = dimensions ? Math.max(blueprint.minHeight, Math.round(dimensions.height * scale) + chromeHeight) : blueprint.minHeight;
    const offset = Math.min(72, widgetsRef.current.filter((widget) => widget.kind === '3d').length * 18);

    setWidgets((current) => {
      const highestZ = current.reduce((max, widget) => Math.max(max, widget.zIndex), 0);
      const nextWidget: WorkspaceWidget = {
        id: `preview-${file.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        kind: '3d',
        title: 'Preview',
        subtitle: file.path,
        x: clampNumber(528 + offset, 528, 0, Math.max(0, viewportWidth - nextWidth)),
        y: clampNumber(66 + offset, 66, 0, Math.max(0, viewportHeight - nextHeight)),
        width: nextWidth,
        height: nextHeight,
        zIndex: highestZ + 1,
        surfaceAlpha: blueprint.surfaceAlpha,
        lineAlpha: blueprint.lineAlpha,
        open: true,
        minWidth: blueprint.minWidth,
        minHeight: blueprint.minHeight,
        previewFileId: file.id,
      };
      const next = [...current, nextWidget];
      widgetsRef.current = next;
      return next;
    });
  };

  const importLocalFiles = async (selected: FileList | File[]) => {
    const imported = Array.from(selected, createLocalFileRecord);
    if (!imported.length) return [] as LocalFileRecord[];

    const enriched = await Promise.all(
      imported.map(async (record) => ({
        ...record,
        imageDimensions: record.previewKind === 'image' ? await measureImageDimensions(record.file) : null,
      })),
    );

    setLocalFiles((current) => {
      const byId = new Map(current.map((record) => [record.id, record]));
      enriched.forEach((record) => {
        byId.set(record.id, record);
      });
      return Array.from(byId.values()).sort((left, right) => left.path.localeCompare(right.path));
    });

    const first = enriched[0];
    setSelectedLocalFileId(first.id);
    return enriched;
  };

  const openLocalPreview = async (file: LocalFileRecord) => {
    setSelectedLocalFileId(file.id);
    setActiveLocalFileId(file.id);
    const dimensions = file.previewKind === 'image' ? file.imageDimensions ?? (await measureImageDimensions(file.file)) : null;
    openPreviewWidget(file, dimensions);
  };

  const clearLocalFiles = () => {
    setLocalFiles([]);
    setSelectedLocalFileId(null);
    setActiveLocalFileId(null);
    setFolderEntries([]);
    setFolderPath(generalUseFolderLabel);
    setWidgets((current) => {
      const next = current.map((widget) => (widget.kind === '3d' ? { ...widget, previewFileId: null } : widget));
      widgetsRef.current = next;
      return next;
    });
    void clearPersistedLocalFiles();
  };

  const activeMarketGraph = useMemo(() => getMarketGraph(activeMarketGraphId), [activeMarketGraphId]);

  if (panelKind) {
    const focusedWidget = getFocusedWidget(panelKind, bounds.width || 1200, bounds.height || 800);

    return (
      <section className="workspace-shell workspace-shell-panel">
        <WorkspaceAtmosphere />

        <div className="workspace-head workspace-head-panel">
          <div className="workspace-brand">Mission Control Center</div>
          <StatusChip tone="ice">detached page · drag the OS window to another screen</StatusChip>
          <div className="workspace-launcher">
            <button type="button" className="workspace-launch-button" onClick={returnToHub}>
              Open hub
            </button>
            <button type="button" className="workspace-launch-button is-muted" onClick={() => openPanelWindow(nextLaunchKind)}>
              Add next page
            </button>
          </div>
        </div>

        <div className="workspace-panel-stage">
          <WorkspaceWidgetCard
            widget={focusedWidget}
            onStartDrag={startDrag}
            onStartResize={startResize}
            onToggleOpen={toggleWidget}
            onRecenter={recenterWidget}
            onClose={closeWidget}
            showChrome={panelKind === 'browser'}
            localFiles={localFiles}
            activeLocalFileId={activeLocalFileId}
            selectedLocalFileId={selectedLocalFileId}
            folderEntries={folderEntries}
            folderPath={folderPath}
            canBrowseFolder={canBrowseFolder}
            activeMarketGraph={activeMarketGraph}
            onBrowseFiles={importLocalFiles}
            onBrowseFolder={browseFolder}
            onOpenPreview={openLocalPreview}
            onSelectFile={setSelectedLocalFileId}
            onClearFiles={clearLocalFiles}
            onLaunchWorkspaceWidget={openWorkspaceWidget}
            onSelectMarketGraph={openMarketGraph}
            workspaceWidgets={widgets}
            onFocusWidget={focusWidget}
            onCloseWidget={closeWidget}
          />
        </div>
      </section>
    );
  }

  return (
    <section className="workspace-shell">
      <WorkspaceAtmosphere />

      <VisualLab />

      <div className="workspace-head">
        <div className="workspace-brand">Mission Control Center</div>
        <StatusChip tone="cool">tailnet live · drag · resize · stack</StatusChip>
        <div className="workspace-launcher">
          <button type="button" className="workspace-launch-button is-muted" onClick={resetWorkspaceLayout}>
            Reset layout
          </button>
          <button type="button" className="workspace-launch-button" onClick={openNextPanelWindow}>
            Add page · {getWidgetLabel(nextLaunchKind)}
          </button>
          <div className="workspace-launch-pills" role="group" aria-label="Window launch shortcuts">
            {launchableWindowKinds.map((kind) => (
              <button key={kind} type="button" className="workspace-launch-pill" onClick={() => openPanelWindow(kind)}>
                {getWidgetLabel(kind)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <WorkspaceCanvas
        canvasRef={canvasRef}
        onPointerMove={handlePointerMove}
        onPointerUp={stopInteraction}
        onPointerCancel={stopInteraction}
      >
        {orderedWidgets.map((widget) => (
          <WorkspaceWidgetCard
            key={widget.id}
            widget={widget}
            onStartDrag={startDrag}
            onStartResize={startResize}
            onToggleOpen={toggleWidget}
            onRecenter={recenterWidget}
            onClose={closeWidget}
            localFiles={localFiles}
            activeLocalFileId={activeLocalFileId}
            selectedLocalFileId={selectedLocalFileId}
            folderEntries={folderEntries}
            folderPath={folderPath}
            canBrowseFolder={canBrowseFolder}
            activeMarketGraph={activeMarketGraph}
            onBrowseFiles={importLocalFiles}
            onBrowseFolder={browseFolder}
            onOpenPreview={openLocalPreview}
            onSelectFile={setSelectedLocalFileId}
            onClearFiles={clearLocalFiles}
            onLaunchWorkspaceWidget={openWorkspaceWidget}
            onSelectMarketGraph={openMarketGraph}
            workspaceWidgets={widgets}
            onFocusWidget={focusWidget}
            onCloseWidget={closeWidget}
          />
        ))}
      </WorkspaceCanvas>
    </section>
  );
}
