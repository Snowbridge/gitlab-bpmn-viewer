import { describe, it, expect, vi, beforeEach } from "vitest";
import { DiffPageLogic } from "@/content/diff-page";
import type { BaseConfig } from "@/lib/configuration";
import type { Logger } from "@/lib/logger";

vi.mock("@/lib/gitlab-api", () => ({
  fetchFileRaw: vi.fn().mockResolvedValue("<bpmn/>"),
  getMergeRequestRefs: vi.fn().mockResolvedValue({
    source: "feature",
    target: "main",
    baseSha: "sha-base",
    headSha: "sha-head",
  }),
}));

let lastCreatedDiagramBtn: HTMLButtonElement | null = null;
vi.mock("@/lib/html-utils", () => ({
  createIconButton: vi.fn(() => {
    const btn = document.createElement("button");
    btn.className = "gl-bpmn-viewer-diagram-button";
    lastCreatedDiagramBtn = btn;
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
    lastCreatedDiagramBtn = null;
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

  it("click on diagram button fetches both file versions and opens modal with content", async () => {
    setupDiffDom();
    const { fetchFileRaw } = await import("@/lib/gitlab-api");
    const { openDiagramModalWithContent } = await import("@/lib/html-utils");
    vi.mocked(fetchFileRaw)
      .mockResolvedValueOnce("<source-bpmn/>")
      .mockResolvedValueOnce("<target-bpmn/>");

    new DiffPageLogic(
      mockConfig as unknown as BaseConfig,
      mockLogger as unknown as Logger
    );
    await Promise.resolve();
    await Promise.resolve();

    const diagramBtn = lastCreatedDiagramBtn;
    expect(diagramBtn).toBeTruthy();
    diagramBtn!.click();
    await new Promise((r) => setTimeout(r, 0));

    expect(fetchFileRaw).toHaveBeenCalledTimes(2);
    expect(fetchFileRaw).toHaveBeenCalledWith(
      origin,
      "token",
      "group/repo",
      "sha-head",
      "path/to/file.bpmn"
    );
    expect(fetchFileRaw).toHaveBeenCalledWith(
      origin,
      "token",
      "group/repo",
      "sha-base",
      "path/to/file.bpmn"
    );
    expect(openDiagramModalWithContent).toHaveBeenCalledWith(
      diagramBtn!,
      "<source-bpmn/>",
      "<target-bpmn/>",
      {
        source: "feature",
        target: "main",
        baseSha: "sha-base",
        headSha: "sha-head",
      }
    );
  });

  it("click on diagram button shows warning and does not open modal when fetch fails", async () => {
    setupDiffDom();
    const { fetchFileRaw } = await import("@/lib/gitlab-api");
    const { openDiagramModalWithContent, showWarning } = await import("@/lib/html-utils");
    vi.mocked(fetchFileRaw)
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce("<target-bpmn/>");

    new DiffPageLogic(
      mockConfig as unknown as BaseConfig,
      mockLogger as unknown as Logger
    );
    await Promise.resolve();
    await Promise.resolve();

    const diagramBtn = lastCreatedDiagramBtn;
    expect(diagramBtn).toBeTruthy();
    diagramBtn!.click();
    await new Promise((r) => setTimeout(r, 0));

    expect(showWarning).toHaveBeenCalledWith(
      expect.stringContaining("Не удалось получить версию файла из репозитория")
    );
    expect(openDiagramModalWithContent).not.toHaveBeenCalled();
  });

  it("click on diagram button shows two warnings when both fetches fail", async () => {
    setupDiffDom();
    const { fetchFileRaw } = await import("@/lib/gitlab-api");
    const { openDiagramModalWithContent, showWarning } = await import("@/lib/html-utils");
    vi.mocked(fetchFileRaw).mockRejectedValue(new Error("API error"));

    new DiffPageLogic(
      mockConfig as unknown as BaseConfig,
      mockLogger as unknown as Logger
    );
    await Promise.resolve();
    await Promise.resolve();

    const diagramBtn = lastCreatedDiagramBtn;
    expect(diagramBtn).toBeTruthy();
    diagramBtn!.click();
    await new Promise((r) => setTimeout(r, 0));

    expect(showWarning).toHaveBeenCalledTimes(2);
    expect(openDiagramModalWithContent).not.toHaveBeenCalled();
  });
});
