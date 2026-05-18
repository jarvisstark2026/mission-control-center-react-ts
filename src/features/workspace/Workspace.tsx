import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';

import type { WorkspaceWidget } from './workspaceTypes';
import { VisualLab } from '../visual-lab/VisualLab';
import './workspace.css';

const widgetPresets: WorkspaceWidget[] = [
  {
    id: 'overview',
    kind: 'overview',
    title: 'Command core',
    subtitle: 'open / move / stack',
    x: 44,
    y: 74,
    width: 390,
    height: 248,
    zIndex: 6,
    surfaceAlpha: 0.11,
    lineAlpha: 0.18,
    open: true,
    minWidth: 300,
    minHeight: 180,
    pinned: true,
  },
  {
    id: 'telemetry',
    kind: 'graph',
    title: 'Telemetry',
    subtitle: 'live curves',
    x: 264,
    y: 88,
    width: 350,
    height: 220,
    zIndex: 5,
    surfaceAlpha: 0.085,
    lineAlpha: 0.16,
    open: true,
    minWidth: 280,
    minHeight: 170,
  },
  {
    id: 'preview',
    kind: '3d',
    title: '3D preview',
    subtitle: 'assets / projects',
    x: 528,
    y: 66,
    width: 426,
    height: 258,
    zIndex: 4,
    surfaceAlpha: 0.1,
    lineAlpha: 0.16,
    open: true,
    minWidth: 300,
    minHeight: 190,
  },
  {
    id: 'map',
    kind: 'map',
    title: 'Map / routes',
    subtitle: 'locations / zones',
    x: 246,
    y: 286,
    width: 300,
    height: 218,
    zIndex: 3,
    surfaceAlpha: 0.08,
    lineAlpha: 0.15,
    open: true,
    minWidth: 250,
    minHeight: 170,
  },
  {
    id: 'flow',
    kind: 'flow',
    title: 'Flow chart',
    subtitle: 'system logic',
    x: 560,
    y: 318,
    width: 260,
    height: 188,
    zIndex: 2,
    surfaceAlpha: 0.075,
    lineAlpha: 0.14,
    open: true,
    minWidth: 220,
    minHeight: 150,
  },
  {
    id: 'news',
    kind: 'news',
    title: 'News / market',
    subtitle: 'watchlist',
    x: 872,
    y: 94,
    width: 274,
    height: 194,
    zIndex: 1,
    surfaceAlpha: 0.078,
    lineAlpha: 0.14,
    open: true,
    minWidth: 240,
    minHeight: 150,
  },
  {
    id: 'audio',
    kind: 'audio',
    title: 'Audio surface',
    subtitle: 'hold / play / mix',
    x: 60,
    y: 330,
    width: 344,
    height: 194,
    zIndex: 3,
    surfaceAlpha: 0.1,
    lineAlpha: 0.17,
    open: true,
    minWidth: 260,
    minHeight: 170,
  },
  {
    id: 'list',
    kind: 'list',
    title: 'Project list',
    subtitle: 'tasks / backlog',
    x: 64,
    y: 522,
    width: 332,
    height: 174,
    zIndex: 2,
    surfaceAlpha: 0.075,
    lineAlpha: 0.14,
    open: true,
    minWidth: 260,
    minHeight: 150,
  },
];

