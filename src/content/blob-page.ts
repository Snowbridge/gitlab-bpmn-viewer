import config from "../lib/configuration";

/**
 * Логика blob-страницы: отображение BPMN-диаграммы вместо исходного кода (требование 3.2).
 * Ответственность: только страницы просмотра файла (маска -/blob/ ref / путь к .bpmn).
 * Стили bpmn-js подключаются в content/index.ts (единая точка входа).
 */
import NavigatedViewer from "bpmn-js/lib/NavigatedViewer";
import {
  fetchFileRaw,
  parseBlobUrl,
} from "../lib";
import { createIconButton, debug } from "./utils";

const BLOB_VIEWER_SELECTOR =
  "#fileHolder .file-content.code.blob-content";

const BUTTON_GROUP_SELECTOR =
  "#fileHolder div.file-actions > :last-child";

const MAX_WAIT_MS: number = 5000;
const POLL_INTERVAL_MS: number = 100;

function waitForElement(selector: string): Promise<HTMLElement> {
  return new Promise((resolve, reject) => {
    debug(`waitForElement: ${selector}`);
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

/**
 * Инициализация blob-страницы: подмена контента на диаграмму и переключатель Исходный код/Диаграмма.
 * Вызывать только если parseBlobUrl(url) и хост настроены (проверка в вызывающем коде).
 */
export async function initBlobPage(): Promise<void> {
  debug("initBlobPage");

  const url = window.location.href;
  const blobParts = parseBlobUrl(url);
  if (!blobParts) {
    debug(`blobParts not found`);
    return;
  }

  if(!config.isHostConfigured(url)){
    debug(`host is NOT configured`, url);
    return;
  }

  const token = config.getToken(url);
  if (!token) {
    debug(`token is not configured`);
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
    debug("Failed to fetch file:", err);
    throw err;
  }

  const diagramContainer = document.createElement("div");
  diagramContainer.className = "bjs-container gl-bpmn-viewer-container";
  diagramContainer.style.cssText =
    "width:100%;min-height:400px;height:600px;position:relative;";

  const sourceBtn = createIconButton("icons/icon16gray.png", "Исходный код");
  const diagramBtn = createIconButton("icons/icon16.png", "Диаграмма");
  diagramBtn.style.display = "none";

  const sourceContainer = document.createElement("div");
  sourceContainer.className = "gl-bpmn-source-container";
  sourceContainer.innerHTML = originalContent;
  sourceContainer.style.display = "none";

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
    const viewer = new NavigatedViewer({
      container: diagramContainer,
    });
    await viewer.importXML(bpmnXml);
    const canvas = viewer.get("canvas") as { zoom: (mode: string) => void };
    canvas.zoom("fit-viewport");
    debug(`BPMN rendered successfully`);
  } catch (err) {
    debug("Failed to render BPMN:", err);
    target.innerHTML = originalContent;
    target.style.display = originalDisplay;
    throw err;
  }

  showDiagram();
}
