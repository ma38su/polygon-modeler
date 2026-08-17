import "@testing-library/jest-dom/vitest";

// Vitest evaluates Three's ESM entry separately for the app and CSG dependency
// even though Vite deduplicates them in the production bundle. Prevent Three's
// browser-only singleton probe from reporting that test-runner artifact.
Object.defineProperty(window, "__THREE__", {
  configurable: true,
  get: () => undefined,
  set: () => undefined,
});

Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
  configurable: true,
  value: () => null,
});

class ResizeObserverMock {
  observe() {}
  disconnect() {}
}

Object.defineProperty(globalThis, "ResizeObserver", {
  configurable: true,
  value: ResizeObserverMock,
});
