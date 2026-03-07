import { vi } from "vitest";

/**
 * Global mocks so that background and other modules loading webextension-polyfill or configuration do not throw in Node.
 */
vi.mock("webextension-polyfill", () => ({
  default: {
    storage: {
      local: { get: () => Promise.resolve({}), set: () => Promise.resolve() },
      onChanged: { addListener: () => {}, hasListener: () => false },
    },
    tabs: {
      get: () => Promise.resolve({}),
      query: () => Promise.resolve([]),
      sendMessage: () => Promise.resolve(),
      onActivated: { addListener: () => {}, hasListener: () => false },
      onUpdated: { addListener: () => {}, hasListener: () => false },
    },
    runtime: { onInstalled: { addListener: () => {}, hasListener: () => false } },
    action: { setIcon: () => Promise.resolve() },
    scripting: { executeScript: () => Promise.resolve() },
    webNavigation: {
      onCommitted: { addListener: () => {}, hasListener: () => false },
      onHistoryStateUpdated: { addListener: () => {}, hasListener: () => false },
    },
  },
}));

vi.mock("@/lib/configuration", () => ({
  BackgroundConfig: vi.fn().mockImplementation(() => ({
    load: vi.fn().mockResolvedValue(undefined),
    isHostConfigured: vi.fn().mockReturnValue(false),
    isDebugEnabled: vi.fn().mockReturnValue(false),
    isDebugStackIncluded: vi.fn().mockReturnValue(false),
  })),
}));
