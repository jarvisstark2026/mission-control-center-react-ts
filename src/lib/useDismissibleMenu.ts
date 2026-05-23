import { useEffect, type RefObject } from 'react';

type DismissibleMenuRef = RefObject<HTMLElement | null>;

function toRefList(refs: DismissibleMenuRef | readonly DismissibleMenuRef[]) {
  return Array.isArray(refs) ? refs : [refs];
}

export function useDismissibleMenu(
  isOpen: boolean,
  refs: DismissibleMenuRef | readonly DismissibleMenuRef[],
  onDismiss: () => void,
) {
  useEffect(() => {
    if (!isOpen) return undefined;

    const refList = toRefList(refs);
    const containsTarget = (target: EventTarget | null) =>
      target instanceof Node && refList.some((ref) => ref.current?.contains(target));

    const dismissOnOutsidePointerDown = (event: PointerEvent) => {
      if (!containsTarget(event.target)) onDismiss();
    };

    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDismiss();
    };

    document.addEventListener('pointerdown', dismissOnOutsidePointerDown, true);
    document.addEventListener('keydown', dismissOnEscape);

    return () => {
      document.removeEventListener('pointerdown', dismissOnOutsidePointerDown, true);
      document.removeEventListener('keydown', dismissOnEscape);
    };
  }, [isOpen, onDismiss, refs]);
}
