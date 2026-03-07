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
  let mockBrowserApi: { action: { setIcon: ReturnType<typeof vi.fn> } };

  beforeEach(() => {
    vi.clearAllMocks();
    mockConfig = {
      load: vi.fn().mockResolvedValue(undefined),
      isHostConfigured: vi.fn().mockReturnValue(true),
    };
    mockLogger = { debug: vi.fn() };
    mockBrowserApi = {
      action: { setIcon: vi.fn().mockResolvedValue(undefined) },
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
});
