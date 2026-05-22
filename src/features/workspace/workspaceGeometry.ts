export type DragGeometryParams = {
  proposedLeft: number;
  proposedTop: number;
  canvasWidth: number;
  canvasHeight: number;
  widgetWidth: number;
  widgetHeight: number;
  allowTopOverflow?: boolean;
  minimumVisibleWidth?: number;
  minimumVisibleHeight?: number;
};

export type DragGeometryResult = {
  left: number;
  top: number;
};

export type CenterGeometryParams = {
  canvasWidth: number;
  canvasHeight: number;
  widgetWidth: number;
  widgetHeight: number;
  minimumMargin?: number;
};

const defaultMinimumVisibleWidth = 96;
const defaultMinimumVisibleHeight = 58;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, max));
}

function normalizeVisibleMargin(value: number | undefined, fallback: number, widgetSize: number, canvasSize: number) {
  const finiteValue = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  const maximumUsefulMargin = Math.max(1, Math.min(widgetSize, canvasSize || widgetSize));
  return clamp(finiteValue, 1, maximumUsefulMargin);
}

export function calculatePartiallyOffscreenDragPosition({
  proposedLeft,
  proposedTop,
  canvasWidth,
  canvasHeight,
  widgetWidth,
  widgetHeight,
  allowTopOverflow = true,
  minimumVisibleWidth,
  minimumVisibleHeight,
}: DragGeometryParams): DragGeometryResult {
  const visibleWidth = normalizeVisibleMargin(minimumVisibleWidth, defaultMinimumVisibleWidth, widgetWidth, canvasWidth);
  const visibleHeight = normalizeVisibleMargin(minimumVisibleHeight, defaultMinimumVisibleHeight, widgetHeight, canvasHeight);

  const minLeft = -Math.max(0, widgetWidth - visibleWidth);
  const maxLeft = Math.max(0, canvasWidth - visibleWidth);
  const minTop = allowTopOverflow ? -Math.max(0, widgetHeight - visibleHeight) : 0;
  const maxTop = Math.max(0, canvasHeight - visibleHeight);

  return {
    left: clamp(proposedLeft, minLeft, maxLeft),
    top: clamp(proposedTop, minTop, maxTop),
  };
}

export function calculateCenteredWidgetPosition({
  canvasWidth,
  canvasHeight,
  widgetWidth,
  widgetHeight,
  minimumMargin = 24,
}: CenterGeometryParams): DragGeometryResult {
  const effectiveCanvasWidth = Math.max(widgetWidth, canvasWidth);
  const effectiveCanvasHeight = Math.max(widgetHeight, canvasHeight);
  const margin = Math.max(0, minimumMargin);

  return {
    left: Math.max(margin, Math.round((effectiveCanvasWidth - widgetWidth) / 2)),
    top: Math.max(margin, Math.round((effectiveCanvasHeight - widgetHeight) / 2)),
  };
}
