import { useEffect, useRef, useState } from 'react';

export const railBreakpoint = 900;

function isMobileRailViewport() {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia(`(max-width: ${railBreakpoint}px)`).matches;
}

export function useResponsiveRail() {
  const menuToggleRef = useRef<HTMLButtonElement | null>(null);
  const [isRailOpen, setIsRailOpen] = useState(() => !isMobileRailViewport());

  const focusMenuToggle = () => {
    if (typeof window === 'undefined') return;

    window.requestAnimationFrame(() => {
      menuToggleRef.current?.focus();
    });
  };

  const closeRailOnMobile = () => {
    if (!isMobileRailViewport()) return;

    setIsRailOpen(false);
    focusMenuToggle();
  };

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

    const media = window.matchMedia(`(max-width: ${railBreakpoint}px)`);
    const syncRailState = () => setIsRailOpen(!media.matches);

    syncRailState();

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', syncRailState);
      return () => media.removeEventListener('change', syncRailState);
    }

    media.addListener(syncRailState);
    return () => media.removeListener(syncRailState);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !isMobileRailViewport()) return;

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
