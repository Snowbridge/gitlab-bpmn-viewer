import { vi } from "vitest";
import type { BrowserApi } from "@/types/types";

function listenerBag() {
  const list: Array<(...args: unknown[]) => void> = [];
  return {
    addListener: vi.fn((cb: (...args: unknown[]) => void) => {
      list.push(cb);
    }),
    hasListener: vi.fn(() => false),
    _listeners: list,
  };
}

/**
 * Creates a minimal BrowserApi mock for background script tests.
 * Returns the mock and a handle to inspect listeners and stub methods.
 */
export function createMockBrowser(): BrowserApi & {
  _tabsGet: ReturnType<typeof vi.fn>;
  _tabsQuery: ReturnType<typeof vi.fn>;
  _tabsSendMessage: ReturnType<typeof vi.fn>;
  _scriptingExecute: ReturnType<typeof vi.fn>;
  _actionSetIcon: ReturnType<typeof vi.fn>;
  _tabsOnUpdated: ReturnType<typeof listenerBag>;
  _tabsOnActivated: ReturnType<typeof listenerBag>;
  _storageOnChanged: ReturnType<typeof listenerBag>;
} {
  const tabsOnUpdated = listenerBag();
  const tabsOnActivated = listenerBag();
  const runtimeOnInstalled = listenerBag();
  const storageOnChanged = listenerBag();
  const webNavCommitted = listenerBag();
  const webNavHistory = listenerBag();

  const tabsGet = vi.fn().mockResolvedValue({ id: 1, url: undefined });
  const tabsQuery = vi.fn().mockResolvedValue([]);
  const tabsSendMessage = vi.fn().mockResolvedValue(undefined);
  const scriptingExecute = vi.fn().mockResolvedValue(undefined);
  const actionSetIcon = vi.fn().mockResolvedValue(undefined);

  const webNavCommittedAdd = vi.fn((cb: (d: { tabId?: number; url?: string }) => void) => {
    webNavCommitted.addListener(cb as (...args: unknown[]) => void);
  });
  const webNavHistoryAdd = vi.fn((cb: (d: { tabId?: number; url?: string }) => void) => {
    webNavHistory.addListener(cb as (...args: unknown[]) => void);
  });

  const api = {
    tabs: {
      onUpdated: tabsOnUpdated,
      onActivated: tabsOnActivated,
      get: tabsGet,
      query: tabsQuery,
      sendMessage: tabsSendMessage,
    },
    scripting: {
      executeScript: scriptingExecute,
    },
    webNavigation: {
      onCommitted: { addListener: webNavCommittedAdd, hasListener: vi.fn(() => false) },
      onHistoryStateUpdated: { addListener: webNavHistoryAdd, hasListener: vi.fn(() => false) },
    },
    storage: { onChanged: storageOnChanged },
    runtime: { onInstalled: runtimeOnInstalled },
    action: { setIcon: actionSetIcon },
    _tabsGet: tabsGet,
    _tabsQuery: tabsQuery,
    _tabsSendMessage: tabsSendMessage,
    _scriptingExecute: scriptingExecute,
    _actionSetIcon: actionSetIcon,
    _tabsOnUpdated: tabsOnUpdated,
    _tabsOnActivated: tabsOnActivated,
    _storageOnChanged: storageOnChanged,
  };

  return api as unknown as BrowserApi & typeof api;
}

export type MockBrowser = ReturnType<typeof createMockBrowser>;
