import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from 'react';

import { classNames } from '../../lib/classNames';
import { WorkspaceWidgetIcon } from './WorkspaceWidgetIcon';
import {
  getManagedWidgetRows,
  getTrackedWorkspaceWidgetGroups,
  getWidgetForManagedRow,
  type WorkspaceWidgetGroup,
} from './workspaceManagerModel';
import type { WorkspaceActionRow } from './workspaceBlocks';

type TrackerActionMenu = {
  row: WorkspaceActionRow;
  x: number;
  y: number;
};

type TrackerGroupStyle = CSSProperties & {
  '--tracker-window-count': number;
};

function getShortWorkspaceLabel(label: string, active: boolean) {
  if (active) return 'M';

  const numberMatch = label.match(/\d+$/);
  if (numberMatch) return numberMatch[0];

  return label;
}

function getTrackerWidgetSignature(widget: WorkspaceWidgetGroup['widgets'][number]) {
  return `${widget.id}:${widget.kind}:${widget.title}:${widget.open ? 1 : 0}:${widget.hidden ? 1 : 0}:${widget.pinned ? 1 : 0}:${widget.zIndex}`;
}

function getTrackerGroupsSignature(workspaceGroups: WorkspaceWidgetGroup[]) {
  return workspaceGroups
    .map((group) => `${group.workspaceId}:${group.label}:${group.active ? 1 : 0}:${group.widgets.map(getTrackerWidgetSignature).join('|')}`)
    .join('||');
}

type WorkspaceWindowTrackerProps = {
  workspaceGroups: WorkspaceWidgetGroup[];
  onFocusWidget: (id: string) => void;
  onTogglePinWidget: (id: string) => void;
  onCloseWidget: (id: string) => void;
};

