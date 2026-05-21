import '@testing-library/jest-dom/vitest';

class TestResizeObserver implements ResizeObserver {
  disconnect() {}
  observe() {}
  unobserve() {}
}

globalThis.ResizeObserver = TestResizeObserver;

HTMLMediaElement.prototype.pause = () => {};
HTMLMediaElement.prototype.load = () => {};
