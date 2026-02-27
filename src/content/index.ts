/**
 * Content script — внедряется в страницы GitLab.
 * Оркестратор: проверяет хост по настройкам (3.1) и делегирует blob- или diff-странице.
 */
import "bpmn-js/dist/assets/diagram-js.css";
import "bpmn-js/dist/assets/bpmn-js.css";

import browser from "webextension-polyfill";

import {
  getHostFromUrl,
  isHostConfigured,
  loadSettings,
  parseBlobUrl,
} from "../lib";
import { initBlobPage } from "./blob-page";
import { initDiffPage, isDiffPage } from "./diff-page";
import { debug } from "./utils";

/** URL страницы, для которой уже выполнялся init (избегаем двойного запуска). */
let lastInitUrl: string | null = null;

async function init(overrideUrl?: string): Promise<void> {
  debug("init for", overrideUrl);
  const url = overrideUrl ?? window.location.href;
  const host = getHostFromUrl(url);
  if (!host) {
    debug("init: no host");
    return;
  }

  const settings = await loadSettings();
  if (!isHostConfigured(settings, host)) {
    debug("init: host is not configured", { host });
    return;
  }

  const blobParts = parseBlobUrl(url);
  if (blobParts) {
    if (lastInitUrl === url) {
      debug("init: blobParts, already initialized for url", {
        lastInitUrl,
        url,
      });
      return;
    }
    lastInitUrl = url;
    setTimeout(() => {
      initBlobPage();
    }, 1500); 
    return;
  }

  if (isDiffPage(url)) {
    if (lastInitUrl === url) {
      debug("init: diffPage, already initialized for url", {
        lastInitUrl,
        url,
      });
      return;
    }
    lastInitUrl = url;
    setTimeout(() => {
      initDiffPage();
    }, 1500);    
    return;
  }

  lastInitUrl = url;
}

// Первичная инициализация при полной загрузке контент-скрипта.
void init();

// Инициализация по сигналу от background-скрипта (SPA-навигация и т.п.).
browser.runtime.onMessage.addListener((message: unknown) => {
  const typed = message as { type?: string; url?: string };
  debug("content onMessage", typed);
  if (typed.type === "gl-bpmn-viewer-init") {
    void init(typed.url);
  }
});
