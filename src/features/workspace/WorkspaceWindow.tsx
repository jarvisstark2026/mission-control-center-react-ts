import type { CSSProperties, ReactNode, PointerEvent as ReactPointerEvent } from 'react';

import { classNames } from '../../lib/classNames';
import { WorkspaceWidgetFrame } from './workspaceBlocks';
import { WorkspaceWidgetIcon } from './WorkspaceWidgetIcon';
import { WidgetResizeHandles, type ResizeEdge } from './WorkspaceResizeHandles';
import type { WorkspaceWidget } from './workspaceTypes';
import type { WorkspaceWidgetTransferAnimation } from './workspaceWidgetTransfer';

export function WorkspaceWindow({
  widget,
  children,
  bodyClassName,
  onStartDrag,
  onStartResize,
  onToggleOpen,
  onTogglePin,
  onMaximize,
  onRecenter,
  onClose,
  showChrome = true,
  transferAnimation = null,
}: {
  widget: WorkspaceWidget;
  children: ReactNode;
  bodyClassName?: string;
  onStartDrag: (event: ReactPointerEvent<HTMLElement>, id: string) => void;
  onStartResize: (event: ReactPointerEvent<HTMLElement>, id: string, edge: ResizeEdge) => void;
  onToggleOpen: (id: string) => void;
  onTogglePin: (id: string) => void;
  onMaximize: (id: string) => void;
  onRecenter: (id: string) => void;
  onClose: (id: string) => void;
  showChrome?: boolean;
  transferAnimation?: WorkspaceWidgetTransferAnimation | null;
}) {
  const widgetSurfaceAlpha = Math.min(widget.surfaceAlpha * 0.42, 0.05);
  const widgetLineAlpha = Math.min(widget.lineAlpha * 0.6, 0.1);

  return (
    <article
      className={classNames(
        'workspace-widget',
        widget.open ? 'is-open' : 'is-closed',
        showChrome ? 'has-chrome' : 'is-chromeless',
        widget.pinned && 'is-pinned',
        `kind-${widget.kind}`,
        transferAnimation && `is-transfer-${transferAnimation.phase}`,
        transferAnimation && `transfer-${transferAnimation.direction}`,
      )}
      style={
        {
          left: '0px',
          top: '0px',
          translate: `${widget.x}px ${widget.y}px`,
          width: `${widget.width}px`,
          height: `${widget.open ? widget.height : 58}px`,
          zIndex: widget.zIndex,
          '--widget-surface-alpha': widgetSurfaceAlpha,
          '--widget-line-alpha': widgetLineAlpha,
        } as CSSProperties
      }
      onPointerDown={showChrome ? (event) => onStartDrag(event, widget.id) : undefined}
    >
      {showChrome ? (
        <>
          <div className="widget-labels" aria-hidden="true">
            <WorkspaceWidgetIcon kind={widget.kind} />
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
              <span
                className={classNames(
                  'widget-control-icon',
                  widget.open ? 'widget-control-icon-minimize' : 'widget-control-icon-maximize',
                )}
                aria-hidden="true"
              />
            </button>
            <button
              type="button"
              className="widget-maximize"
              onClick={(event) => {
                event.stopPropagation();
                onMaximize(widget.id);
              }}
              aria-label={`Fill workspace with ${widget.title}`}
              title={`Fill workspace with ${widget.title}`}
            >
              <span className="widget-control-icon widget-control-icon-fill" aria-hidden="true" />
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
              <span className="widget-control-icon widget-control-icon-recenter" aria-hidden="true" />
            </button>
            <button
              type="button"
              className={classNames('widget-pin', widget.pinned && 'is-active')}
              onClick={(event) => {
                event.stopPropagation();
                onTogglePin(widget.id);
              }}
              aria-pressed={Boolean(widget.pinned)}
              aria-label={widget.pinned ? `Unpin ${widget.title}` : `Pin ${widget.title}`}
              title={widget.pinned ? `Unpin ${widget.title}` : `Pin ${widget.title}`}
            >
              <span className="widget-pin-icon" aria-hidden="true" />
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
                if (event.detail === 0) {
                  onClose(widget.id);
                }
              }}
              aria-label={widget.pinned ? `${widget.title} is pinned` : `Close ${widget.title}`}
              title={widget.pinned ? `${widget.title} is pinned` : `Close ${widget.title}`}
            >
              <span className="widget-control-icon widget-control-icon-close" aria-hidden="true" />
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
