/**
 * Логика дифф-страницы MR: кнопка открытия диаграммы у каждого .bpmn в списке изменений (фича 3.4).
 * Ответственность: только страницы вкладки «Changes» MR (маска merge_requests / id / diffs).
 */

import browser from "webextension-polyfill";
import modalTemplate from "./diff-modal.html?raw";
import { createIconButton } from "./utils";

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
 * Открывает модальное окно: разметка из diff-modal.html, 80% размера окна,
 * закрытие по крестику, клику вне модалки и ESC.
 */
function openDiagramModal(): void {
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
  overlayEl.appendChild(script);
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
      openDiagramModal();
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
