import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';

import type { WorkspaceWidget } from './workspaceTypes';
import './workspace.css';

const STAGE_WIDTH = 1440;
const STAGE_HEIGHT = 780;

const widgetPresets: WorkspaceWidget[] = [
  {
    id: 'overview',
    kind: 'overview',
    title: 'Command core',
    subtitle: 'open / move / pin',
    x: 36,
    y: 34,
    width: 410,
    height: 250,
    depth: 18,
    hue: 210,
    open: true,
    pinned: true,
  },
  {
    id: 'telemetry',
    kind: 'graph',
    title: 'Telemetry',
    subtitle: 'live curves',
    x: 488,
    y: 40,
    width: 360,
    height: 190,
    depth: 24,
    hue: 201,
    open: true,
  },
  {
    id: 'preview',
    kind: '3d',
    title: '3D preview',
    subtitle: 'assets / projects',
    x: 874,
    y: 44,
    width: 400,
    height: 300,
    depth: 34,
    hue: 244,
    open: true,
  },
  {
    id: 'map',
    kind: 'map',
    title: 'Map / routes',
    subtitle: 'locations / zones',
    x: 470,
    y: 262,
    width: 290,
    height: 250,
    depth: 28,
    hue: 188,
    open: true,
  },
  {
    id: 'flow',
    kind: 'flow',
    title: 'Flow chart',
    subtitle: 'system logic',
    x: 786,
    y: 340,
    width: 250,
    height: 188,
    depth: 22,
    hue: 226,
    open: true,
  },
  {
    id: 'news',
    kind: 'news',
    title: 'News / market',
    subtitle: 'watchlist',
    x: 1060,
    y: 334,
    width: 258,
    height: 196,
    depth: 20,
    hue: 213,
    open: true,
  },
  {
    id: 'audio',
    kind: 'audio',
    title: 'Audio surface',
    subtitle: 'hold / play / mix',
    x: 58,
    y: 318,
    width: 360,
    height: 200,
    depth: 16,
    hue: 198,
    open: true,
  },
  {
    id: 'list',
    kind: 'list',
    title: 'Project list',
    subtitle: 'tasks / backlog',
    x: 60,
    y: 518,
    width: 352,
    height: 174,
    depth: 14,
    hue: 218,
    open: true,
  },
];

type DragState = {
  id: string;
  offsetX: number;
  offsetY: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, max));
}

function OverviewWidget() {
  return (
    <div className="widget-grid overview-grid">
      <div className="stats-arc" />
      <div className="metric-tile">
        <span>system</span>
        <strong>98%</strong>
      </div>
      <div className="metric-tile">
        <span>devices</span>
        <strong>24</strong>
      </div>
      <div className="metric-tile">
        <span>alerts</span>
        <strong>12</strong>
      </div>
      <div className="metric-tile metric-wide">
        <span>multi-screen workspace</span>
        <strong>drag / snap / fade / open</strong>
      </div>
    </div>
  );
}

function GraphWidget() {
  return (
    <div className="spark-panel">
      <div className="spark-line spark-a" />
      <div className="spark-line spark-b" />
      <div className="spark-line spark-c" />
      <div className="spark-grid" />
      <div className="spark-axis" />
    </div>
  );
}

function AudioWidget() {
  return (
    <div className="audio-surface">
      <div className="audio-ring audio-ring-a" />
      <div className="audio-ring audio-ring-b" />
      <div className="audio-bars">
        {Array.from({ length: 12 }).map((_, index) => (
          <i key={index} style={{ height: `${36 + ((index * 11) % 54)}%` }} />
        ))}
      </div>
    </div>
  );
}

function MapWidget() {
  return (
    <div className="map-surface">
      <div className="map-grid" />
      <div className="map-route map-route-a" />
      <div className="map-route map-route-b" />
      <div className="map-point map-point-a" />
      <div className="map-point map-point-b" />
      <div className="map-point map-point-c" />
    </div>
  );
}

