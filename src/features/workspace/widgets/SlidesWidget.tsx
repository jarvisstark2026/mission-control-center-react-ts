import { useState } from 'react';
import { WorkspaceCatalogGrid, WorkspaceContentHeader, WorkspaceContentShell, WorkspaceSectionFrame, WorkspaceSummaryPanel } from '../workspaceBlocks';

export function SlidesWidget() {
  const slides = ['Vision', 'Stack', 'Workflows', 'Launch'];
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const activeSlide = slides[activeSlideIndex] ?? slides[0];

  const slideCards = slides.map((slide, index) => ({
    id: slide.toLowerCase(),
    label: `${index + 1}. ${slide}`,
    note: index === activeSlideIndex ? 'active frame' : 'jump to frame',
    badge: `slide ${index + 1}`,
    active: index === activeSlideIndex,
  }));

  return (
    <WorkspaceContentShell className="slides-surface">
      <WorkspaceContentHeader
        eyebrow="Slides"
        title="presentation stage"
        metaEyebrow="slide"
        meta={`${activeSlideIndex + 1} / ${slides.length}`}
      />
      <WorkspaceSummaryPanel title={activeSlide}>
        Presentation staging for the command story, now sharing the same header and summary hierarchy as Markets.
      </WorkspaceSummaryPanel>
      <WorkspaceSectionFrame className="slides-stage" eyebrow="stage" title="active frame" meta="preview">
        <div className="slides-canvas">
          <strong>Presentation</strong>
          <p>{activeSlide}</p>
          <small>
            Slide {activeSlideIndex + 1} of {slides.length} - command story
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

