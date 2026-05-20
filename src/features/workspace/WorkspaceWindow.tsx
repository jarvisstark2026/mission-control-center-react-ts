import type { CSSProperties, ReactNode, PointerEvent as ReactPointerEvent } from 'react';

import { WorkspaceWidgetFrame } from './workspaceBlocks';
import { WidgetResizeHandles, type ResizeEdge } from './WorkspaceResizeHandles';
import type { WorkspaceWidget } from './workspaceTypes';

export function WorkspaceWindow({
  widget,
  children,
  bodyClassName,
  onStartDrag,
  onStartResize,
  onToggleOpen,
  onRecenter,
  onClose,
  showChrome = true,
}: {
  widget: WorkspaceWidget;
  children: ReactNode;
  bodyClassName?: string;
  onStartDrag: (event: ReactPointerEvent<HTMLElement>, id: string) => void;
  onStartResize: (event: ReactPointerEvent<HTMLElement>, id: string, edge: ResizeEdge) => void;
  onToggleOpen: (id: string) => void;
  onRecenter: (id: string) => void;
  onClose: (id: string) => void;
  showChrome?: boolean;
}) {
  return (
    <article
      className={`workspace-widget ${widget.open ? 'is-open' : 'is-closed'} kind-${widget.kind}`}
      style={
        {
          left: `${widget.x}px`,
          top: `${widget.y}px`,
          width: `${widget.width}px`,
          height: `${widget.open ? widget.height : 58}px`,
          zIndex: widget.zIndex,
          '--widget-surface-alpha': widget.surfaceAlpha,
          '--widget-line-alpha': widget.lineAlpha,
        } as CSSProperties
      }
      onPointerDown={showChrome ? (event) => onStartDrag(event, widget.id) : undefined}
    >
      {showChrome ? (
        <>
          <div className="widget-labels" aria-hidden="true">
            <span className="widget-title">{widget.title}</span>
            <span className="widget-subtitle">{widget.subtitle}</span>
          </div>

          <div className="widget-chrome-actions" role="toolbar" aria-label={`${widget.title} window controls`}>
            <button
              type="button"
              className="widget-toggle"
              onClick={(event) => {
                event.stopPropagation();
                onToggleOpen(widget.id);
              }}
              aria-label={widget.open ? `Minimize ${widget.title}` : `Maximize ${widget.title}`}
              title={widget.open ? `Minimize ${widget.title}` : `Maximize ${widget.title}`}
            >
              {widget.open ? '▴' : '▾'}
            </button>
            <button
              type="button"
              className="widget-recenter"
              onClick={(event) => {
                event.stopPropagation();
                onRecenter(widget.id);
              }}
              aria-label={`Recenter ${widget.title}`}
              title={`Recenter ${widget.title}`}
            >
              ⌖
            </button>
            <button
              type="button"
              className="widget-close"
              disabled={Boolean(widget.pinned)}
              onPointerDown={(event) => {
                if (event.button !== 0) return;
                event.preventDefault();
                event.stopPropagation();
                onClose(widget.id);
              }}
              onClick={(event) => {
                event.stopPropagation();
                onClose(widget.id);
              }}
              aria-label={widget.pinned ? `${widget.title} is pinned` : `Close ${widget.title}`}
              title={widget.pinned ? `${widget.title} is pinned` : `Close ${widget.title}`}
            >
              ×
            </button>
          </div>
        </>
      ) : null}

      <WorkspaceWidgetFrame kind={widget.kind} className={bodyClassName}>
        {children}
      </WorkspaceWidgetFrame>

      <WidgetResizeHandles widget={widget} onStartResize={onStartResize} showChrome={showChrome} />
    </article>
  );
}
