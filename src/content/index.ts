/**
 * Content script — внедряется в страницы GitLab
 * Выполняется только на сайтах, хост которых присутствует в настройках (требование 3.1)
 */
import "bpmn-js/dist/assets/diagram-js.css";
import "bpmn-js/dist/assets/bpmn-js.css";

import NavigatedViewer from "bpmn-js/lib/NavigatedViewer";
import {
  fetchFileRaw,
  getHostFromUrl,
  getTokenForHost,
  isHostConfigured,
  loadSettings,
  parseBlobUrl,
} from "../lib";

const BLOB_VIEWER_SELECTOR =
  "#fileHolder > div.gl-flex.blob-viewer > div";

const MAX_WAIT_MS = 5000;
const POLL_INTERVAL_MS = 100;

function waitForElement(
  selector: string
): Promise<HTMLElement> {
  return new Promise((resolve, reject) => {
    const el = document.querySelector<HTMLElement>(selector);
    if (el) {
      resolve(el);
      return;
    }
    const deadline = Date.now() + MAX_WAIT_MS;
    const timer = setInterval(() => {
      const found = document.querySelector<HTMLElement>(selector);
      if (found) {
        clearInterval(timer);
        resolve(found);
      } else if (Date.now() >= deadline) {
        clearInterval(timer);
        reject(new Error(`Element not found: ${selector}`));
      }
    }, POLL_INTERVAL_MS);
  });
}

async function renderBlobBpmn(): Promise<void> {
  const blobParts = parseBlobUrl(window.location.href);
  if (!blobParts) {
    return;
  }

  const host = getHostFromUrl(window.location.href);
  if (!host) {
    return;
  }

  const settings = await loadSettings();
  if (!isHostConfigured(settings, host)) {
    return;
  }

  const token = getTokenForHost(settings, host);
  if (!token) {
    return;
  }

  const target = await waitForElement(BLOB_VIEWER_SELECTOR);
  const originalContent = target.innerHTML;
  const originalDisplay = target.style.display;

  const origin = window.location.origin;

  let bpmnXml: string;
  try {
    bpmnXml = await fetchFileRaw(
      origin,
      token,
      blobParts.projectPath,
      blobParts.ref,
      blobParts.filePath
    );
  } catch (err) {
    console.error("[GitLab BPMN Viewer] Failed to fetch file:", err);
    throw err;
  }

  const diagramContainer = document.createElement("div");
  diagramContainer.className = "bjs-container gl-bpmn-viewer-container";
  diagramContainer.style.cssText =
    "width:100%;min-height:400px;height:600px;position:relative;";

  const toolbar = document.createElement("div");
  toolbar.className = "gl-bpmn-viewer-toolbar";
  toolbar.style.cssText =
    "display:flex;gap:8px;align-items:center;padding:8px 0;margin-bottom:8px;";

  const sourceBtn = document.createElement("button");
  sourceBtn.type = "button";
  sourceBtn.className = "gl-button btn btn-default btn-md";
  sourceBtn.textContent = "Исходный код";

  const diagramBtn = document.createElement("button");
  diagramBtn.type = "button";
  diagramBtn.className = "gl-button btn btn-default btn-md";
  diagramBtn.textContent = "Диаграмма";
  diagramBtn.style.display = "none";

  const sourceContainer = document.createElement("div");
  sourceContainer.className = "gl-bpmn-source-container";
  sourceContainer.innerHTML = originalContent;
  sourceContainer.style.display = "none";

  let viewer: NavigatedViewer | null = null;

  function showDiagram(): void {
    sourceContainer.style.display = "none";
    diagramContainer.style.display = "";
    sourceBtn.style.display = "";
    diagramBtn.style.display = "none";
  }

  function showSource(): void {
    diagramContainer.style.display = "none";
    sourceContainer.style.display = "";
    sourceBtn.style.display = "none";
    diagramBtn.style.display = "";
  }

  sourceBtn.addEventListener("click", showSource);
  diagramBtn.addEventListener("click", showDiagram);

  toolbar.appendChild(sourceBtn);
  toolbar.appendChild(diagramBtn);

  target.innerHTML = "";
  target.style.display = "block";
  target.appendChild(toolbar);
  target.appendChild(diagramContainer);
  target.appendChild(sourceContainer);

  try {
    viewer = new NavigatedViewer({
      container: diagramContainer,
    });
    await viewer.importXML(bpmnXml);
    const canvas = viewer.get("canvas") as { zoom: (mode: string) => void };
    canvas.zoom("fit-viewport");
  } catch (err) {
    console.error("[GitLab BPMN Viewer] Failed to render BPMN:", err);
    target.innerHTML = originalContent;
    target.style.display = originalDisplay;
    throw err;
  }

  showDiagram();
}

async function init(): Promise<void> {
  const host = getHostFromUrl(window.location.href);
  if (!host) {
    return;
  }

  const settings = await loadSettings();
  if (!isHostConfigured(settings, host)) {
    return;
  }

  const blobParts = parseBlobUrl(window.location.href);
  if (blobParts) {
    await renderBlobBpmn();
  } else {
    // TODO: 3.2, 3.4 — контекстное меню, diff
    console.log("[GitLab BPMN Viewer] Content active for host:", host);
  }
}

init();
