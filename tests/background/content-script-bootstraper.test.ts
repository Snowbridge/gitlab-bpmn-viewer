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
    tabs: { sendMessage: ReturnType<typeof vi.fn>; query: ReturnType<typeof vi.fn> };
    scripting: { executeScript: ReturnType<typeof vi.fn> };
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
      },
      scripting: { executeScript: vi.fn().mockResolvedValue(undefined) },
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
});
