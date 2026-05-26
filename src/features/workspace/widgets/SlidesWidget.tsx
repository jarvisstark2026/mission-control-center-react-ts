import { useState } from 'react';
import { WorkspaceCatalogGrid, WorkspaceContentHeader, WorkspaceContentShell, WorkspaceSectionFrame, WorkspaceStatusStrip } from '../workspaceBlocks';

export function SlidesWidget() {
  const slides = ['Vision', 'Stack', 'Workflows', 'Launch'];
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const activeSlide = slides[activeSlideIndex] ?? slides[0];

  const slideCards = slides.map((slide, index) => ({
    id: slide.toLowerCase(),
    label: `${index + 1}. ${slide}`,
    note: index === activeSlideIndex ? 'active frame' : 'jump to frame',
    badge: `frame ${index + 1}`,
    active: index === activeSlideIndex,
  }));

  return (
    <WorkspaceContentShell className="slides-surface">
      <WorkspaceContentHeader
        eyebrow="Slides"
        title="local presentation draft"
        metaEyebrow="frame"
        meta={`${activeSlideIndex + 1} / ${slides.length}`}
      />
      <WorkspaceStatusStrip source="local" status={activeSlide} count={`${slides.length} local frames`} updatedAt="draft" />
      <WorkspaceSectionFrame className="slides-stage" eyebrow="stage" title="active frame" meta="preview">
        <div className="slides-canvas">
          <strong>Presentation</strong>
          <p>{activeSlide}</p>
          <small>
            Frame {activeSlideIndex + 1} of {slides.length} - local draft
          </small>
        </div>
      </WorkspaceSectionFrame>
      <WorkspaceSectionFrame className="slides-strip-frame" eyebrow="slides" title="navigation" meta={`${slides.length} frames`}>
        <WorkspaceCatalogGrid
          className="slides-strip"
          variant="launcher"
          items={slideCards}
          ariaLabel="Slide navigation"
          onSelect={(item) => {
            const nextIndex = slides.findIndex((slide) => slide.toLowerCase() === item.id);
            if (nextIndex >= 0) {
              setActiveSlideIndex(nextIndex);
            }
          }}
        />
      </WorkspaceSectionFrame>
    </WorkspaceContentShell>
  );
}
