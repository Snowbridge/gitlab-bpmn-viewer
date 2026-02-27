import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  getHostFromUrl,
  isHostConfigured,
  getTokenForHost,
  loadSettings,
  saveSettings,
} from "../../src/lib/settings";

describe("getHostFromUrl", () => {
  it("извлекает hostname без порта для стандартных портов", () => {
    expect(getHostFromUrl("https://gitlab.com/group/repo")).toBe("gitlab.com");
  });

  it("включает порт при нестандартном порте", () => {
    expect(getHostFromUrl("https://git.example.com:8443/repo")).toBe(
      "git.example.com:8443"
    );
  });

  it("игнорирует порт 80 и 443", () => {
    expect(getHostFromUrl("http://gitlab.com:80/repo")).toBe("gitlab.com");
    expect(getHostFromUrl("https://gitlab.com:443/repo")).toBe("gitlab.com");
  });

  it("возвращает null для невалидного URL", () => {
    expect(getHostFromUrl("not-a-url")).toBeNull();
  });

  it("поддерживает localhost", () => {
    expect(getHostFromUrl("http://localhost:3000/test")).toBe("localhost:3000");
  });
});

describe("isHostConfigured", () => {
  const settings = {
    hosts: [
      { host: "git.example.com", token: "abc" },
      { host: "gitlab.com", token: "xyz" },
    ],
  };

  it("возвращает true для настроенного хоста", () => {
    expect(isHostConfigured(settings, "git.example.com")).toBe(true);
  });

  it("сравнивает без учёта регистра", () => {
    expect(isHostConfigured(settings, "GIT.EXAMPLE.COM")).toBe(true);
    expect(isHostConfigured(settings, "GitLab.com")).toBe(true);
  });

  it("возвращает false для ненастроенного хоста", () => {
    expect(isHostConfigured(settings, "other.com")).toBe(false);
  });

  it("обрабатывает пустой массив", () => {
    expect(isHostConfigured({ hosts: [] }, "any.com")).toBe(false);
  });
});

describe("getTokenForHost", () => {
  const settings = {
    hosts: [
      { host: "git.example.com", token: "secret123" },
      { host: "gitlab.com", token: "other" },
    ],
  };

  it("возвращает токен для настроенного хоста", () => {
    expect(getTokenForHost(settings, "git.example.com")).toBe("secret123");
  });

  it("возвращает undefined для ненастроенного хоста", () => {
    expect(getTokenForHost(settings, "unknown.com")).toBeUndefined();
  });

  it("сравнивает без учёта регистра", () => {
    expect(getTokenForHost(settings, "GIT.EXAMPLE.COM")).toBe("secret123");
  });
});

// Интеграционные тесты с моком storage
vi.mock("webextension-polyfill", () => ({
  default: {
    storage: {
      local: {
        get: vi.fn(),
        set: vi.fn(),
      },
    },
  },
}));

describe("loadSettings / saveSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loadSettings возвращает default при пустом storage", async () => {
    const browser = (await import("webextension-polyfill")).default;
    (browser.storage.local.get as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const result = await loadSettings();
    expect(result).toEqual({
      hosts: [],
      debugEnabled: false,
      debugPrintStack: false,
    });
  });

  it("loadSettings возвращает сохранённые данные", async () => {
    const browser = (await import("webextension-polyfill")).default;
    const saved = {
      hosts: [{ host: "git.example.com", token: "token1" }],
    };
    (browser.storage.local.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      settings: saved,
    });

    const result = await loadSettings();
    expect(result.hosts).toHaveLength(1);
    expect(result.hosts[0]).toEqual({ host: "git.example.com", token: "token1" });
  });

  it("saveSettings записывает в storage", async () => {
    const browser = (await import("webextension-polyfill")).default;
    (browser.storage.local.set as ReturnType<typeof vi.fn>).mockResolvedValue(
      undefined
    );

    await saveSettings({
      hosts: [{ host: "test.com", token: "t" }],
    });

    expect(browser.storage.local.set).toHaveBeenCalledWith({
      settings: { hosts: [{ host: "test.com", token: "t" }] },
    });
  });
});
