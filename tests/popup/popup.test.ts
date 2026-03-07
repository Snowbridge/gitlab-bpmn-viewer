import { describe, it, expect, vi, beforeEach } from "vitest";

const mockOpenOptionsPage = vi.fn();
vi.mock("webextension-polyfill", () => ({
  default: {
    runtime: {
      openOptionsPage: mockOpenOptionsPage,
    },
  },
}));

describe("popup", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    const btn = document.createElement("button");
    btn.id = "open-options";
    document.body.appendChild(btn);
    vi.clearAllMocks();
  });

  it("click on open-options calls runtime.openOptionsPage", async () => {
    await import("@/popup/popup");
    const btn = document.getElementById("open-options");
    btn?.click();
    expect(mockOpenOptionsPage).toHaveBeenCalled();
  });
});