function WorkspaceWindowTrackerComponent({
  workspaceGroups,
  onFocusWidget,
  onTogglePinWidget,
  onCloseWidget,
}: WorkspaceWindowTrackerProps) {
  const [actionMenu, setActionMenu] = useState<TrackerActionMenu | null>(null);
  const trackerStripRef = useRef<HTMLDivElement | null>(null);
  const trackerStripRectRef = useRef<DOMRect | null>(null);
  const autoScrollFrameRef = useRef<number | null>(null);
  const autoScrollVelocityRef = useRef(0);
  const trackedGroups = useMemo(() => getTrackedWorkspaceWidgetGroups(workspaceGroups), [workspaceGroups]);
  const groupsWithVisibleWidgets = useMemo(
    () => trackedGroups.filter((group) => group.visibleWidgets.length > 0),
    [trackedGroups],
  );

  useEffect(() => {
    if (!actionMenu) return undefined;

    const closeActionMenu = () => setActionMenu(null);
    const closeActionMenuOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeActionMenu();
      }
    };

    window.addEventListener('click', closeActionMenu);
    window.addEventListener('keydown', closeActionMenuOnEscape);

    return () => {
      window.removeEventListener('click', closeActionMenu);
      window.removeEventListener('keydown', closeActionMenuOnEscape);
    };
  }, [actionMenu]);

  useEffect(() => {
    return () => {
      autoScrollVelocityRef.current = 0;
      if (autoScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(autoScrollFrameRef.current);
        autoScrollFrameRef.current = null;
      }
    };
  }, []);

  const stopTrackerAutoScroll = () => {
    autoScrollVelocityRef.current = 0;
    trackerStripRectRef.current = null;

    if (autoScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(autoScrollFrameRef.current);
      autoScrollFrameRef.current = null;
    }
  };

  const refreshTrackerRect = () => {
    trackerStripRectRef.current = trackerStripRef.current?.getBoundingClientRect() ?? null;
  };

  const tickTrackerAutoScroll = () => {
    const trackerStrip = trackerStripRef.current;
    const velocity = autoScrollVelocityRef.current;

    if (!trackerStrip || velocity === 0) {
      autoScrollFrameRef.current = null;
      return;
    }

    trackerStrip.scrollLeft += velocity;
    autoScrollFrameRef.current = window.requestAnimationFrame(tickTrackerAutoScroll);
  };

  const startTrackerAutoScroll = (velocity: number) => {
    autoScrollVelocityRef.current = velocity;

    if (autoScrollFrameRef.current === null) {
      autoScrollFrameRef.current = window.requestAnimationFrame(tickTrackerAutoScroll);
    }
  };

  const handleTrackerPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const trackerStrip = trackerStripRef.current;
    if (!trackerStrip || trackerStrip.scrollWidth <= trackerStrip.clientWidth) {
      stopTrackerAutoScroll();
      return;
    }

    const edgeSize = 64;
    const rect = trackerStripRectRef.current ?? trackerStrip.getBoundingClientRect();
    trackerStripRectRef.current = rect;
    const distanceFromLeft = event.clientX - rect.left;
    const distanceFromRight = rect.right - event.clientX;

    if (distanceFromLeft < edgeSize) {
      const intensity = (edgeSize - distanceFromLeft) / edgeSize;
      startTrackerAutoScroll(-Math.max(2, Math.ceil(intensity * 12)));
      return;
    }

    if (distanceFromRight < edgeSize) {
      const intensity = (edgeSize - distanceFromRight) / edgeSize;
      startTrackerAutoScroll(Math.max(2, Math.ceil(intensity * 12)));
      return;
    }

    stopTrackerAutoScroll();
  };

  const openActionMenu = (
    event: ReactMouseEvent<HTMLElement> | ReactKeyboardEvent<HTMLElement> | ReactPointerEvent<HTMLElement>,
    row: WorkspaceActionRow,
  ) => {
    event.preventDefault();
    event.stopPropagation();

    const rect = event.currentTarget.getBoundingClientRect();
    const pointerEvent = 'clientX' in event ? event : null;
    const x = pointerEvent?.clientX || rect.left + rect.width / 2;
    const y = pointerEvent?.clientY || rect.top;

    setActionMenu({
      row,
      x: Math.min(Math.max(x, 88), window.innerWidth - 88),
      y: Math.min(Math.max(y, 88), window.innerHeight - 12),
    });
  };

  const handleTrackerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, row: WorkspaceActionRow) => {
    if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
      openActionMenu(event, row);
    }
  };

  const handleTrackerPointerDown = (event: ReactPointerEvent<HTMLButtonElement>, row: WorkspaceActionRow) => {
    if (event.button === 2) {
      openActionMenu(event, row);
    }
  };

  const handleTrackerMouseDown = (event: ReactMouseEvent<HTMLButtonElement>, row: WorkspaceActionRow) => {
    if (event.button === 2) {
      openActionMenu(event, row);
    }
  };

  const handleFocusWidget = (rowId: string) => {
    setActionMenu(null);
    onFocusWidget(rowId);
  };

  const handleTogglePinWidget = (rowId: string) => {
    setActionMenu(null);
    onTogglePinWidget(rowId);
  };

  const handleCloseWidget = (rowId: string) => {
    setActionMenu(null);
    onCloseWidget(rowId);
  };

  const getTrackerGroupStyle = (rows: WorkspaceActionRow[]): TrackerGroupStyle => ({
    '--tracker-window-count': rows.length,
  });

  const actionMenuMarkup = actionMenu ? (
    createPortal(
      <div
        className="workspace-tracker-action-menu"
        role="menu"
        aria-label={`${actionMenu.row.primary} actions`}
        style={{
          left: `${actionMenu.x}px`,
          top: `${actionMenu.y}px`,
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" role="menuitem" onClick={() => handleFocusWidget(actionMenu.row.id)}>
          <span className="workspace-tracker-action-icon workspace-tracker-action-icon-focus" aria-hidden="true" />
          <span>Focus</span>
        </button>
        <button type="button" role="menuitem" onClick={() => handleTogglePinWidget(actionMenu.row.id)}>
          <span className="widget-pin-icon" aria-hidden="true" />
          <span>{actionMenu.row.pinned ? 'Unpin' : 'Pin'}</span>
        </button>
        <button type="button" role="menuitem" disabled={Boolean(actionMenu.row.pinned)} onClick={() => handleCloseWidget(actionMenu.row.id)}>
          <span className="widget-control-icon widget-control-icon-close" aria-hidden="true" />
          <span>{actionMenu.row.pinned ? 'Pinned' : 'Close'}</span>
        </button>
      </div>,
      document.body,
    )
  ) : null;

  return (
    <div className="workspace-window-tracker" aria-label="Workspace window tracker">
      {groupsWithVisibleWidgets.length > 0 ? (
        <div
          ref={trackerStripRef}
          className="workspace-tracker-strip"
          role="list"
          aria-label="Tracked workspace windows"
          onPointerEnter={refreshTrackerRect}
          onPointerMove={handleTrackerPointerMove}
          onPointerLeave={stopTrackerAutoScroll}
          onBlur={stopTrackerAutoScroll}
        >
          {groupsWithVisibleWidgets.map((group) => {
            const rows = getManagedWidgetRows(group);

            return (
              <section
                className="workspace-tracker-group"
                key={group.workspaceId}
                style={getTrackerGroupStyle(rows)}
                aria-label={`${group.label} windows`}
              >
                <span className="workspace-tracker-group-label" title={group.label}>
                  <span className="workspace-tracker-label-code">{getShortWorkspaceLabel(group.label, group.active)}</span>
                </span>
                <span className="workspace-tracker-group-meter" aria-hidden="true">
                  {rows.slice(0, 10).map((row) => (
                    <span
                      className={classNames('workspace-tracker-meter-dot', row.pinned && 'is-pinned', row.secondary === 'open' && 'is-open')}
                      key={row.id}
                    />
                  ))}
                </span>
                <div className="workspace-tracker-window-set" aria-label={`${group.label} tracked windows`}>
                  <span className="workspace-tracker-window-set-corner" aria-hidden="true" />
                  {rows.map((row) => {
                    const widget = getWidgetForManagedRow(group, row.id);
                    if (!widget) return null;

                    return (
                      <div className="workspace-tracker-item" key={row.id} role="listitem">
                        <button
                          type="button"
                          className={classNames('workspace-tracker-window', row.pinned && 'is-pinned', !widget.open && 'is-minimized')}
                          onClick={() => handleFocusWidget(row.id)}
                          onMouseDown={(event) => handleTrackerMouseDown(event, row)}
                          onPointerDown={(event) => handleTrackerPointerDown(event, row)}
                          onContextMenu={(event) => openActionMenu(event, row)}
                          onKeyDown={(event) => handleTrackerKeyDown(event, row)}
                          aria-label={`Focus ${row.primary}`}
                          title={`${row.primary} - ${group.label}. Right-click for actions.`}
                        >
                          <span className="workspace-tracker-icon-shell" aria-hidden="true">
                            <WorkspaceWidgetIcon kind={widget.kind} />
                          </span>
                          <span className="workspace-tracker-window-copy">
                            <span className="workspace-tracker-window-title">{row.primary}</span>
                            <small>{row.pinned ? 'Pinned' : row.secondary}</small>
                          </span>
                          <span className="workspace-tracker-state-light" aria-hidden="true" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <p className="workspace-tracker-empty">No windows</p>
      )}

      {actionMenuMarkup}
    </div>
  );
}

export const WorkspaceWindowTracker = memo(
  WorkspaceWindowTrackerComponent,
  (left, right) =>
    left.onFocusWidget === right.onFocusWidget &&
    left.onTogglePinWidget === right.onTogglePinWidget &&
    left.onCloseWidget === right.onCloseWidget &&
    getTrackerGroupsSignature(left.workspaceGroups) === getTrackerGroupsSignature(right.workspaceGroups),
);
