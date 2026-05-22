import { describe, expect, it } from 'vitest';

import { calculatePartiallyOffscreenDragPosition } from './workspaceGeometry';

describe('workspace drag geometry', () => {
  it('allows partial top overflow by default', () => {
    expect(
      calculatePartiallyOffscreenDragPosition({
        proposedLeft: 20,
        proposedTop: -200,
        canvasWidth: 800,
        canvasHeight: 600,
        widgetWidth: 320,
        widgetHeight: 220,
      }),
    ).toMatchObject({
      left: 20,
      top: -162,
    });
  });

  it('can clamp the top edge to the canvas for open widgets', () => {
    expect(
      calculatePartiallyOffscreenDragPosition({
        proposedLeft: 20,
        proposedTop: -200,
        canvasWidth: 800,
        canvasHeight: 600,
        widgetWidth: 320,
        widgetHeight: 220,
        allowTopOverflow: false,
      }),
    ).toMatchObject({
      left: 20,
      top: 0,
    });
  });
});
