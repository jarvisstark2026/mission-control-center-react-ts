import { WorkspaceButton, WorkspaceCatalogGrid, WorkspaceContentShell, WorkspaceSectionFrame, WorkspaceStatusStrip } from '../workspaceBlocks';
import { addSlideFrame, loadLocalSlidesState, removeSlideFrame, saveLocalSlidesState, selectSlideFrame, updateSlideFrame } from '../workspaceEvidenceModel';
import { usePersistentWorkspaceState } from '../usePersistentWorkspaceState';
import { WorkspaceEvidenceAttachPanel } from '../WorkspaceEvidenceAttachPanel';
import type { OperationalOsRuntime } from '../../operational-os';
import type { ShellRole } from '../../shell/roles';

export function SlidesWidget({ role, operationalOs }: { role: ShellRole; operationalOs: OperationalOsRuntime }) {
  const [slides, setSlides] = usePersistentWorkspaceState(loadLocalSlidesState, saveLocalSlidesState);
  const activeSlide = slides.frames.find((frame) => frame.id === slides.activeFrameId) ?? slides.frames[0];
  const updatedTime = new Date(slides.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const slideCards = slides.frames.map((slide, index) => ({
    id: slide.id,
    label: `${index + 1}. ${slide.title}`,
    note: index === slides.frames.findIndex((frame) => frame.id === activeSlide.id) ? 'active frame' : 'jump to frame',
    badge: `frame ${index + 1}`,
    active: slide.id === activeSlide.id,
  }));

  return (
    <WorkspaceContentShell className="slides-surface">
      <WorkspaceStatusStrip source="local" status={activeSlide.title} count={`${slides.frames.length} local frames`} updatedAt={`saved ${updatedTime}`} />
      <WorkspaceEvidenceAttachPanel
        role={role}
        operationalOs={operationalOs}
        evidence={{
          type: 'note',
          title: `Slide: ${activeSlide.title}`,
          source: 'slides-widget',
          summary: activeSlide.body,
        }}
      />
      <WorkspaceSectionFrame className="slides-stage" eyebrow="stage" title="active frame" meta="editable">
        <div className="slides-canvas">
          <input
            className="slides-title-input"
            aria-label="Slide title"
            value={activeSlide.title}
            onChange={(event) => setSlides((current) => updateSlideFrame(current, activeSlide.id, { title: event.target.value }))}
          />
          <textarea
            className="slides-body-input"
            aria-label="Slide body"
            value={activeSlide.body}
            onChange={(event) => setSlides((current) => updateSlideFrame(current, activeSlide.id, { body: event.target.value }))}
          />
          <small>
            Frame {slides.frames.findIndex((frame) => frame.id === activeSlide.id) + 1} of {slides.frames.length} - local draft
          </small>
        </div>
      </WorkspaceSectionFrame>
      <WorkspaceSectionFrame className="slides-strip-frame" eyebrow="slides" title="navigation" meta={`${slides.frames.length} frames`}>
        <div className="slides-action-row">
          <WorkspaceButton variant="compact" onClick={() => setSlides((current) => addSlideFrame(current))}>
            Add frame
          </WorkspaceButton>
          <WorkspaceButton variant="compact" disabled={slides.frames.length <= 1} onClick={() => setSlides((current) => removeSlideFrame(current, activeSlide.id))}>
            Delete frame
          </WorkspaceButton>
        </div>
        <WorkspaceCatalogGrid
          className="slides-strip"
          variant="launcher"
          items={slideCards}
          ariaLabel="Slide navigation"
          onSelect={(item) => setSlides((current) => selectSlideFrame(current, item.id))}
        />
      </WorkspaceSectionFrame>
    </WorkspaceContentShell>
  );
}
