import { describe, expect, it } from 'vitest';

import { widgetWorkflowGuidance } from './workspaceWidgetGuidance';
import { workspaceWidgetKinds } from './workspaceTypes';

describe('workspaceWidgetGuidance', () => {
  it('defines workflow value cues for every widget kind', () => {
    expect(Object.keys(widgetWorkflowGuidance).sort()).toEqual([...workspaceWidgetKinds].sort());

    for (const kind of workspaceWidgetKinds) {
      const guidance = widgetWorkflowGuidance[kind];
      expect(guidance.intent.length).toBeGreaterThan(8);
      expect(guidance.value.length).toBeGreaterThan(24);
      expect(guidance.next.length).toBeGreaterThan(20);
      expect(guidance.evidence.length).toBeGreaterThan(4);
    }
  });
});
