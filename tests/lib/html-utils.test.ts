import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createIconButton,
  showWarning,
  CSS_CLASS_DIAGRAM_BUTTON,
} from "@/lib/html-utils";

vi.mock("webextension-polyfill", () => ({
  default: {
    runtime: {
      getURL: (path: string) => `extension://${path}`,
    },
  },
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
});
