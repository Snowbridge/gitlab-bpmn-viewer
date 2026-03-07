import { describe, it, expect, vi, beforeEach } from "vitest";
import { DiffPageLogic } from "@/content/diff-page";
import type { BaseConfig } from "@/lib/configuration";
import type { Logger } from "@/lib/logger";

vi.mock("@/lib/gitlab-api", () => ({
  fetchFileRaw: vi.fn().mockResolvedValue("<bpmn/>"),
  getMergeRequestRefs: vi.fn().mockResolvedValue({ source: "startSha", target: "headSha" }),
}));

vi.mock("@/lib/html-utils", () => ({
  createIconButton: vi.fn(() => {
    const btn = document.createElement("button");
    btn.className = "gl-bpmn-viewer-diagram-button";
    return btn;
  }),
  openDiagramModalWithContent: vi.fn(),
  showWarning: vi.fn(),
  CSS_CLASS_DIAGRAM_BUTTON: "gl-bpmn-viewer-diagram-button",
}));

describe("DiffPageLogic", () => {
  const origin = "https://git.example.com";
  const pathname = "/group/repo/-/merge_requests/1/diffs";

  let mockConfig: {
    load: ReturnType<typeof vi.fn>;
    isHostConfigured: ReturnType<typeof vi.fn>;
    getToken: ReturnType<typeof vi.fn>;
  };
  let mockLogger: { debug: ReturnType<typeof vi.fn> };

  function setupDiffDom() {
    document.body.innerHTML = "";
    const diffFilesHolder = document.createElement("div");
    diffFilesHolder.className = "diff-files-holder";

    const row = document.createElement("div");
    row.setAttribute("data-path", "path/to/file.bpmn");
    const wrapper = document.createElement("div");
    const fileActions = document.createElement("div");
    fileActions.className = "file-actions";
    wrapper.appendChild(fileActions);
    row.appendChild(wrapper);
    diffFilesHolder.appendChild(row);
    document.body.appendChild(diffFilesHolder);

    window.history.pushState({}, "", pathname);

    return { diffFilesHolder, fileActions, row };
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

  it("adds diagram button when mount point and .bpmn row exist", async () => {
    setupDiffDom();
    const { getMergeRequestRefs } = await import("@/lib/gitlab-api");

    new DiffPageLogic(
      mockConfig as unknown as BaseConfig,
      mockLogger as unknown as Logger
    );
    await Promise.resolve();

    expect(mockConfig.load).toHaveBeenCalled();
    expect(getMergeRequestRefs).toHaveBeenCalledWith(
      origin,
      "token",
      "group/repo",
      "1"
    );
  });
});
