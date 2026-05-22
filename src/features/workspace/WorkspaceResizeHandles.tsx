import type { PointerEvent as ReactPointerEvent } from 'react';

import type { WorkspaceWidget } from './workspaceTypes';

export type ResizeEdge = 'corner' | 'left' | 'right' | 'bottom';

type ResizeHandleSpec = {
  edge: ResizeEdge;
  className: string;
  gripClassName: string;
  label: string;
};

const resizeHandleSpecs: ResizeHandleSpec[] = [
  {
    edge: 'corner',
    className: 'widget-resize-handle-bottom-right',
    gripClassName: 'widget-resize-grip-corner',
    label: 'Resize {title} from the bottom-right corner',
  },
  {
    edge: 'left',
    className: 'widget-resize-handle-left widget-resize-handle-side',
    gripClassName: 'widget-resize-grip-vertical',
    label: 'Resize {title} from the left edge',
  },
  {
    edge: 'right',
    className: 'widget-resize-handle-right widget-resize-handle-side',
    gripClassName: 'widget-resize-grip-vertical',
    label: 'Resize {title} from the right edge',
  },
  {
    edge: 'bottom',
    className: 'widget-resize-handle-bottom',
    gripClassName: 'widget-resize-grip-horizontal',
    label: 'Resize {title} from the bottom edge',
  },
];

export function WidgetResizeHandles({
  widget,
  onStartResize,
  showChrome,
}: {
  widget: WorkspaceWidget;
  onStartResize: (event: ReactPointerEvent<HTMLButtonElement>, widgetId: string, edge: ResizeEdge) => void;
  showChrome: boolean;
}) {
  if (!showChrome || !widget.open) return null;

  return (
    <>
      {resizeHandleSpecs.map((handle) => {
        const label = handle.label.replace('{title}', widget.title);

        return (
          <button
            key={handle.edge}
            type="button"
            className={`widget-resize-handle ${handle.className}`}
            onPointerDown={(event) => {
              event.stopPropagation();
              onStartResize(event, widget.id, handle.edge);
            }}
            aria-label={label}
            title={label}
          >
            <span aria-hidden="true" className={`widget-resize-grip ${handle.gripClassName}`} />
          </button>
        );
      })}
    </>
  );
}
