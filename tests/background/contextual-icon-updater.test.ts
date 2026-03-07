import { describe, it, expect, vi, beforeEach } from "vitest";
import { ContextualIconUpdater } from "@/background/contextual-icon-updater";
import type { BackgroundConfig } from "@/lib/configuration";
import { createMockBrowser } from "./create-mock-browser";

describe("ContextualIconUpdater", () => {
  let mockBrowser: ReturnType<typeof createMockBrowser>;
  let mockConfig: BackgroundConfig;

  beforeEach(() => {
    mockBrowser = createMockBrowser();
    mockConfig = {
      load: vi.fn().mockResolvedValue(undefined),
      isHostConfigured: vi.fn().mockReturnValue(false),
    } as unknown as BackgroundConfig;
  });

  it("subscribes to tabs.onUpdated, tabs.onActivated, runtime.onInstalled, storage.onChanged", () => {
    new ContextualIconUpdater(mockConfig, mockBrowser);

    expect(mockBrowser.tabs.onUpdated.addListener).toHaveBeenCalled();
    expect(mockBrowser.tabs.onActivated.addListener).toHaveBeenCalled();
    expect(mockBrowser.runtime.onInstalled.addListener).toHaveBeenCalled();
    expect(mockBrowser.storage.onChanged.addListener).toHaveBeenCalled();
  });

  it("updateIconForTab sets disabled icon when url is not configured", async () => {
    vi.mocked(mockConfig.isHostConfigured).mockReturnValue(false);
    const updater = new ContextualIconUpdater(mockConfig, mockBrowser);

    await updater.updateIconForTab(1, "https://git.example.com/foo/-/blob/main/x.bpmn");

    expect(mockConfig.load).toHaveBeenCalled();
    expect(mockConfig.isHostConfigured).toHaveBeenCalledWith("https://git.example.com/foo/-/blob/main/x.bpmn");
    expect(mockBrowser.action.setIcon).toHaveBeenCalledWith({
      tabId: 1,
      path: "/icons/icon16gray.png",
    });
  });

  it("updateIconForTab sets enabled icon when url is configured", async () => {
    vi.mocked(mockConfig.isHostConfigured).mockReturnValue(true);
    const updater = new ContextualIconUpdater(mockConfig, mockBrowser);

    await updater.updateIconForTab(2, "https://git.example.com/foo/-/blob/main/x.bpmn");

    expect(mockBrowser.action.setIcon).toHaveBeenCalledWith({
      tabId: 2,
      path: "/icons/icon16.png",
    });
  });

  it("updateIconForTab sets disabled icon when url is undefined", async () => {
    const updater = new ContextualIconUpdater(mockConfig, mockBrowser);

    await updater.updateIconForTab(3, undefined);

    expect(mockBrowser.action.setIcon).toHaveBeenCalledWith({
      tabId: 3,
      path: "/icons/icon16gray.png",
    });
  });

  it("init queries active tab and updates icon when tab has id and url", async () => {
    mockBrowser._tabsQuery.mockResolvedValue([{ id: 10, url: "https://git.test.com/a/-/blob/main/f.bpmn" }]);
    vi.mocked(mockConfig.isHostConfigured).mockReturnValue(true);
    const updater = new ContextualIconUpdater(mockConfig, mockBrowser);

    await updater.init();

    expect(mockBrowser.tabs.query).toHaveBeenCalledWith({
      active: true,
      currentWindow: true,
    });
    expect(mockBrowser.action.setIcon).toHaveBeenCalledWith({
      tabId: 10,
      path: "/icons/icon16.png",
    });
  });

  it("init does not call setIcon when no tab is returned", async () => {
    mockBrowser._tabsQuery.mockResolvedValue([]);
    const updater = new ContextualIconUpdater(mockConfig, mockBrowser);

    await updater.init();

    expect(mockBrowser.action.setIcon).not.toHaveBeenCalled();
  });

  it("init does not call setIcon when tab has no id", async () => {
    mockBrowser._tabsQuery.mockResolvedValue([{ url: "https://x.com" }]);
    const updater = new ContextualIconUpdater(mockConfig, mockBrowser);

    await updater.init();

    expect(mockBrowser.action.setIcon).not.toHaveBeenCalled();
  });

  it("onUpdated listener calls updateIconForTab with tab id and url", async () => {
    const updater = new ContextualIconUpdater(mockConfig, mockBrowser);
    const listeners = (mockBrowser._tabsOnUpdated.addListener as ReturnType<typeof vi.fn>).mock
      .calls as Array<[ (tabId: number, _changeInfo: unknown, tab: { url?: string }) => Promise<void> ]>;
    const onUpdatedHandler = listeners.find(
      (c) => c[0].length === 3
    )?.[0] as (tabId: number, _changeInfo: unknown, tab: { url?: string }) => Promise<void>;

    expect(onUpdatedHandler).toBeDefined();
    await onUpdatedHandler(5, {}, { url: "https://git.example.com/repo/-/blob/main/d.bpmn" });

    expect(mockConfig.load).toHaveBeenCalled();
    expect(mockBrowser.action.setIcon).toHaveBeenCalled();
  });

  it("onActivated listener fetches tab and calls updateIconForTab", async () => {
    mockBrowser._tabsGet.mockResolvedValue({ id: 7, url: "https://git.example.com/p/-/blob/main/y.bpmn" });
    const updater = new ContextualIconUpdater(mockConfig, mockBrowser);
    const listeners = (mockBrowser._tabsOnActivated.addListener as ReturnType<typeof vi.fn>).mock
      .calls as Array<[ (activeInfo: { tabId: number }) => Promise<void> ]>;
    const onActivatedHandler = listeners.find((c) => c[0].length === 1)?.[0];

    expect(onActivatedHandler).toBeDefined();
    await onActivatedHandler!({ tabId: 7 });
    await new Promise((r) => setImmediate(r));

    expect(mockBrowser.tabs.get).toHaveBeenCalledWith(7);
    expect(mockBrowser.action.setIcon).toHaveBeenCalled();
  });

  it("storage.onChanged listener with areaName local calls init", async () => {
    mockBrowser._tabsQuery.mockResolvedValue([{ id: 1, url: "https://x.com" }]);
    const updater = new ContextualIconUpdater(mockConfig, mockBrowser);
    const listeners = (mockBrowser._storageOnChanged.addListener as ReturnType<typeof vi.fn>).mock
      .calls as Array<[ (changes: unknown, areaName: string) => Promise<void> ]>;
    const storageHandler = listeners[1]?.[0];

    expect(storageHandler).toBeDefined();
    await storageHandler!({}, "local");
    await new Promise((r) => setImmediate(r));

    expect(mockBrowser.tabs.query).toHaveBeenCalled();
  });

  it("storage.onChanged listener with areaName sync does not query tabs", async () => {
    const updater = new ContextualIconUpdater(mockConfig, mockBrowser);
    const listeners = (mockBrowser._storageOnChanged.addListener as ReturnType<typeof vi.fn>).mock
      .calls as Array<[ (changes: unknown, areaName: string) => Promise<void> ]>;
    const storageHandler = listeners[0]?.[0];

    await storageHandler!({}, "sync");

    expect(mockBrowser.tabs.query).not.toHaveBeenCalled();
  });
});
