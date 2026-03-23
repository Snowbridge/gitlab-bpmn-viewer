import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createIconButton,
  showWarning,
  openDiagramModalWithContent,
  CSS_CLASS_DIAGRAM_BUTTON,
} from "@/lib/html-utils";

vi.mock("webextension-polyfill", () => ({
  default: {
    runtime: {
      getURL: (path: string) => `extension://${path}`,
    },
  },
}));

vi.mock("@/content/diff-modal.html?raw", () => ({
  default: `<div class="gl-bpmn-diff-modal-overlay"><button type="button" class="gl-bpmn-diff-modal-close" aria-label="Закрыть">×</button><h2 id="version-base-label"></h2><h2 id="version-head-label"></h2></div>`,
}));

describe("html-utils", () => {
  describe("CSS_CLASS_DIAGRAM_BUTTON", () => {
    it("is defined and non-empty", () => {
      expect(CSS_CLASS_DIAGRAM_BUTTON).toBe("gl-bpmn-viewer-diagram-button");
    });
  });

  describe("createIconButton", () => {
    it("returns a button element with correct class and title", () => {
      const btn = createIconButton("icons/icon16.png", "Диаграмма");
      expect(btn.tagName).toBe("BUTTON");
      expect(btn.type).toBe("button");
      expect(btn.className).toContain("gl-button");
      expect(btn.className).toContain(CSS_CLASS_DIAGRAM_BUTTON);
      expect(btn.title).toBe("Диаграмма");
    });

    it("contains an img with correct src and alt", () => {
      const btn = createIconButton("icons/foo.png", "Title");
      const img = btn.querySelector("img");
      expect(img).toBeTruthy();
      expect(img?.src).toContain("icons/foo.png");
      expect(img?.alt).toBe("Title");
    });
  });

  describe("showWarning", () => {
    beforeEach(() => {
      document.body.innerHTML = "";
      vi.useFakeTimers();
    });

    it("appends a div with role alert and message to body", () => {
      showWarning("File not found");
      const box = document.body.querySelector("[role='alert']");
      expect(box).toBeTruthy();
      expect(box?.textContent).toBe("File not found");
      expect(box?.className).toContain("gl-bpmn-diff-warning");
    });

    it("removes the box after timeout", () => {
      showWarning("Msg");
      expect(document.body.querySelector("[role='alert']")).toBeTruthy();
      vi.advanceTimersByTime(8000);
      expect(document.body.querySelector("[role='alert']")).toBeFalsy();
    });
  });

  describe("openDiagramModalWithContent", () => {
    const DIFF_APPLY_EVENT = "gl-bpmn-diff-apply";
    const sampleMrRefs = {
      source: "feature/x",
      target: "main",
      baseSha: "b",
      headSha: "h",
    } as const;

    beforeEach(() => {
      document.body.innerHTML = "";
      document.head.innerHTML = "";
    });

    it("appends overlay to body and injects diff-app script", () => {
      const btn = document.createElement("button");
      openDiagramModalWithContent(btn, "<source/>", "<target/>", sampleMrRefs);

      const overlay = document.body.querySelector(".gl-bpmn-diff-modal-overlay");
      expect(overlay).toBeTruthy();
      expect(overlay?.querySelector(".gl-bpmn-diff-modal-close")).toBeTruthy();

      const script = overlay?.querySelector("script");
      expect(script?.src).toContain("scripts/diff-app.js");
      expect(script?.async).toBe(true);
    });

    it("sets version labels from mrRefs.target (base) and mrRefs.source (head)", () => {
      const btn = document.createElement("button");
      openDiagramModalWithContent(btn, "a", "b", sampleMrRefs);

      expect(document.querySelector("#version-base-label")?.textContent).toBe("main");
      expect(document.querySelector("#version-head-label")?.textContent).toBe("feature/x");
    });

    it("dispatches DIFF_APPLY_EVENT with head and base XML when script onload fires", () => {
      const btn = document.createElement("button");
      let receivedDetail: { fileVersionHead: string; fileVersionBase: string } | null = null;
      document.addEventListener(DIFF_APPLY_EVENT, ((e: CustomEvent) => {
        receivedDetail = e.detail;
      }) as EventListener);

      openDiagramModalWithContent(btn, "<xml-a/>", "<xml-b/>", sampleMrRefs);

      const script = document.body.querySelector(".gl-bpmn-diff-modal-overlay script");
      expect(script).toBeTruthy();
      (script as HTMLScriptElement).onload?.({} as Event);
      expect(receivedDetail).toEqual({
        fileVersionHead: "<xml-a/>",
        fileVersionBase: "<xml-b/>",
      });
    });

    it("closes modal when overlay is clicked", () => {
      const btn = document.createElement("button");
      openDiagramModalWithContent(btn, "a", "b", sampleMrRefs);

      const overlay = document.body.querySelector(".gl-bpmn-diff-modal-overlay") as HTMLElement;
      expect(overlay).toBeTruthy();
      overlay.click();
      expect(document.body.querySelector(".gl-bpmn-diff-modal-overlay")).toBeFalsy();
    });

    it("closes modal when close button is clicked", () => {
      const btn = document.createElement("button");
      openDiagramModalWithContent(btn, "a", "b", sampleMrRefs);

      const closeBtn = document.body.querySelector(".gl-bpmn-diff-modal-close") as HTMLElement;
      expect(closeBtn).toBeTruthy();
      closeBtn.click();
      expect(document.body.querySelector(".gl-bpmn-diff-modal-overlay")).toBeFalsy();
    });

    it("closes modal on Escape key", () => {
      const btn = document.createElement("button");
      openDiagramModalWithContent(btn, "a", "b", sampleMrRefs);

      expect(document.body.querySelector(".gl-bpmn-diff-modal-overlay")).toBeTruthy();
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      expect(document.body.querySelector(".gl-bpmn-diff-modal-overlay")).toBeFalsy();
    });
  });
});
