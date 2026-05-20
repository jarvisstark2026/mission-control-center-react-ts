import type { ReactNode, RefObject, PointerEvent as ReactPointerEvent } from 'react';

export function WorkspaceCanvas({
  canvasRef,
  children,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: {
  canvasRef: RefObject<HTMLDivElement | null>;
  children: ReactNode;
  onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
}) {
  return (
    <div
      className="workspace-canvas"
      ref={canvasRef}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      {children}
    </div>
  );
}

export function WorkspaceAtmosphere() {
  return (
    <>
      <div className="workspace-atmosphere workspace-atmosphere-a" aria-hidden="true" />
      <div className="workspace-atmosphere workspace-atmosphere-b" aria-hidden="true" />
      <div className="workspace-grid" aria-hidden="true" />
    </>
  );
}
