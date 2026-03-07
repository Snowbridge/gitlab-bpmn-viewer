import { describe, it, expect, vi, beforeEach } from "vitest";
import { BlobPageLogic } from "@/content/blob-page";
import type { BaseConfig } from "@/lib/configuration";
import type { Logger } from "@/lib/logger";

vi.mock("bpmn-js/lib/NavigatedViewer", () => ({
  default: vi.fn().mockImplementation(() => ({
    importXML: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockReturnValue({ zoom: vi.fn() }),
  })),
}));

vi.mock("@/lib/gitlab-api", () => ({
  fetchFileRaw: vi.fn().mockResolvedValue("<bpmn:definitions/>"),
}));

describe("BlobPageLogic", () => {
  const origin = "https://git.example.com";
  const pathname = "/group/repo/-/blob/main/path/to/file.bpmn";

  let mockConfig: {
    load: ReturnType<typeof vi.fn>;
    isHostConfigured: ReturnType<typeof vi.fn>;
    getToken: ReturnType<typeof vi.fn>;
  };
  let mockLogger: { debug: ReturnType<typeof vi.fn> };

  function setupBlobDom() {
    document.body.innerHTML = "";
    const fileHolder = document.createElement("div");
    fileHolder.id = "fileHolder";

    const fileActions = document.createElement("div");
    fileActions.className = "file-actions";

    const buttonsGroup = document.createElement("div");
    buttonsGroup.className = "gl-button-group";
    fileActions.appendChild(buttonsGroup);

    const refHolder = document.createElement("div");
    refHolder.className = "tree-ref-holder";
    const refSelector = document.createElement("div");
    refSelector.className = "ref-selector";
    const refBtn = document.createElement("button");
    const refSpan = document.createElement("span");
    const refSpanInner = document.createElement("span");
    refSpanInner.textContent = "main";
    Object.defineProperty(refSpanInner, "innerText", { get: () => "main", configurable: true });
    refSpan.appendChild(refSpanInner);
    refBtn.appendChild(refSpan);
    refSelector.appendChild(refBtn);
    refHolder.appendChild(refSelector);
    fileHolder.appendChild(refHolder);
    fileHolder.appendChild(fileActions);

    const fileContent = document.createElement("div");
    fileContent.className = "file-content code blob-content";
    fileContent.innerHTML = "<pre>original</pre>";
    fileHolder.appendChild(fileContent);

    document.body.appendChild(fileHolder);

    window.history.pushState({}, "", pathname);

    return { fileHolder, fileActions, buttonsGroup, fileContent };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockConfig = {
      load: vi.fn().mockResolvedValue(undefined),
      isHostConfigured: vi.fn().mockReturnValue(true),
      getToken: vi.fn().mockReturnValue("token"),
    };
    mockLogger = { debug: vi.fn() };
  });

  it("injects diagram UI when DOM is ready and host configured", async () => {
    setupBlobDom();
    const { fetchFileRaw } = await import("@/lib/gitlab-api");

    new BlobPageLogic(
      mockConfig as unknown as BaseConfig,
      mockLogger as unknown as Logger
    );
    await Promise.resolve();

    expect(mockConfig.load).toHaveBeenCalled();
    expect(fetchFileRaw).toHaveBeenCalledWith(
      origin,
      "token",
      "group/repo",
      "main",
      "path/to/file.bpmn"
    );
  });
});
