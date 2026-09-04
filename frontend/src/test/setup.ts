import "@testing-library/jest-dom/vitest";

// jsdom lacks matchMedia — provide a stub used by ThemeProvider + count-up.
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// ResizeObserver used by ResponsiveContainer (recharts) in tests that render charts.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
if (!("ResizeObserver" in window)) {
  (window as unknown as Record<string, unknown>).ResizeObserver = ResizeObserverStub;
}
