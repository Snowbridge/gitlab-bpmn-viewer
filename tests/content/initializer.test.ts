import { describe, it, expect, vi, beforeEach } from "vitest";
import { ContentScriptInitializer } from "@/content/initializer";
import {
  MESSAGE_TYPE_BLOB_CONTENT_INIT,
  MESSAGE_TYPE_DIFF_CONTENT_INIT,
} from "@/types/messages";
import type { ForegroundConfig } from "@/lib/configuration";
import type { Logger } from "@/lib/logger";
import type { BrowserApi } from "@/types/types";

describe("ContentScriptInitializer", () => {
  let mockConfig: {
    load: ReturnType<typeof vi.fn>;
    isHostConfigured: ReturnType<typeof vi.fn>;
  };
  let mockLogger: { debug: ReturnType<typeof vi.fn> };
  let mockBrowserApi: {
    runtime: { sendMessage: ReturnType<typeof vi.fn>; onMessage: { addListener: ReturnType<typeof vi.fn> } };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockConfig = {
      load: vi.fn().mockResolvedValue(undefined),
      isHostConfigured: vi.fn().mockReturnValue(true),
    };
    mockLogger = { debug: vi.fn() };
    mockBrowserApi = {
      runtime: {
        sendMessage: vi.fn().mockResolvedValue(undefined),
        onMessage: { addListener: vi.fn() },
      },
    };
  });

  it("alertBackgroundOnReady sends MESSAGE_TYPE_CONTENT_SCRIPT_READY", async () => {
    const initializer = new ContentScriptInitializer(
      mockBrowserApi as unknown as BrowserApi,
      mockConfig as unknown as ForegroundConfig,
      mockLogger as unknown as Logger
    );
    await initializer.alertBackgroundOnReady();
    expect(mockBrowserApi.runtime.sendMessage).toHaveBeenCalledWith({
      type: "gl-bpmn-viewer-content-script-ready",
      url: expect.any(String),
    });
  });

  it("processMessageFromBackground does nothing when message has no type", async () => {
    const initializer = new ContentScriptInitializer(
      mockBrowserApi as unknown as BrowserApi,
      mockConfig as unknown as ForegroundConfig,
      mockLogger as unknown as Logger
    );
    await initializer.processMessageFromBackground({ url: "https://git.example.com" } as any);
    expect(mockConfig.load).not.toHaveBeenCalled();
  });

  it("processMessageFromBackground does nothing when host not configured", async () => {
    mockConfig.isHostConfigured.mockReturnValue(false);
    const initializer = new ContentScriptInitializer(
      mockBrowserApi as unknown as BrowserApi,
      mockConfig as unknown as ForegroundConfig,
      mockLogger as unknown as Logger
    );
    await initializer.processMessageFromBackground({
      type: MESSAGE_TYPE_BLOB_CONTENT_INIT,
      url: "https://other.com/group/repo/-/blob/main/f.bpmn",
    } as any);
    expect(mockConfig.isHostConfigured).toHaveBeenCalled();
  });

  it("addGlobalSubscription registers onMessage listener", () => {
    const initializer = new ContentScriptInitializer(
      mockBrowserApi as unknown as BrowserApi,
      mockConfig as unknown as ForegroundConfig,
      mockLogger as unknown as Logger
    );
    ContentScriptInitializer.addGlobalSubscription(
      initializer,
      mockBrowserApi as unknown as BrowserApi
    );
    expect(mockBrowserApi.runtime.onMessage.addListener).toHaveBeenCalledWith(
      expect.any(Function)
    );
  });
});
