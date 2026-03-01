/**
 * Логика дифф-страницы MR: кнопка открытия диаграммы у каждого .bpmn в списке изменений (фича 3.4).
 * Ответственность: только страницы вкладки «Changes» MR (маска merge_requests / id / diffs).
 */

import browser from "webextension-polyfill";
import config from "../lib/configuration";

import modalTemplate from "./diff-modal.html?raw";
import {
  fetchFileRaw,
  fetchMergeRequest,

  parseMergeRequestDiffsUrl,
} from "../lib";
import { createIconButton, debug } from "./utils";

/** Маска дифф-страницы MR: любой хост / путь / - / merge_requests / id / diffs */
const DIFF_PAGE_PATH_REGEX = /^\/?(.+?)\/-\/merge_requests\/(\d+)\/diffs\/?$/;

const MESSAGE_ID = `gl-bpmn-viewer-content-init-diff`;

export const messageMapEntry = {
  predicate: (url: string) => {
    try {
      return DIFF_PAGE_PATH_REGEX.test(url);
    } catch {
      return false;
    }
  },
  message: MESSAGE_ID
}

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

/** Имя кастомного события: контекст страницы вызывает APP.loadSource по данным из content script. */
const DIFF_APPLY_EVENT = "gl-bpmn-diff-apply";

function is404Error(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.message.includes("404") || (err as { status?: number }).status === 404)
  );
}

/**
 * Показывает предупреждение пользователю (файл отсутствует в одной из веток).
 */
function showWarning(message: string): void {
  debug(`showWarning`);
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
    debug(`showWarning closed`)
  }, 8000);
}

/**
 * Инжектирует в контекст страницы скрипт (внешний файл), который слушает событие с from/to и вызывает APP.loadSource.
 * Внешний скрипт нужен из‑за CSP: inline script на странице блокируется.
 */
function injectDiffApplyBridge(): void {
  debug(`injectDiffApplyBridge`);
  const script = document.createElement("script");
  script.src = browser.runtime.getURL("scripts/diff-apply-bridge.js");
  ; (document.head || document.documentElement).appendChild(script);
}

/**
 * Загружает обе версии файла. При 404 (файл добавлен/удалён в MR) возвращает сообщение об ошибке вместо контента.
 */
async function fetchBothVersionsOrError(
  origin: string,
  token: string,
  projectPath: string,
  filePath: string,
  refSource: string,
  refTarget: string
): Promise<
  | { from: string; to: string }
  | { error: string }
> {
  debug(`fetchBothVersionsOrError`);
  const [sourceResult, targetResult] = await Promise.allSettled([
    fetchFileRaw(origin, token, projectPath, refSource, filePath),
    fetchFileRaw(origin, token, projectPath, refTarget, filePath),
  ]);

  if (sourceResult.status === "rejected") {
    if (is404Error(sourceResult.reason)) {
      return {
        error:
          "Файл отсутствует в исходной ветке (удалён в MR). Сравнение диаграмм недоступно.",
      };
    }
    console.error("[GitLab BPMN Viewer] Failed to fetch source version:", sourceResult.reason);
    return { error: "Не удалось загрузить версию из исходной ветки." };
  }
  if (targetResult.status === "rejected") {
    if (is404Error(targetResult.reason)) {
      return {
        error:
          "Файл отсутствует в целевой ветке (добавлен в MR). Сравнение диаграмм недоступно.",
      };
    }
    console.error("[GitLab BPMN Viewer] Failed to fetch target version:", targetResult.reason);
    return { error: "Не удалось загрузить версию из целевой ветки." };
  }

  debug(`Both versions are fetched successfully`);
  return {
    from: sourceResult.value,
    to: targetResult.value,
  };
}

/**
 * Открывает модальное окно и передаёт уже загруженные from/to в APP.loadSource.
 * @param diagramBtn — кнопка (для закрытия по необходимости не используется, оставлен для единообразия).
 */
function openDiagramModalWithContent(
  _diagramBtn: HTMLElement,
  from: string,
  to: string
): void {
  debug(`openDiagramModalWithContent`);
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

/**
 * По клику: проверяет наличие файла в обеих ветках, при 404 показывает предупреждение, иначе открывает модалку с диффом.
 */
function onDiagramButtonClick(diagramBtn: HTMLElement): void {
  debug(`onDiagramButtonClick`);
  (async () => {
    const thirdParent = getThirdParent(diagramBtn);
    const filePath = thirdParent?.getAttribute("data-path") ?? null;
    if (!filePath) {
      debug("Element with 'data-path' attribute is NOT found");
      return;
    }

    const url = window.location.href;
    if (!config.isHostConfigured(url))
      return;

    const token = config.getToken(url);
    if (!token)
      return;

    debug(`Host and token are configured`);

    const mrParams = parseMergeRequestDiffsUrl(url);
    if (!mrParams) {
      console.error("[GitLab BPMN Viewer] Could not parse MR URL");
      return;
    }

    const origin = window.location.origin;
    let mrInfo: Awaited<ReturnType<typeof fetchMergeRequest>>;
    try {
      mrInfo = await fetchMergeRequest(
        origin,
        token,
        mrParams.projectPath,
        mrParams.mrIid
      );
    } catch (err) {
      console.error("[GitLab BPMN Viewer] Failed to fetch MR:", err);
      return;
    }

    const refSource = mrInfo.diff_refs?.head_sha ?? mrInfo.source_branch;
    const refTarget = mrInfo.diff_refs?.start_sha ?? mrInfo.target_branch;

    const result = await fetchBothVersionsOrError(
      origin,
      token,
      mrParams.projectPath,
      filePath,
      refSource,
      refTarget
    );

    if ("error" in result) {
      showWarning(result.error);
      return;
    }

    openDiagramModalWithContent(diagramBtn, result.from, result.to);
  })();
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
  debug("injectDiffDiagramButtons");

  const panels = document.querySelectorAll<HTMLElement>(
    DIFF_BPMN_FILE_ACTIONS_SELECTOR
  );

  debug(`injectDiffDiagramButtons: panels found ${panels.length}`);
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
      onDiagramButtonClick(diagramBtn);
    });

    fileActions.insertBefore(diagramBtn, fileActions.firstChild);
    debug(`injectDiffDiagramButtons: button inserted`)
  }
}

let diffObserver: MutationObserver | null = null;

/**
 * Инициализация дифф-страницы: кнопки у .bpmn и наблюдение за новыми файлами в списке.
 * Вызывать только если isDiffPage(url) и хост настроен (проверка в вызывающем коде).
 */
export function initDiffPage(): void {
  debug(`function initDiffPage()`);

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
