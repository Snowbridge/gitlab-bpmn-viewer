import browser from "webextension-polyfill";
import { debug } from "./logger";
import modalTemplate from '@/content/diff-modal.html?raw';

export const CSS_CLASS_DIAGRAM_BUTTON = `gl-bpmn-viewer-diagram-button` as const;

const DIFF_APPLY_EVENT = "gl-bpmn-diff-apply";
/** Selector of the modal overlay (click on it closes the modal). */
const MODAL_OVERLAY_SELECTOR = ".gl-bpmn-diff-modal-overlay";
/** Selector of the close button. */
const MODAL_CLOSE_SELECTOR = ".gl-bpmn-diff-modal-close";

export function createIconButton(
  iconPath: string,
  title: string
): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `gl-button btn btn-default btn-md ${CSS_CLASS_DIAGRAM_BUTTON}`;
  btn.title = title;
  const img = document.createElement("img");
  img.src = browser.runtime.getURL(iconPath);
  img.alt = title;
  img.style.cssText = "width:16px;height:16px;display:block;";
  btn.appendChild(img);
  return btn;
}

/**
* Shows a warning to the user (file is missing in one of the branches).
*/
export function showWarning(message: string): void {
  const box = document.createElement("div");
  box.setAttribute("role", "alert");
  box.className = "gl-bpmn-diff-warning";
  box.style.cssText = [
    "position:fixed",
    "top:16px",
    "left:50%",
    "transform:translateX(-50%)",
    "z-index:10000",
    "max-width:90vw",
    "padding:12px 20px",
    "background:var(--gl-warning-bg, #fcf8e3)",
    "border:1px solid var(--gl-warning-border, #f5e79e)",
    "border-radius:6px",
    "color:var(--gl-warning-text, #8a6d3b)",
    "font-size:14px",
    "line-height:1.4",
    "box-shadow:0 2px 12px rgba(0,0,0,0.15)",
  ].join(";");
  box.textContent = message;
  document.body.appendChild(box);
  setTimeout(() => {
    box.remove();
  }, 8000);
}


/**
 * Opens a modal dialog and passes already loaded from/to to APP.loadSource.
 * @param diagramBtn — button (not used for closing, kept for consistency).
 */
export function openDiagramModalWithContent(
  diagramBtn: HTMLElement,
  from: string,
  to: string
): void {

  debug(`Opening modal with diagrams diff`);
  const wrap = document.createElement("div");
  wrap.innerHTML = modalTemplate;
  const overlay = wrap.querySelector<HTMLElement>(MODAL_OVERLAY_SELECTOR);
  if (!overlay) {
    debug(`overlay not found`);
    return;
  }
  const overlayEl: HTMLElement = overlay;

  const closeBtn = overlayEl.querySelector<HTMLElement>(MODAL_CLOSE_SELECTOR);

  function close(): void {
    overlayEl.remove();
    document.removeEventListener("keydown", onEscape);
  }

  function onEscape(e: KeyboardEvent): void {
    if (e.key === "Escape") close();
  }

  overlayEl.addEventListener("click", (e) => {
    if (e.target === overlayEl) close();
  });
  closeBtn?.addEventListener("click", close);
  document.addEventListener("keydown", onEscape);

  document.body.appendChild(overlayEl);

  injectDiffApplyBridge();

  const script = document.createElement("script");
  script.src = browser.runtime.getURL("scripts/diff-app.js");
  script.async = true;
  script.onload = (): void => {
    debug(`scripts/diff-app.js is loaded`);
    document.dispatchEvent(
      new CustomEvent(DIFF_APPLY_EVENT, { detail: { from, to } })
    );
  };
  overlayEl.appendChild(script);
  debug(`scripts/diff-app.js is appended`);
}

function injectDiffApplyBridge(): void {
  debug(`injectDiffApplyBridge`);
  const script = document.createElement("script");
  script.src = browser.runtime.getURL("scripts/diff-apply-bridge.js");
  ;(document.head || document.documentElement).appendChild(script);
}