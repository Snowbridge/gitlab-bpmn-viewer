import { debug } from "@/lib/logger";
import { DeferredMountPointExecutor } from "./deferred-executor";
import { ForegroundConfig } from "@/lib/configuration";
import { fetchFileRaw } from "@/lib/gitlab-api";
import NavigatedViewer from "bpmn-js/lib/NavigatedViewer";
import { createIconButton } from "@/lib/html-utils";

const WATCHDOG_FLAG = `gl-bpmn-viewer-is-injected` as const;
const SELECTOR_FILE_ACTIONS = `div.file-actions` as const;
const SELECTOR_BUTTONS = `#fileHolder div.file-actions > :last-child` as const;
const SELECTOR_FILE_CONTENT = `#fileHolder .file-content.code.blob-content` as const;
const SELECTOR_REF_DROPDOWN = `#dropdown-toggle-btn-33 > span > span` as const;

const config = new ForegroundConfig();
config.load();

export class BlobPageLogic extends DeferredMountPointExecutor {
  constructor() {
    super("#fileHolder");
  }

  async execute(): Promise<this> {
    debug(`Injecting blob-pages business logic`);

    if (!this.getMountPointElement()) {
      debug(`Mount point element is not found`);
      return this;
    }

    void await config.load();

    const url = document.location.href;

    if (!config.isHostConfigured(url)) {
      debug(`Host is not configured`, url);
      return this;
    }

    const fileActionsPanel = document.querySelector<HTMLElement>(SELECTOR_FILE_ACTIONS);

    if (!fileActionsPanel) {
      debug(`div.file-actions panel not found`);
      return this;
    }

    if (fileActionsPanel.getAttribute(WATCHDOG_FLAG) == "true") {
      debug(`Nothing to do: logic is already injected to that page`);
      return this;
    }

    const refDropdown = document.querySelector<HTMLElement>(SELECTOR_REF_DROPDOWN);
    if (!refDropdown) {
      debug(`Page structure is not ready yet: ref-name dropdown is not found`);
      return this;
    }


    const buttonsGroup = document.querySelector<HTMLElement>(SELECTOR_BUTTONS);
    if (!buttonsGroup) {
      debug(`Page structure is not ready yet: file-actions panel is not found`);
      return this;
    }

    const fileContent = document.querySelector<HTMLElement>(SELECTOR_FILE_CONTENT);
    if (!fileContent) {
      debug(`Page structure is not ready yet: file content div is not found`);
      return this;
    }

    // Фиксация факта инъекции *до* асинхронных операций, чтобы при
    // возможных повторных вызовах (дубликат INIT при SPA-переходе)
    // второй вызов увидел WATCHDOG_FLAG и ничего не добавлял.
    fileActionsPanel.setAttribute(WATCHDOG_FLAG, "true");

    this.stopMountPointObserver(); // мы сейчас будем менять mount point и нам не надо, чтобы обзервер запускал этот же код повторно

    const refName = refDropdown.innerText;
    const origin = document.location.origin;
    const pathnameRegexp = new RegExp(`^/(.*)/-/blob/${refName}/(.*)$`, 'i');
    const [pathName, repoPath, filePath] = (document.location.pathname.match(pathnameRegexp) ?? []);

    if (!pathName || !repoPath || !filePath)
      throw Error(`This is not a GitLab blob-page`);

    const rawContent = await fetchFileRaw(
      origin,
      config.getToken(url),
      repoPath,
      refName,
      filePath
    );

    const originalContent = fileContent.innerHTML;
    const originalDisplay = fileContent.style.display;

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

    buttonsGroup.appendChild(sourceBtn);
    buttonsGroup.appendChild(diagramBtn);

    fileContent.innerHTML = "";
    fileContent.style.display = "block";
    fileContent.appendChild(diagramContainer);
    fileContent.appendChild(sourceContainer);

    try {
      const viewer = new NavigatedViewer({
        container: diagramContainer,
      });
      await viewer.importXML(rawContent);
      const canvas = viewer.get("canvas") as { zoom: (mode: string) => void };
      canvas.zoom("fit-viewport");
      debug(`BPMN rendered successfully`);
    } catch (err) {
      debug("Failed to render BPMN", err);
      fileContent.innerHTML = originalContent;
      fileContent.style.display = originalDisplay;
      throw err;
    }

    showDiagram();

    return this;
  }
}