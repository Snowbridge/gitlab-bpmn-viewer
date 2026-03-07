import { describe, it, expect, vi, beforeEach } from "vitest";
import { BackgroundContentScriptsBootstraper } from "@/background/content-script-bootstraper";
import { MESSAGE_TYPE_BLOB_CONTENT_INIT } from "@/types/messages";
import type { BackgroundConfig } from "@/lib/configuration";
import type { Logger } from "@/lib/logger";
import type { BrowserApi } from "@/types/types";

vi.mock("@/lib/url-message-resolver", () => ({
  default: vi.fn((url: string) =>
    url.includes("/-/blob/") ? "gl-bpmn-viewer-content-init-blob" : url.includes("/-/merge_requests/") ? "gl-bpmn-viewer-content-init-diff" : undefined
  ),
}));

describe("BackgroundContentScriptsBootstraper", () => {
  let mockConfig: {
    load: ReturnType<typeof vi.fn>;
    isHostConfigured: ReturnType<typeof vi.fn>;
  };
  let mockLogger: { debug: ReturnType<typeof vi.fn> };
  let mockBrowserApi: {
    tabs: {
      sendMessage: ReturnType<typeof vi.fn>;
      query: ReturnType<typeof vi.fn>;
      get: ReturnType<typeof vi.fn>;
      onActivated: { addListener: ReturnType<typeof vi.fn> };
      onUpdated: { addListener: ReturnType<typeof vi.fn> };
    };
    scripting: { executeScript: ReturnType<typeof vi.fn> };
    webNavigation: {
      onCommitted: { addListener: ReturnType<typeof vi.fn> };
      onHistoryStateUpdated: { addListener: ReturnType<typeof vi.fn> };
    };
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
      tabs: {
        sendMessage: vi.fn().mockResolvedValue(undefined),
        query: vi.fn().mockResolvedValue([{ id: 1, url: "https://git.example.com/group/repo/-/blob/main/f.bpmn" }]),
        get: vi.fn().mockResolvedValue({ id: 1, url: "https://git.example.com/group/repo/-/blob/main/f.bpmn" }),
        onActivated: { addListener: vi.fn() },
        onUpdated: { addListener: vi.fn() },
      },
      scripting: { executeScript: vi.fn().mockResolvedValue(undefined) },
      webNavigation: {
        onCommitted: { addListener: vi.fn() },
        onHistoryStateUpdated: { addListener: vi.fn() },
      },
      storage: { onChanged: { addListener: vi.fn() } },
    };
  });

  it("sends content script trigger message when host configured and URL resolved", async () => {
    const bootstraper = new BackgroundContentScriptsBootstraper(
      mockBrowserApi as unknown as BrowserApi,
      mockConfig as unknown as BackgroundConfig,
      mockLogger as unknown as Logger
    );
    await bootstraper.checkUrlAndTriggerContentScript(
      1,
      "https://git.example.com/group/repo/-/blob/main/file.bpmn",
      "test"
    );
    expect(mockBrowserApi.tabs.sendMessage).toHaveBeenCalledWith(1, {
      type: MESSAGE_TYPE_BLOB_CONTENT_INIT,
      url: "https://git.example.com/group/repo/-/blob/main/file.bpmn",
      eventSource: "test",
    });
  });

  it("does not send message when host not configured", async () => {
    mockConfig.isHostConfigured.mockReturnValue(false);
    const bootstraper = new BackgroundContentScriptsBootstraper(
      mockBrowserApi as unknown as BrowserApi,
      mockConfig as unknown as BackgroundConfig,
      mockLogger as unknown as Logger
    );
    await bootstraper.checkUrlAndTriggerContentScript(
      1,
      "https://git.example.com/group/repo/-/blob/main/f.bpmn",
      "test"
    );
    expect(mockBrowserApi.tabs.sendMessage).not.toHaveBeenCalled();
  });

  it("propagateStorageUpdatedEvent sends config changed when tab URL resolved", async () => {
    const bootstraper = new BackgroundContentScriptsBootstraper(
      mockBrowserApi as unknown as BrowserApi,
      mockConfig as unknown as BackgroundConfig,
      mockLogger as unknown as Logger
    );
    await bootstraper.propagateStorageUpdatedEvent();
    expect(mockBrowserApi.tabs.sendMessage).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ type: "gl-bpmn-viewer-config-changed" })
    );
  });

  it("injectContentScript returns false when host not configured", async () => {
    mockConfig.isHostConfigured.mockReturnValue(false);
    const bootstraper = new BackgroundContentScriptsBootstraper(
      mockBrowserApi as unknown as BrowserApi,
      mockConfig as unknown as BackgroundConfig,
      mockLogger as unknown as Logger
    );
    const result = await bootstraper.injectContentScript(
      1,
      "https://other.com/group/repo/-/blob/main/f.bpmn"
    );
    expect(result).toBe(false);
  });

  it("tabs.onActivated listener calls checkUrlAndTriggerContentScript with onActivated", async () => {
    mockBrowserApi.tabs.get.mockResolvedValue({
      id: 10,
      url: "https://git.example.com/group/repo/-/blob/main/flow.bpmn",
    });
    const bootstraper = new BackgroundContentScriptsBootstraper(
      mockBrowserApi as unknown as BrowserApi,
      mockConfig as unknown as BackgroundConfig,
      mockLogger as unknown as Logger
    );
    BackgroundContentScriptsBootstraper.addGlobalSubscriptions(
      bootstraper,
      mockBrowserApi as unknown as BrowserApi
    );

    const addListener = vi.mocked(mockBrowserApi.tabs.onActivated.addListener);
    expect(addListener).toHaveBeenCalledWith(expect.any(Function));

    const callback = addListener.mock.calls[0][0];
    await callback({ tabId: 10 });
    await Promise.resolve();

    expect(mockBrowserApi.tabs.get).toHaveBeenCalledWith(10);
    expect(mockBrowserApi.tabs.sendMessage).toHaveBeenCalledWith(10, {
      type: "gl-bpmn-viewer-content-init-blob",
      url: "https://git.example.com/group/repo/-/blob/main/flow.bpmn",
      eventSource: "onActivated",
    });
  });

  it("tabs.onUpdated listener calls checkUrlAndTriggerContentScript with onUpdated[Complete] when status is complete", async () => {
    const bootstraper = new BackgroundContentScriptsBootstraper(
      mockBrowserApi as unknown as BrowserApi,
      mockConfig as unknown as BackgroundConfig,
      mockLogger as unknown as Logger
    );
    BackgroundContentScriptsBootstraper.addGlobalSubscriptions(
      bootstraper,
      mockBrowserApi as unknown as BrowserApi
    );

    const addListener = vi.mocked(mockBrowserApi.tabs.onUpdated.addListener);
    expect(addListener).toHaveBeenCalledWith(expect.any(Function));

    const callback = addListener.mock.calls[0][0];
    callback(
      7,
      { status: "complete" },
      { id: 7, url: "https://git.example.com/group/repo/-/merge_requests/3/diffs" }
    );
    await Promise.resolve();

    expect(mockBrowserApi.tabs.sendMessage).toHaveBeenCalledWith(7, {
      type: "gl-bpmn-viewer-content-init-diff",
      url: "https://git.example.com/group/repo/-/merge_requests/3/diffs",
      eventSource: "onUpdated[Complete]",
    });
  });

  it("storage.onChanged listener calls propagateStorageUpdatedEvent when areaName is local", async () => {
    const bootstraper = new BackgroundContentScriptsBootstraper(
      mockBrowserApi as unknown as BrowserApi,
      mockConfig as unknown as BackgroundConfig,
      mockLogger as unknown as Logger
    );
    BackgroundContentScriptsBootstraper.addGlobalSubscriptions(
      bootstraper,
      mockBrowserApi as unknown as BrowserApi
    );

    const addListener = vi.mocked(mockBrowserApi.storage.onChanged.addListener);
    expect(addListener).toHaveBeenCalledWith(expect.any(Function));

    const callback = addListener.mock.calls[0][0];
    await callback({}, "local");
    await Promise.resolve();

    expect(mockBrowserApi.tabs.query).toHaveBeenCalledWith({
      active: true,
      currentWindow: true,
    });
    expect(mockBrowserApi.tabs.sendMessage).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ type: "gl-bpmn-viewer-config-changed" })
    );
  });

  it("webNavigation.onCommitted listener calls checkUrlAndTriggerContentScript with onCommitted", async () => {
    const bootstraper = new BackgroundContentScriptsBootstraper(
      mockBrowserApi as unknown as BrowserApi,
      mockConfig as unknown as BackgroundConfig,
      mockLogger as unknown as Logger
    );
    BackgroundContentScriptsBootstraper.addGlobalSubscriptions(
      bootstraper,
      mockBrowserApi as unknown as BrowserApi
    );

    const addListener = vi.mocked(mockBrowserApi.webNavigation.onCommitted.addListener);
    expect(addListener).toHaveBeenCalledWith(expect.any(Function), {
      url: [{ urlContains: "/-/blob/" }, { urlContains: "/-/merge_requests/" }],
    });

    const callback = addListener.mock.calls[0][0];
    await callback({ tabId: 42, url: "https://git.example.com/group/repo/-/blob/main/diagram.bpmn" });
    await Promise.resolve();

    expect(mockBrowserApi.tabs.sendMessage).toHaveBeenCalledWith(42, {
      type: "gl-bpmn-viewer-content-init-blob",
      url: "https://git.example.com/group/repo/-/blob/main/diagram.bpmn",
      eventSource: "onCommitted",
    });
  });

  it("webNavigation.onHistoryStateUpdated listener calls checkUrlAndTriggerContentScript with onHistoryStateUpdated", async () => {
    const bootstraper = new BackgroundContentScriptsBootstraper(
      mockBrowserApi as unknown as BrowserApi,
      mockConfig as unknown as BackgroundConfig,
      mockLogger as unknown as Logger
    );
    BackgroundContentScriptsBootstraper.addGlobalSubscriptions(
      bootstraper,
      mockBrowserApi as unknown as BrowserApi
    );

    const addListener = vi.mocked(mockBrowserApi.webNavigation.onHistoryStateUpdated.addListener);
    expect(addListener).toHaveBeenCalledWith(expect.any(Function), {
      url: [{ urlContains: "/-/blob/" }, { urlContains: "/-/merge_requests/" }],
    });

    const callback = addListener.mock.calls[0][0];
    await callback({ tabId: 99, url: "https://git.example.com/group/repo/-/merge_requests/5/diffs" });
    await Promise.resolve();

    expect(mockBrowserApi.tabs.sendMessage).toHaveBeenCalledWith(99, {
      type: "gl-bpmn-viewer-content-init-diff",
      url: "https://git.example.com/group/repo/-/merge_requests/5/diffs",
      eventSource: "onHistoryStateUpdated",
    });
  });
});
