import "@testing-library/jest-dom";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Ensure DOM cleanup after each test to prevent memory leaks
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Mock @wailsio/runtime - the bindings depend on this
const createIdentity = (x: unknown) => x;
const createArrayFactory = () => (arr: unknown) => arr;
const createMapFactory = () => (obj: unknown) => obj;
const createNullableFactory = () => (val: unknown) => val;

vi.mock("@wailsio/runtime", () => ({
  Call: {
    ByID: vi.fn(() => Promise.resolve({})),
    ByName: vi.fn(() => Promise.resolve({})),
  },
  CancellablePromise: Promise,
  Create: {
    Any: createIdentity,
    Array: createArrayFactory,
    Map: createMapFactory,
    Nullable: createNullableFactory,
    Struct: () => createIdentity,
  },
  Events: {
    On: vi.fn(() => () => {}),
    Emit: vi.fn(),
    Off: vi.fn(),
  },
  Browser: {
    OpenURL: vi.fn(() => Promise.resolve()),
  },
  System: {
    IsMac: vi.fn(() => false),
    IsWindows: vi.fn(() => true),
    IsLinux: vi.fn(() => false),
  },
}));

Object.defineProperty(window.navigator, "platform", {
  value: "Win32",
  configurable: true,
});

class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (!("ResizeObserver" in window)) {
  // @ts-ignore
  window.ResizeObserver = MockResizeObserver;
}

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