function createCompactLayout(boundsWidth: number, boundsHeight: number): WorkspaceWidget[] {
  const stackWidth = Math.max(260, Math.min(boundsWidth - 16, 420));
  const totalWidgets = widgetPresets.length;
  const openCount = boundsHeight < 760 ? 2 : 3;
  const topInset = 58;
  const bottomInset = 12;
  const gap = 8;
  const closedHeight = 44;

  const availableHeight = Math.max(0, boundsHeight - topInset - bottomInset - gap * (totalWidgets - 1));
  const openHeightBudget = Math.max(0, availableHeight - closedHeight * (totalWidgets - openCount));
  const openHeight = Math.max(112, Math.min(160, Math.floor(openHeightBudget / openCount)));

  const openHeights =
    openCount === 2
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
  pointerId: number;
  startX: number;
  startY: number;
  startLeft: number;
  startTop: number;
  startWidth: number;
  startHeight: number;
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
        <span>workspace mode</span>
        <strong>drag / resize / stack / fade</strong>
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
  onStartDrag,
  onStartResize,
  onToggleOpen,
}: {
  widget: WorkspaceWidget;
  onStartDrag: (event: ReactPointerEvent<HTMLElement>, id: string) => void;
  onStartResize: (event: ReactPointerEvent<HTMLElement>, id: string) => void;
  onToggleOpen: (id: string) => void;
}) {
  return (
    <article
      className={`workspace-widget ${widget.open ? 'is-open' : 'is-closed'} kind-${widget.kind}`}
      style={
        {
          left: `${widget.x}px`,
          top: `${widget.y}px`,
          width: `${widget.width}px`,
          height: `${widget.height}px`,
          zIndex: widget.zIndex,
          '--widget-surface-alpha': widget.surfaceAlpha,
          '--widget-line-alpha': widget.lineAlpha,
        } as CSSProperties
      }
      onPointerDown={(event) => onStartDrag(event, widget.id)}
    >
      <div className="widget-labels" aria-hidden="true">
        <span className="widget-title">{widget.title}</span>
        <span className="widget-subtitle">{widget.subtitle}</span>
      </div>

      <button
        type="button"
        className="widget-toggle"
        onClick={(event) => {
          event.stopPropagation();
          onToggleOpen(widget.id);
        }}
        aria-label={widget.open ? `Collapse ${widget.title}` : `Open ${widget.title}`}
      >
        {widget.open ? '−' : '+'}
      </button>

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

      <button
        type="button"
        className="widget-resize-handle"
        onPointerDown={(event) => onStartResize(event, widget.id)}
        aria-label={`Resize ${widget.title}`}
      />
    </article>
  );
}

export function Workspace() {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const widgetsRef = useRef(widgetPresets);
  const interactionRef = useRef<InteractionState | null>(null);
  const compactLayoutAppliedRef = useRef(false);
  const [widgets, setWidgets] = useState(widgetPresets);
  const [bounds, setBounds] = useState({ width: 0, height: 0 });

  useEffect(() => {
    widgetsRef.current = widgets;
  }, [widgets]);

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

    setWidgets((current) =>
      current.map((widget) => ({
        ...widget,
        x: clamp(widget.x, 0, Math.max(0, bounds.width - widget.width)),
        y: clamp(widget.y, 0, Math.max(0, bounds.height - widget.height)),
        width: clamp(widget.width, widget.minWidth, Math.max(widget.minWidth, bounds.width - widget.x)),
        height: clamp(widget.height, widget.minHeight, Math.max(widget.minHeight, bounds.height - widget.y)),
      })),
    );
  }, [bounds.height, bounds.width]);

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

  const raiseWidget = (id: string) => {
    setWidgets((current) => {
      const highest = current.reduce((max, widget) => Math.max(max, widget.zIndex), 0);
      return current.map((widget) => (widget.id === id ? { ...widget, zIndex: highest + 1 } : widget));
    });
  };

  const startDrag = (event: ReactPointerEvent<HTMLElement>, id: string) => {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest('button.widget-toggle, button.widget-resize-handle')) return;

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

  const startResize = (event: ReactPointerEvent<HTMLElement>, id: string) => {
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
      const nextLeft = clamp(
        interaction.startLeft + deltaX,
        0,
        Math.max(0, canvasRect.width - currentWidget.width),
      );
      const nextTop = clamp(
        interaction.startTop + deltaY,
        0,
        Math.max(0, canvasRect.height - currentWidget.height),
      );

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

    const nextWidth = clamp(
      interaction.startWidth + deltaX,
      currentWidget.minWidth,
      Math.max(currentWidget.minWidth, canvasRect.width - interaction.startLeft),
    );
    const nextHeight = clamp(
      interaction.startHeight + deltaY,
      currentWidget.minHeight,
      Math.max(currentWidget.minHeight, canvasRect.height - interaction.startTop),
    );

    setWidgets((current) =>
      current.map((widget) =>
        widget.id === interaction.id
          ? {
              ...widget,
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

  return (
    <section className="workspace-shell">
      <div className="workspace-atmosphere workspace-atmosphere-a" aria-hidden="true" />
      <div className="workspace-atmosphere workspace-atmosphere-b" aria-hidden="true" />
      <div className="workspace-grid" aria-hidden="true" />

      <VisualLab />

      <div className="workspace-head">
        <div className="workspace-brand">Mission Control Center</div>
        <div className="workspace-chip">tailnet live · drag · resize · stack</div>
      </div>

      <div
        className="workspace-canvas"
        ref={canvasRef}
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
          />
        ))}
      </div>
    </section>
  );
}
