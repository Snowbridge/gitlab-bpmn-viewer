import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("webextension-polyfill", () => ({
  default: {},
}));

vi.mock("@/lib/configuration", () => ({
  BackgroundConfig: vi.fn().mockImplementation(() => ({
    load: vi.fn().mockResolvedValue(undefined),
    getHosts: vi.fn().mockReturnValue([{ host: "git.example.com", token: "t" }]),
    isDebugEnabled: vi.fn().mockReturnValue(false),
    isDebugStackIncluded: vi.fn().mockReturnValue(false),
    update: vi.fn(),
    save: vi.fn().mockResolvedValue(undefined),
  })),
}));

describe("options page", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    const hostsList = document.createElement("div");
    hostsList.id = "hosts-list";
    const addHost = document.createElement("button");
    addHost.id = "add-host";
    addHost.type = "button";
    const form = document.createElement("form");
    form.id = "settings-form";
    const status = document.createElement("div");
    status.id = "status";
    const debugEnabled = document.createElement("input");
    debugEnabled.id = "debug-enabled";
    debugEnabled.type = "checkbox";
    const debugPrintStack = document.createElement("input");
    debugPrintStack.id = "debug-print-stack";
    debugPrintStack.type = "checkbox";
    document.body.appendChild(hostsList);
    document.body.appendChild(addHost);
    document.body.appendChild(form);
    document.body.appendChild(status);
    document.body.appendChild(debugEnabled);
    document.body.appendChild(debugPrintStack);
  });

  it("options module can be loaded when DOM has required elements", async () => {
    await expect(
      import("@/options/options")
    ).resolves.toBeDefined();
  });
});
