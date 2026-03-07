import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockBrowser } from "./create-mock-browser";
import type { BackgroundConfig } from "@/lib/configuration";

const mockBrowserForLoad = createMockBrowser();

vi.mock("webextension-polyfill", () => ({
  default: mockBrowserForLoad,
}));

vi.mock("@/lib/configuration", () => ({
  BackgroundConfig: vi.fn().mockImplementation(() => ({
    load: vi.fn().mockResolvedValue(undefined),
    isHostConfigured: vi.fn().mockReturnValue(false),
    isDebugEnabled: vi.fn().mockReturnValue(false),
    isDebugStackIncluded: vi.fn().mockReturnValue(false),
  })),
}));

const { runBackgroundScript } = await import("@/background/index");

describe("runBackgroundScript", () => {
  let mockBrowser: ReturnType<typeof createMockBrowser>;
  let mockConfig: BackgroundConfig;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockBrowser = createMockBrowser();
    mockConfig = {
      load: vi.fn().mockResolvedValue(undefined),
      isHostConfigured: vi.fn().mockReturnValue(true),
    } as unknown as BackgroundConfig;
  });

  it("registers tabs.onActivated listener", async () => {
    await runBackgroundScript(mockBrowser, mockConfig);

    expect(mockBrowser.tabs.onActivated.addListener).toHaveBeenCalled();
  });

  it("registers tabs.onUpdated listener", async () => {
    await runBackgroundScript(mockBrowser, mockConfig);

    expect(mockBrowser.tabs.onUpdated.addListener).toHaveBeenCalled();
  });

  it("registers webNavigation.onCommitted and onHistoryStateUpdated", async () => {
    await runBackgroundScript(mockBrowser, mockConfig);

    expect(mockBrowser.webNavigation.onCommitted.addListener).toHaveBeenCalled();
    expect(mockBrowser.webNavigation.onHistoryStateUpdated.addListener).toHaveBeenCalled();
  });

  it("registers storage.onChanged listener", async () => {
    await runBackgroundScript(mockBrowser, mockConfig);

    expect(mockBrowser.storage.onChanged.addListener).toHaveBeenCalled();
  });

  it("calls config.load and creates ContextualIconUpdater (tabs.query and action.setIcon called)", async () => {
    mockBrowser._tabsQuery.mockResolvedValue([{ id: 1, url: "https://git.test.com/a/-/blob/main/f.bpmn" }]);
    vi.mocked(mockConfig.load).mockResolvedValue(undefined as never);
    vi.mocked(mockConfig.isHostConfigured).mockReturnValue(true);

    await runBackgroundScript(mockBrowser, mockConfig);

    expect(mockConfig.load).toHaveBeenCalled();
    expect(mockBrowser.tabs.query).toHaveBeenCalledWith({
      active: true,
      currentWindow: true,
    });
    expect(mockBrowser.action.setIcon).toHaveBeenCalled();
  });

  it("onActivated listener gets tab and calls sendMessage when url is configured and resolved", async () => {
    mockBrowser._tabsGet.mockResolvedValue({
      id: 10,
      url: "https://git.example.com/group/repo/-/blob/main/diagram.bpmn",
    });
    mockBrowser._tabsSendMessage.mockResolvedValue(undefined);
    await runBackgroundScript(mockBrowser, mockConfig);

    const addListenerCalls = (mockBrowser.tabs.onActivated.addListener as ReturnType<typeof vi.fn>).mock.calls;
    const handler = addListenerCalls[0]?.[0] as (activeInfo: { tabId: number }) => Promise<void>;
    await handler({ tabId: 10 });
    await vi.waitFor(() => {
      expect(mockBrowser.tabs.sendMessage).toHaveBeenCalled();
    });

    expect(mockBrowser.tabs.get).toHaveBeenCalledWith(10);
    expect(mockBrowser.tabs.sendMessage).toHaveBeenCalledWith(
      10,
      expect.objectContaining({
        url: "https://git.example.com/group/repo/-/blob/main/diagram.bpmn",
        eventSource: "onActivated",
      })
    );
  });

  it("onUpdated listener with status complete calls sendMessage", async () => {
    mockBrowser._tabsSendMessage.mockResolvedValue(undefined);
    await runBackgroundScript(mockBrowser, mockConfig);

    const addListenerCalls = (mockBrowser.tabs.onUpdated.addListener as ReturnType<typeof vi.fn>).mock.calls;
    const handler = addListenerCalls[0]?.[0] as (
      tabId: number,
      changeInfo: { status?: string },
      tab: { url?: string }
    ) => void;
    handler(20, { status: "complete" }, { url: "https://git.example.com/a/b/-/blob/master/x.bpmn" });
    await vi.waitFor(() => {
      expect(mockBrowser.tabs.sendMessage).toHaveBeenCalled();
    });

    expect(mockBrowser.tabs.sendMessage).toHaveBeenCalledWith(
      20,
      expect.objectContaining({
        url: "https://git.example.com/a/b/-/blob/master/x.bpmn",
        eventSource: "onUpdated[Complete]",
      })
    );
  });

  it("onUpdated listener without status complete does not call sendMessage", async () => {
    await runBackgroundScript(mockBrowser, mockConfig);

    const addListenerCalls = (mockBrowser.tabs.onUpdated.addListener as ReturnType<typeof vi.fn>).mock.calls;
    const handler = addListenerCalls[0]?.[0] as (
      tabId: number,
      changeInfo: { status?: string },
      tab: { url?: string }
    ) => void;
    handler(20, { status: "loading" }, { url: "https://git.example.com/a/b/-/blob/master/x.bpmn" });

    expect(mockBrowser.tabs.sendMessage).not.toHaveBeenCalled();
  });

  it("storage.onChanged listener with areaName local and resolved url sends MESSAGE_TYPE_CONFIG_CHANGED", async () => {
    mockBrowser._tabsQuery.mockResolvedValue([
      { id: 3, url: "https://git.example.com/proj/-/merge_requests/1/diffs" },
    ]);
    mockBrowser._tabsSendMessage.mockResolvedValue(undefined);
    await runBackgroundScript(mockBrowser, mockConfig);

    const addListenerCalls = (mockBrowser.storage.onChanged.addListener as ReturnType<typeof vi.fn>).mock.calls;
    const handler = addListenerCalls[0]?.[0] as (
      _changes: unknown,
      areaName: string
    ) => Promise<void>;
    await handler({}, "local");
    await vi.waitFor(() => {
      expect(mockBrowser.tabs.sendMessage).toHaveBeenCalled();
    });

    expect(mockBrowser.tabs.sendMessage).toHaveBeenCalledWith(
      3,
      expect.objectContaining({
        type: "gl-bpmn-viewer-config-changed",
        url: "https://git.example.com/proj/-/merge_requests/1/diffs",
      })
    );
  });

  it("storage.onChanged listener with areaName local and no tab does not send message", async () => {
    mockBrowser._tabsQuery.mockResolvedValue([]);
    await runBackgroundScript(mockBrowser, mockConfig);

    const addListenerCalls = (mockBrowser.storage.onChanged.addListener as ReturnType<typeof vi.fn>).mock.calls;
    const handler = addListenerCalls[0]?.[0] as (
      _changes: unknown,
      areaName: string
    ) => Promise<void>;
    await handler({}, "local");

    expect(mockBrowser.tabs.sendMessage).not.toHaveBeenCalled();
  });

  it("when sendMessage throws Receiving end does not exist, injects script and retries sendMessage", async () => {
    mockBrowser._tabsGet.mockResolvedValue({
      id: 5,
      url: "https://git.example.com/g/r/-/blob/main/f.bpmn",
    });
    mockBrowser._tabsSendMessage
      .mockRejectedValueOnce(new Error("Could not establish connection. Receiving end does not exist"))
      .mockResolvedValueOnce(undefined);
    mockBrowser._scriptingExecute.mockResolvedValue(undefined);
    await runBackgroundScript(mockBrowser, mockConfig);

    const addListenerCalls = (mockBrowser.tabs.onActivated.addListener as ReturnType<typeof vi.fn>).mock.calls;
    const handler = addListenerCalls[0]?.[0] as (activeInfo: { tabId: number }) => Promise<void>;
    await handler({ tabId: 5 });
    await vi.waitFor(() => {
      expect(mockBrowser.scripting.executeScript).toHaveBeenCalled();
    });

    expect(mockBrowser.scripting.executeScript).toHaveBeenCalledWith({
      target: { tabId: 5 },
      files: ["src/content/index.js"],
    });
    expect(mockBrowser.tabs.sendMessage).toHaveBeenCalledTimes(2);
    expect(mockBrowser.tabs.sendMessage).toHaveBeenLastCalledWith(
      5,
      expect.objectContaining({ eventSource: "onActivated[afterInject]" })
    );
  });

  it("when url is not configured, onActivated does not call sendMessage", async () => {
    vi.mocked(mockConfig.isHostConfigured).mockReturnValue(false);
    mockBrowser._tabsGet.mockResolvedValue({
      id: 6,
      url: "https://other.com/not-configured",
    });
    await runBackgroundScript(mockBrowser, mockConfig);

    const addListenerCalls = (mockBrowser.tabs.onActivated.addListener as ReturnType<typeof vi.fn>).mock.calls;
    const handler = addListenerCalls[0]?.[0] as (activeInfo: { tabId: number }) => Promise<void>;
    await handler({ tabId: 6 });

    expect(mockBrowser.tabs.sendMessage).not.toHaveBeenCalled();
  });
});
