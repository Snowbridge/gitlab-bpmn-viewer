/**
 * Background script (Service Worker) — точка входа для MV3
 */
import browser from "webextension-polyfill";

import {
  getHostFromUrl,
  isHostConfigured,
  loadSettings,
  parseBlobUrl,
  parseMergeRequestDiffsUrl,
} from "../lib";
import { DEBUG_MESSAGE_TYPE } from "@/types";
import { debug, writeDebugMessageToConsole } from "@/content/utils";

const ICON_ENABLED = "/icons/icon16.png";
const ICON_DISABLED = "/icons/icon16gray.png";

/** Сообщение, которое background отправляет в content-script для инициализации. */
const INIT_MESSAGE_TYPE = "gl-bpmn-viewer-init";

async function updateIconForTab(tabId: number, url?: string): Promise<void> {
  let path = ICON_DISABLED;
  if (url && url.startsWith("http")) {
    const host = getHostFromUrl(url);
    const settings = await loadSettings();
    if (host && isHostConfigured(settings, host)) {
      path = ICON_ENABLED;
    }
  }

  debug(`updateIconForTab`, tabId, path);
  await browser.action.setIcon({ tabId, path });
}

/**
 * Проверяет, нужно ли инициализировать контент-скрипт для данного URL.
 * Возвращает true только для blob- и diff-страниц GitLab.
 */
function shouldInitForUrl(url: string): boolean {
  if (!url.startsWith("http")) {
    return false;
  }

  // blob-страницы .bpmn
  if (parseBlobUrl(url)) {
    return true;
  }

  // страницы диффов MR
  if (parseMergeRequestDiffsUrl(url)) {
    return true;
  }

  return false;
}

async function tryInitContentForTab(tabId: number, url?: string): Promise<void> {

  if (!url || !url.startsWith("http")) {
    return;
  }

  const host = getHostFromUrl(url);
  if (!host) {
    return;
  }

  const settings = await loadSettings();
  if (!isHostConfigured(settings, host)) {
    return;
  }

  if (!shouldInitForUrl(url)) {
    return;
  }

  try {

    await browser.tabs.sendMessage(tabId, {
      type: INIT_MESSAGE_TYPE,
      url,
    });
  } catch {
    // Вкладка без нашего content-script — игнорируем.
  }
}

async function updateActiveTabIcon(): Promise<void> {
  try {
    const [tab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tab?.id != null) {
      await updateIconForTab(tab.id, tab.url);
      await tryInitContentForTab(tab.id, tab.url);
    }
  } catch {
    // Игнорируем (например, нет доступа к вкладке)
  }
}

browser.runtime.onInstalled.addListener(() => {
  void updateActiveTabIcon();
});

browser.tabs.onActivated.addListener((activeInfo) => {
  browser.tabs.get(activeInfo.tabId).then(
    (tab) => {
      void updateIconForTab(activeInfo.tabId, tab.url);
      if (tab.url) {
        void tryInitContentForTab(activeInfo.tabId, tab.url);
      }
    },
    () => {
      void updateIconForTab(activeInfo.tabId, undefined);
    }
  );
});

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url && tab.status === "complete") {
    void updateIconForTab(tabId, changeInfo.url);
    void tryInitContentForTab(tabId, changeInfo.url);
  }
});

// Отслеживаем SPA-навигацию (history.pushState/replaceState и подобное) через webNavigation.
if (browser.webNavigation) {
  browser.webNavigation.onCommitted.addListener(
    (details) => {

      if (details.frameId !== 0 || !details.tabId || !details.url) {
        return;
      }
      void tryInitContentForTab(details.tabId, details.url);
    },
    { url: [{ urlContains: "/-/blob/" }, { urlContains: "/-/merge_requests/" }] }
  );

  if (browser.webNavigation.onHistoryStateUpdated) {
    browser.webNavigation.onHistoryStateUpdated.addListener(
      (details) => {

        if (details.frameId !== 0 || !details.tabId || !details.url) {
          return;
        }
        void tryInitContentForTab(details.tabId, details.url);
      },
      { url: [{ urlContains: "/-/blob/" }, { urlContains: "/-/merge_requests/" }] }
    );
  }
}

browser.storage.onChanged.addListener((_changes, areaName) => {
  if (areaName === "local") {
    void updateActiveTabIcon();
  }
});

void updateActiveTabIcon();

browser.runtime.onMessage.addListener(async (message: unknown) => {
  const typed = message as {
    type?: string;
    payload: {
      timestamp: string;
      data: any[];
      stack?: string[]
    };
  };
  if (typed.type !== DEBUG_MESSAGE_TYPE || !typed.payload) {
    return;
  }
  writeDebugMessageToConsole(typed.payload.timestamp,typed.payload.data, typed.payload.stack);
});
