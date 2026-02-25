/**
 * Логика дифф-страницы MR: кнопка открытия диаграммы у каждого .bpmn в списке изменений (фича 3.4).
 * Ответственность: только страницы вкладки «Changes» MR (маска merge_requests / id / diffs).
 */

import browser from "webextension-polyfill";
import modalTemplate from "./diff-modal.html?raw";
import {
  fetchFileRaw,
  fetchMergeRequest,
  getHostFromUrl,
  getTokenForHost,
  isHostConfigured,
  loadSettings,
  parseMergeRequestDiffsUrl,
} from "../lib";
import { createIconButton } from "./utils";

/** Глобальный объект APP, добавляемый скриптом diff-app.js */
declare global {
  interface Window {
    APP?: {
      loadSource: (panel: "left" | "right", payload: { xml: string }) => void;
    };
  }
}

/** Маска дифф-страницы MR: любой хост / путь / - / merge_requests / id / diffs */
const DIFF_PAGE_PATH_REGEX = /\/-\/merge_requests\/\d+\/diffs\/?$/;

/** Панели инструментов просмотра BPMN на дифф-странице (фича 3.4) */
const DIFF_BPMN_FILE_ACTIONS_SELECTOR =
  '#diffs div.diff-file.file-holder[data-path$=".bpmn"] > div.file-title > div.file-actions';

/** Маркер, что в панель уже добавлена наша кнопка (избегаем дублирования). */
const DIFF_DIAGRAM_BTN_MARKER = "data-gl-bpmn-diff-btn";

/** Селектор оверлея модалки (клик по нему закрывает). */
const MODAL_OVERLAY_SELECTOR = ".gl-bpmn-diff-modal-overlay";
/** Селектор кнопки закрытия. */
const MODAL_CLOSE_SELECTOR = ".gl-bpmn-diff-modal-close";

/**
 * Возвращает третьего родителя элемента (или null).
 */
function getThirdParent(el: HTMLElement): HTMLElement | null {
  let current: HTMLElement | null = el;
  for (let i = 0; i < 3 && current; i++) {
    current = current.parentElement;
  }
  return current;
}

/**
 * Ждёт появления глобального APP (после загрузки diff-app.js).
 */
function waitForAPP(timeoutMs = 10000): Promise<NonNullable<Window["APP"]>> {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const check = (): void => {
      if (window.APP) {
        resolve(window.APP);
        return;
      }
      if (Date.now() >= deadline) {
        reject(new Error("APP not loaded"));
        return;
      }
      setTimeout(check, 50);
    };
    check();
  });
}

/**
 * Открывает модальное окно, загружает две версии файла (from/to branch) и передаёт их в APP.loadSource.
 * @param diagramBtn — кнопка «Открыть диаграмму»; у её третьего родителя берётся data-path.
 */
function openDiagramModal(diagramBtn: HTMLElement): void {
  const wrap = document.createElement("div");
  wrap.innerHTML = modalTemplate;
  const overlay = wrap.querySelector<HTMLElement>(MODAL_OVERLAY_SELECTOR);
  if (!overlay) {
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

  // Подгрузка и запуск скрипта диффа (соответствует diff.html + app-d.js)
  const script = document.createElement("script");
  script.src = browser.runtime.getURL("scripts/diff-app.js");
  script.async = true;
  script.onload = (): void => {
    loadAndShowDiff();
  };
  overlayEl.appendChild(script);

  async function loadAndShowDiff(): Promise<void> {
    const thirdParent = getThirdParent(diagramBtn);
    const filePath = thirdParent?.getAttribute("data-path") ?? null;
    if (!filePath) {
      console.error("[GitLab BPMN Viewer] data-path not found");
      return;
    }

    const url = window.location.href;
    const host = getHostFromUrl(url);
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

    const mrParams = parseMergeRequestDiffsUrl(url);
    if (!mrParams) {
      console.error("[GitLab BPMN Viewer] Could not parse MR URL");
      return;
    }

    const origin = window.location.origin;

    let from: string;
    let to: string;
    try {
      const { source_branch, target_branch } = await fetchMergeRequest(
        origin,
        token,
        mrParams.projectPath,
        mrParams.mrIid
      );
      const [fromContent, toContent] = await Promise.all([
        fetchFileRaw(
          origin,
          token,
          mrParams.projectPath,
          source_branch,
          filePath
        ),
        fetchFileRaw(
          origin,
          token,
          mrParams.projectPath,
          target_branch,
          filePath
        ),
      ]);
      from = fromContent;
      to = toContent;
    } catch (err) {
      console.error("[GitLab BPMN Viewer] Failed to fetch file versions:", err);
      return;
    }

    try {
      const APP = await waitForAPP();
      APP.loadSource("left", { xml: to });
      APP.loadSource("right", { xml: from });
    } catch (err) {
      console.error("[GitLab BPMN Viewer] APP.loadSource failed:", err);
    }
  }
}

export function isDiffPage(url: string): boolean {
  try {
    return DIFF_PAGE_PATH_REGEX.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

/**
 * Внедряет кнопки открытия диаграммы в панели BPMN-файлов.
 * Кнопка добавляется первым элементом в div.file-actions.
 */
function injectDiffDiagramButtons(): void {
  const panels = document.querySelectorAll<HTMLElement>(
    DIFF_BPMN_FILE_ACTIONS_SELECTOR
  );
  for (const fileActions of panels) {
    if (fileActions.hasAttribute(DIFF_DIAGRAM_BTN_MARKER)) {
      continue;
    }
    fileActions.setAttribute(DIFF_DIAGRAM_BTN_MARKER, "true");

    const diagramBtn = createIconButton(
      "icons/icon16.png",
      "Открыть диаграмму"
    );
    diagramBtn.addEventListener("click", () => {
      openDiagramModal(diagramBtn);
    });

    fileActions.insertBefore(diagramBtn, fileActions.firstChild);
  }
}

let diffObserver: MutationObserver | null = null;

/**
 * Инициализация дифф-страницы: кнопки у .bpmn и наблюдение за новыми файлами в списке.
 * Вызывать только если isDiffPage(url) и хост настроен (проверка в вызывающем коде).
 */
export function initDiffPage(): void {
  injectDiffDiagramButtons();

  const diffsRoot = document.getElementById("diffs");
  if (!diffsRoot || diffObserver) {
    return;
  }
  diffObserver = new MutationObserver(() => {
    injectDiffDiagramButtons();
  });
  diffObserver.observe(diffsRoot, { childList: true, subtree: true });
}
