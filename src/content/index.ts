/**
 * Content script — внедряется в страницы GitLab.
 * Оркестратор: проверяет хост по настройкам (3.1) и делегирует blob- или diff-странице.
 */
import "bpmn-js/dist/assets/diagram-js.css";
import "bpmn-js/dist/assets/bpmn-js.css";

import {
  getHostFromUrl,
  isHostConfigured,
  loadSettings,
  parseBlobUrl,
} from "../lib";
import { initBlobPage } from "./blob-page";
import { initDiffPage, isDiffPage } from "./diff-page";

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
    await initBlobPage();
    return;
  }

  if (isDiffPage(url)) {
    if (lastInitUrl === url) {
      return;
    }
    lastInitUrl = url;
    initDiffPage();
    return;
  }

  lastInitUrl = url;
  // TODO: 3.2 — контекстное меню
  console.log("[GitLab BPMN Viewer] Content active for host:", host);
}

/** Интервал опроса URL (мс); срабатывает при переходе на blob без полной перезагрузки. */
const URL_POLL_INTERVAL_MS = 350;
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

  startUrlPolling();
}

init();
setupNavigationListeners();
