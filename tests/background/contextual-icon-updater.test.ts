import { describe, it, expect, vi, beforeEach } from "vitest";
import { ContextualIconUpdater } from "@/background/contextual-icon-updater";
import type { BackgroundConfig } from "@/lib/configuration";
import type { Logger } from "@/lib/logger";
import type { BrowserApi } from "@/types/types";

describe("ContextualIconUpdater", () => {
  let mockConfig: {
    load: ReturnType<typeof vi.fn>;
    isHostConfigured: ReturnType<typeof vi.fn>;
  };
  let mockLogger: { debug: ReturnType<typeof vi.fn> };
  let mockBrowserApi: {
    action: { setIcon: ReturnType<typeof vi.fn> };
    tabs: {
      onUpdated: { addListener: ReturnType<typeof vi.fn> };
      onActivated: { addListener: ReturnType<typeof vi.fn> };
      get: ReturnType<typeof vi.fn>;
      query: ReturnType<typeof vi.fn>;
    };
    runtime: { onInstalled: { addListener: ReturnType<typeof vi.fn> } };
    storage: { onChanged: { addListener: ReturnType<typeof vi.fn> } };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockConfig = {
      load: vi.fn().mockResolvedValue(undefined),
      isHostConfigured: vi.fn().mockReturnValue(true),
    };
    mockLogger = { debug: vi.fn() };
    mockBrowserApi = {
      action: { setIcon: vi.fn().mockResolvedValue(undefined) },
      tabs: {
        onUpdated: { addListener: vi.fn() },
        onActivated: { addListener: vi.fn() },
        get: vi.fn().mockResolvedValue({ id: 1, url: "https://git.example.com/group/repo" }),
        query: vi.fn().mockResolvedValue([{ id: 2, url: "https://git.example.com/group/repo/-/blob/main/f.bpmn" }]),
      },
      runtime: { onInstalled: { addListener: vi.fn() } },
      storage: { onChanged: { addListener: vi.fn() } },
    };
  });

  it("sets enabled icon when host is configured", async () => {
    mockConfig.isHostConfigured.mockReturnValue(true);
    const updater = new ContextualIconUpdater(
      mockBrowserApi as unknown as BrowserApi,
      mockConfig as unknown as BackgroundConfig,
      mockLogger as unknown as Logger
    );
    await updater.updateIconForTab(1, "https://git.example.com/group/repo", "test");
    expect(mockBrowserApi.action.setIcon).toHaveBeenCalledWith({
      tabId: 1,
      path: "/icons/icon16.png",
    });
  });

  it("sets disabled icon when host is not configured", async () => {
    mockConfig.isHostConfigured.mockReturnValue(false);
    const updater = new ContextualIconUpdater(
      mockBrowserApi as unknown as BrowserApi,
      mockConfig as unknown as BackgroundConfig,
      mockLogger as unknown as Logger
    );
    await updater.updateIconForTab(1, "https://other.com", "test");
    expect(mockBrowserApi.action.setIcon).toHaveBeenCalledWith({
      tabId: 1,
      path: "/icons/icon16gray.png",
    });
  });

  it("calls config.load before checking host", async () => {
    const updater = new ContextualIconUpdater(
      mockBrowserApi as unknown as BrowserApi,
      mockConfig as unknown as BackgroundConfig,
      mockLogger as unknown as Logger
    );
    await updater.updateIconForTab(1, "https://git.example.com", "test");
    expect(mockConfig.load).toHaveBeenCalled();
  });

  it("tabs.onUpdated listener calls updateIconForTab with tabs.onUpdated", async () => {
    const updater = new ContextualIconUpdater(
      mockBrowserApi as unknown as BrowserApi,
      mockConfig as unknown as BackgroundConfig,
      mockLogger as unknown as Logger
    );
    ContextualIconUpdater.addGlobalSubscriptions(updater, mockBrowserApi as unknown as BrowserApi);

    const addListener = vi.mocked(mockBrowserApi.tabs.onUpdated.addListener);
    expect(addListener).toHaveBeenCalledWith(expect.any(Function));

    const callback = addListener.mock.calls[0][0];
    await callback(5, {} as never, { id: 5, url: "https://git.example.com/group/repo/-/blob/main/d.bpmn" } as never);
    await Promise.resolve();

    expect(mockBrowserApi.action.setIcon).toHaveBeenCalledWith({
      tabId: 5,
      path: "/icons/icon16.png",
    });
  });

  it("tabs.onActivated listener calls updateIconForTab with tabs.onActivated", async () => {
    mockBrowserApi.tabs.get.mockResolvedValue({
      id: 10,
      url: "https://git.example.com/group/repo/-/merge_requests/1/diffs",
    } as never);
    const updater = new ContextualIconUpdater(
      mockBrowserApi as unknown as BrowserApi,
      mockConfig as unknown as BackgroundConfig,
      mockLogger as unknown as Logger
    );
    ContextualIconUpdater.addGlobalSubscriptions(updater, mockBrowserApi as unknown as BrowserApi);

    const addListener = vi.mocked(mockBrowserApi.tabs.onActivated.addListener);
    expect(addListener).toHaveBeenCalledWith(expect.any(Function));

    const callback = addListener.mock.calls[0][0];
    await callback({ tabId: 10 } as never);
    await Promise.resolve();

    expect(mockBrowserApi.tabs.get).toHaveBeenCalledWith(10);
    expect(mockBrowserApi.action.setIcon).toHaveBeenCalledWith({
      tabId: 10,
      path: "/icons/icon16.png",
    });
  });

  it("runtime.onInstalled listener calls updateIconForTab with runtime.onInstalled", async () => {
    mockBrowserApi.tabs.query.mockResolvedValue([
      { id: 3, url: "https://git.example.com/group/repo/-/blob/main/x.bpmn" },
    ] as never);
    const updater = new ContextualIconUpdater(
      mockBrowserApi as unknown as BrowserApi,
      mockConfig as unknown as BackgroundConfig,
      mockLogger as unknown as Logger
    );
    ContextualIconUpdater.addGlobalSubscriptions(updater, mockBrowserApi as unknown as BrowserApi);

    const addListener = vi.mocked(mockBrowserApi.runtime.onInstalled.addListener);
    expect(addListener).toHaveBeenCalledWith(expect.any(Function));

    const callback = addListener.mock.calls[0][0];
    await callback({} as never);
    await Promise.resolve();

    expect(mockBrowserApi.tabs.query).toHaveBeenCalledWith({
      active: true,
      currentWindow: true,
    });
    expect(mockBrowserApi.action.setIcon).toHaveBeenCalledWith({
      tabId: 3,
      path: "/icons/icon16.png",
    });
  });

  it("storage.onChanged listener calls updateIconForTab when areaName is local", async () => {
    mockBrowserApi.tabs.query.mockResolvedValue([
      { id: 7, url: "https://git.example.com/group/repo/-/blob/main/y.bpmn" },
    ] as never);
    const updater = new ContextualIconUpdater(
      mockBrowserApi as unknown as BrowserApi,
      mockConfig as unknown as BackgroundConfig,
      mockLogger as unknown as Logger
    );
    ContextualIconUpdater.addGlobalSubscriptions(updater, mockBrowserApi as unknown as BrowserApi);

    const addListener = vi.mocked(mockBrowserApi.storage.onChanged.addListener);
    expect(addListener).toHaveBeenCalledWith(expect.any(Function));

    const callback = addListener.mock.calls[0][0];
    await callback({} as never, "local");
    await Promise.resolve();

    expect(mockBrowserApi.tabs.query).toHaveBeenCalledWith({
      active: true,
      currentWindow: true,
    });
    expect(mockBrowserApi.action.setIcon).toHaveBeenCalledWith({
      tabId: 7,
      path: "/icons/icon16.png",
    });
  });
});
