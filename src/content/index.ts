/**
 * Content script — внедряется в страницы GitLab
 * Выполняется только на сайтах, хост которых присутствует в настройках (требование 3.1)
 */
import "bpmn-js/dist/assets/diagram-js.css";
import "bpmn-js/dist/assets/bpmn-js.css";

import browser from "webextension-polyfill";
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
  "#fileHolder .file-content.code.blob-content";

const BUTTON_GROUP_SELECTOR =
  "#fileHolder div.file-actions > :last-child";

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

  const [target, buttonGroup] = await Promise.all([
    waitForElement(BLOB_VIEWER_SELECTOR),
    waitForElement(BUTTON_GROUP_SELECTOR),
  ]);
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

  function createIconButton(iconPath: string, title: string): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "gl-button btn btn-default btn-md";
    btn.title = title;
    const img = document.createElement("img");
    img.src = browser.runtime.getURL(iconPath);
    img.alt = title;
    img.style.cssText = "width:16px;height:16px;display:block;";
    btn.appendChild(img);
    return btn;
  }

  const sourceBtn = createIconButton("icons/icon16gray.png", "Исходный код");
  const diagramBtn = createIconButton("icons/icon16.png", "Диаграмма");
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

  buttonGroup.appendChild(sourceBtn);
  buttonGroup.appendChild(diagramBtn);

  target.innerHTML = "";
  target.style.display = "block";
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

/** URL страницы, для которой уже выполнялся init (избегаем двойного запуска). */
let lastInitUrl: string | null = null;

async function init(): Promise<void> {
  const url = window.location.href;
  const host = getHostFromUrl(url);
  if (!host) {
    return;
  }

  const settings = await loadSettings();
  if (!isHostConfigured(settings, host)) {
    return;
  }

  const blobParts = parseBlobUrl(url);
  if (blobParts) {
    if (lastInitUrl === url) {
      return;
    }
    lastInitUrl = url;
    await renderBlobBpmn();
  } else {
    lastInitUrl = url;
    // TODO: 3.2, 3.4 — контекстное меню, diff
    console.log("[GitLab BPMN Viewer] Content active for host:", host);
  }
}

/** Интервал опроса URL (мс); срабатывает при переходе на blob без полной перезагрузки. */
const URL_POLL_INTERVAL_MS = 350;
/** Таймер опроса URL. */
let urlPollTimer: ReturnType<typeof setInterval> | null = null;

function startUrlPolling(): void {
  if (urlPollTimer !== null) return;
  urlPollTimer = setInterval(() => {
    const url = window.location.href;
    if (!parseBlobUrl(url)) return;
    if (url === lastInitUrl) return;
    const host = getHostFromUrl(url);
    if (!host) return;
    loadSettings().then((settings) => {
      if (!isHostConfigured(settings, host)) return;
      init();
    });
  }, URL_POLL_INTERVAL_MS);
}

/** Запуск init при навигации без полной перезагрузки. */
function setupNavigationListeners(): void {
  document.addEventListener("turbo:load", () => init());
  window.addEventListener("popstate", () => init());

  const runInitAfterUrlChange = (): void => {
    setTimeout(() => init(), 200);
  };
  const origPushState = history.pushState;
  const origReplaceState = history.replaceState;
  history.pushState = function (
    ...args: Parameters<typeof history.pushState>
  ): void {
    origPushState.apply(this, args);
    runInitAfterUrlChange();
  };
  history.replaceState = function (
    ...args: Parameters<typeof history.replaceState>
  ): void {
    origReplaceState.apply(this, args);
    runInitAfterUrlChange();
  };

  // Надёжный fallback: опрос URL (GitLab может использовать turbo-frame без turbo:load на document)
  startUrlPolling();
}

init();
setupNavigationListeners();
