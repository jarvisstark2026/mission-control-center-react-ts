import { useEffect, useRef, useState } from 'react';

export function useResponsiveRail() {
  const menuToggleRef = useRef<HTMLButtonElement | null>(null);
  const [isRailOpen, setIsRailOpen] = useState(false);

  const focusMenuToggle = () => {
    if (typeof window === 'undefined') return;

    window.requestAnimationFrame(() => {
      menuToggleRef.current?.focus();
    });
  };

  const closeRailOnMobile = () => {
    setIsRailOpen(false);
    focusMenuToggle();
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;

      setIsRailOpen((current) => {
        if (current) focusMenuToggle();
        return false;
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return {
    closeRailOnMobile,
    isRailOpen,
    menuToggleRef,
    setIsRailOpen,
  };
}