function DiagramWidget() {
  return (
    <div className="diagram-surface">
      <div className="diagram-node diagram-node-a" />
      <div className="diagram-node diagram-node-b" />
      <div className="diagram-node diagram-node-c" />
      <div className="diagram-link diagram-link-a" />
      <div className="diagram-link diagram-link-b" />
      <div className="diagram-link diagram-link-c" />
    </div>
  );
}

function ProjectWidget() {
  return (
    <div className="project-surface">
      {['layout', 'assets', 'review', 'deploy'].map((label, index) => (
        <div className="project-row" key={label}>
          <span>{label}</span>
          <div className="project-track">
            <i style={{ width: `${50 + index * 10}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function NewsWidget() {
  return (
    <div className="news-surface">
      <div className="news-ticker" />
      {['AI systems', 'energy', 'markets', 'home'].map((label) => (
        <div className="news-item" key={label}>
          <span>{label}</span>
          <span>live</span>
        </div>
      ))}
    </div>
  );
}

function VideoWidget() {
  return (
    <div className="video-surface">
      <div className="video-frame" />
      <div className="video-overlay">preview</div>
    </div>
  );
}

function PreviewWidget() {
  return (
    <div className="preview-surface">
      <div className="preview-orb preview-orb-a" />
      <div className="preview-orb preview-orb-b" />
      <div className="preview-ring" />
      <div className="preview-scan" />
    </div>
  );
}

function FlowWidget() {
  return (
    <div className="flow-surface">
      <div className="flow-node flow-node-a" />
      <div className="flow-node flow-node-b" />
      <div className="flow-node flow-node-c" />
      <div className="flow-arrow flow-arrow-a" />
      <div className="flow-arrow flow-arrow-b" />
    </div>
  );
}

function ListWidget() {
  return (
    <div className="list-surface">
      {['inbox', 'next action', 'blocked', 'archive'].map((item) => (
        <div className="list-item" key={item}>
          <span>{item}</span>
          <span>open</span>
        </div>
      ))}
    </div>
  );
}

function WorkspaceWidgetCard({
  widget,
  onPointerDown,
  onToggleOpen,
}: {
  widget: WorkspaceWidget;
  onPointerDown: (event: ReactPointerEvent<HTMLElement>, id: string) => void;
  onToggleOpen: (id: string) => void;
}) {
  return (
    <article
      className={`workspace-widget ${widget.open ? 'is-open' : 'is-closed'} kind-${widget.kind}`}
      style={
        {
          '--widget-hue': widget.hue,
          '--widget-depth': widget.depth,
          left: `${widget.x}px`,
          top: `${widget.y}px`,
          width: `${widget.width}px`,
          height: `${widget.height}px`,
        } as CSSProperties
      }
      onPointerDown={(event) => onPointerDown(event, widget.id)}
    >
      <header className="widget-chrome">
        <div>
          <p>{widget.title}</p>
          <span>{widget.subtitle}</span>
        </div>
        <div className="chrome-actions">
          <button type="button" onClick={() => onToggleOpen(widget.id)} aria-label={`Toggle ${widget.title}`}>
            {widget.open ? 'collapse' : 'open'}
          </button>
          <span className="widget-depth">{widget.pinned ? 'pinned' : `z${widget.depth}`}</span>
        </div>
      </header>
      <div className="widget-body">
        {widget.kind === 'overview' && <OverviewWidget />}
        {widget.kind === 'graph' && <GraphWidget />}
        {widget.kind === 'audio' && <AudioWidget />}
        {widget.kind === 'map' && <MapWidget />}
        {widget.kind === 'diagram' && <DiagramWidget />}
        {widget.kind === 'project' && <ProjectWidget />}
        {widget.kind === 'news' && <NewsWidget />}
        {widget.kind === 'video' && <VideoWidget />}
        {widget.kind === '3d' && <PreviewWidget />}
        {widget.kind === 'flow' && <FlowWidget />}
        {widget.kind === 'list' && <ListWidget />}
      </div>
    </article>
  );
}

export function Workspace() {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [widgets, setWidgets] = useState(widgetPresets);
  const [scale, setScale] = useState(1);
  const dragRef = useRef<DragState | null>(null);

  useEffect(() => {
    const updateScale = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const nextScale = Math.min(rect.width / STAGE_WIDTH, rect.height / STAGE_HEIGHT, 1);
      setScale(Number.isFinite(nextScale) ? nextScale : 1);
    };

    updateScale();
    const observer = new ResizeObserver(updateScale);
    if (canvasRef.current) observer.observe(canvasRef.current);
    window.addEventListener('resize', updateScale);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateScale);
    };
  }, []);

  const orderedWidgets = useMemo(() => [...widgets].sort((a, b) => a.depth - b.depth), [widgets]);

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>, id: string) => {
    if ((event.target as HTMLElement).closest('button')) return;
    const canvas = canvasRef.current;
    const widgetElement = event.currentTarget as HTMLElement;
    if (!canvas) return;
    const canvasRect = canvas.getBoundingClientRect();
    const widgetRect = widgetElement.getBoundingClientRect();
    dragRef.current = {
      id,
      offsetX: (event.clientX - widgetRect.left) / scale,
      offsetY: (event.clientY - widgetRect.top) / scale,
    };
    widgetElement.setPointerCapture?.(event.pointerId);
    setWidgets((current) =>
      current.map((widget) =>
        widget.id === id ? { ...widget, depth: Math.max(widget.depth, 40) } : widget,
      ),
    );
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const canvasRect = canvas.getBoundingClientRect();
    const currentWidget = widgets.find((widget) => widget.id === dragRef.current?.id);
    if (!currentWidget) return;

    const nextX = clamp(
      (event.clientX - canvasRect.left) / scale - dragRef.current.offsetX,
      0,
      Math.max(0, STAGE_WIDTH - currentWidget.width),
    );
    const nextY = clamp(
      (event.clientY - canvasRect.top) / scale - dragRef.current.offsetY,
      0,
      Math.max(0, STAGE_HEIGHT - currentWidget.height),
    );

    setWidgets((current) =>
      current.map((widget) =>
        widget.id === dragRef.current?.id ? { ...widget, x: nextX, y: nextY } : widget,
      ),
    );
  };

  const stopDrag = () => {
    dragRef.current = null;
  };

  const onToggleOpen = (id: string) => {
    setWidgets((current) =>
      current.map((widget) =>
        widget.id === id ? { ...widget, open: !widget.open, depth: Math.max(widget.depth, 45) } : widget,
      ),
    );
  };

  return (
    <section className="workspace-shell">
      <header className="workspace-chrome">
        <div>
          <p className="workspace-eyebrow">Mission Control Center</p>
          <h1>Fluid workspace. Free-moving widgets. No scroll prisons.</h1>
        </div>
        <div className="workspace-status">
          <span className="status-dot" />
          Tailscale link live
        </div>
      </header>

      <div
        className="workspace-canvas"
        ref={canvasRef}
        onPointerMove={onPointerMove}
        onPointerUp={stopDrag}
        onPointerLeave={stopDrag}
      >
        <div
          className="workspace-stage"
          style={{
            width: `${STAGE_WIDTH}px`,
            height: `${STAGE_HEIGHT}px`,
            transform: `scale(${scale})`,
          }}
        >
          <div className="workspace-grid" aria-hidden="true" />
          <div className="workspace-aurora workspace-aurora-a" aria-hidden="true" />
          <div className="workspace-aurora workspace-aurora-b" aria-hidden="true" />
          {orderedWidgets.map((widget) => (
            <WorkspaceWidgetCard key={widget.id} widget={widget} onPointerDown={onPointerDown} onToggleOpen={onToggleOpen} />
          ))}
        </div>
      </div>

      <footer className="workspace-footer">
        <span>Drag widgets around. Open / close them. Move them across the surface like a live control room.</span>
        <span>Base system first — then feature widgets.</span>
      </footer>
    </section>
  );
}
