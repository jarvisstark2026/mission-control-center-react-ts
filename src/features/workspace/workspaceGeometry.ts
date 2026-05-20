export type DragGeometryParams = {
  proposedLeft: number;
  proposedTop: number;
  canvasWidth: number;
  canvasHeight: number;
  widgetWidth: number;
  widgetHeight: number;
  minimumVisibleWidth?: number;
  minimumVisibleHeight?: number;
};

export type DragGeometryResult = {
  left: number;
  top: number;
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
  minimumVisibleWidth,
  minimumVisibleHeight,
}: DragGeometryParams): DragGeometryResult {
  const visibleWidth = normalizeVisibleMargin(minimumVisibleWidth, defaultMinimumVisibleWidth, widgetWidth, canvasWidth);
  const visibleHeight = normalizeVisibleMargin(minimumVisibleHeight, defaultMinimumVisibleHeight, widgetHeight, canvasHeight);

  const minLeft = -Math.max(0, widgetWidth - visibleWidth);
  const maxLeft = Math.max(0, canvasWidth - visibleWidth);
  const minTop = -Math.max(0, widgetHeight - visibleHeight);
  const maxTop = Math.max(0, canvasHeight - visibleHeight);

  return {
    left: clamp(proposedLeft, minLeft, maxLeft),
    top: clamp(proposedTop, minTop, maxTop),
  };
}
