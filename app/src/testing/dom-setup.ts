// Setup for the component project (ADR 0038). jsdom lacks these
// globals, and React Native Web reads them at render time. Testing
// Library cleans up after each test only when `afterEach` is a global,
// and this config keeps globals off, so the cleanup is wired here.
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Metro's bundle prelude defines this flag, and React Native libraries
// read it at module scope.
(globalThis as { __DEV__?: boolean }).__DEV__ = true;

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

window.matchMedia ??= (query: string) =>
  ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }) as unknown as MediaQueryList;

afterEach(cleanup);
