import { describe, it, expect, vi, beforeEach } from "vitest";
import { BaseConfig } from "@/lib/configuration";
import type { BrowserApi } from "@/types/types";
import type { HostConfig } from "@/types/settings";

vi.unmock("@/lib/configuration");

const STORAGE_KEY = "gl-bpmn-viewer-configuration";

function createMockBrowserApi(initialData: Record<string, unknown> = {}): BrowserApi {
  let storage: Record<string, unknown> = { ...initialData };
  return {
    storage: {
      local: {
        get: vi.fn((key: string) =>
          Promise.resolve(key ? { [key]: storage[key] } : storage)
        ),
        set: vi.fn((data: Record<string, unknown>) => {
          storage = { ...storage, ...data };
          return Promise.resolve();
        }),
      },
      onChanged: {
        addListener: vi.fn(),
        hasListener: vi.fn(() => false),
      },
    },
  } as unknown as BrowserApi;
}

class TestConfig extends BaseConfig {
  subscribeListeners(): void {
    // no-op for tests
  }
}

describe("BaseConfig", () => {
  let browserApi: BrowserApi;

  beforeEach(() => {
    vi.clearAllMocks();
    browserApi = createMockBrowserApi();
  });

  it("load() resolves with this when storage is empty", async () => {
    (browserApi.storage.local.get as ReturnType<typeof vi.fn>).mockResolvedValue({});
    const config = new TestConfig(browserApi);
    const result = await config.load();
    expect(result).toBe(config);
  });

  it("load() applies stored hosts and debug flags", async () => {
    (browserApi.storage.local.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      [STORAGE_KEY]: {
        hosts: [{ host: "git.example.com", token: "abc" }],
        debugEnabled: true,
        debugStackIncluded: true,
      },
    });
    const config = new TestConfig(browserApi);
    await config.load();
    expect(config.isHostConfigured("https://git.example.com")).toBe(true);
    expect(config.isDebugEnabled()).toBe(true);
    expect(config.isDebugStackIncluded()).toBe(true);
  });

  it("isHostConfigured returns true for configured host", async () => {
    const config = new TestConfig(browserApi);
    config.update(
      [{ host: "git.example.com", token: "token123" }],
      false,
      false
    );
    expect(config.isHostConfigured("https://git.example.com/group/repo")).toBe(true);
    expect(config.isHostConfigured("git.example.com")).toBe(true);
  });

  it("isHostConfigured returns false for unconfigured host", async () => {
    const config = new TestConfig(browserApi);
    config.update(
      [{ host: "git.example.com", token: "token123" }],
      false,
      false
    );
    expect(config.isHostConfigured("https://other.com")).toBe(false);
  });

  it("isHostConfigured is case-insensitive", async () => {
    const config = new TestConfig(browserApi);
    config.update(
      [{ host: "Git.Example.COM", token: "t" }],
      false,
      false
    );
    expect(config.isHostConfigured("https://git.example.com")).toBe(true);
  });

  it("getToken returns token for configured host", async () => {
    const config = new TestConfig(browserApi);
    config.update(
      [{ host: "git.example.com", token: "secret" }],
      false,
      false
    );
    expect(config.getToken("https://git.example.com/")).toBe("secret");
  });

  it("getToken returns default message when host not configured", async () => {
    const config = new TestConfig(browserApi);
    config.update([], false, false);
    expect(config.getToken("https://unknown.com")).toContain("no token");
  });

  it("getHosts returns copy of hosts", async () => {
    const config = new TestConfig(browserApi);
    const hosts: HostConfig[] = [
      { host: "a.com", token: "t1" },
      { host: "b.com", token: "t2" },
    ];
    config.update(hosts, false, false);
    const got = config.getHosts();
    expect(got).toEqual(hosts);
    expect(got).not.toBe(hosts);
  });

  it("update normalizes host and strips rows with empty token", async () => {
    const config = new TestConfig(browserApi);
    config.update(
      [
        { host: "git.example.com", token: "x" },
        { host: "other.com", token: "" },
      ],
      false,
      false
    );
    const hosts = config.getHosts();
    expect(hosts).toHaveLength(1);
    expect(hosts[0].host).toBe("git.example.com");
  });

  it("save() writes to storage", async () => {
    const config = new TestConfig(browserApi);
    config.update([{ host: "git.example.com", token: "t" }], true, false);
    await config.save();
    expect(browserApi.storage.local.set).toHaveBeenCalledWith(
      expect.objectContaining({
        [STORAGE_KEY]: expect.objectContaining({
          hosts: [{ host: "git.example.com", token: "t" }],
          debugEnabled: true,
          debugStackIncluded: false,
        }),
      })
    );
  });
});
