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
  debug(`Updating icon for tab`, tabId, url);
  let path = ICON_DISABLED;
  if (url && url.startsWith("http")) {
    const host = getHostFromUrl(url);
    const settings = await loadSettings();
    if (host && isHostConfigured(settings, host)) {
      path = ICON_ENABLED;
      debug(`Host IS configured`);
    } else
      debug(`Host is NOT configured`);
  }

  await browser.action.setIcon({ tabId, path });
  debug(`The icon is set to ${path}`);
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

// проверяет параметры табы и, если всё сходится, отправляет в нее сообщение "gl-bpmn-viewer-init"
async function tryInitContentForTab(tabId: number, url?: string): Promise<void> {
  debug(`Trying to initiate content-script for tab`, tabId, url);

  if (!url || !url.startsWith("http")) {
    debug(`Url is not an http*-address`, url);
    return;
  }

  const host = getHostFromUrl(url);
  if (!host) {
    debug(`Can't retrieve host from url`, url)
    return;
  }

  const settings = await loadSettings();
  if (!isHostConfigured(settings, host)) {
    debug(`Host is NOT configured in settings`, host);
    return;
  }

  if (!shouldInitForUrl(url)) {
    debug(`That tab is not a diff- or blob-page`, url);
    return;
  }

  try {
    await browser.tabs.sendMessage(tabId, {
      type: INIT_MESSAGE_TYPE,
      url,
    });
    debug(`Init message is sent to content-script, tab[${tabId}], url[${url}]`);
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
      debug(`Updating active tab`, tab.id, tab.url);
      await updateIconForTab(tab.id, tab.url);
      await tryInitContentForTab(tab.id, tab.url);
    }
  } catch {
    // Игнорируем (например, нет доступа к вкладке)
  }
}

browser.tabs.onActivated.addListener((activeInfo) => {
  debug(`tabs.onActivated is called`, activeInfo);
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
    debug(`tabs.onUpdated is called`, tabId, changeInfo.url);
    void updateIconForTab(tabId, changeInfo.url);
    void tryInitContentForTab(tabId, changeInfo.url);
  }
});

// Отслеживаем SPA-навигацию (history.pushState/replaceState и подобное) через webNavigation.
// Если разрешения нет, то придется нажимать F5 всякий раз, чтобы расширение сработало на blob- и diff-страницах
if (browser.webNavigation) {

  const eventUrlFilters: browser.WebNavigation.EventUrlFilters = {
    url: [
      { urlContains: "/-/blob/" },
      { urlContains: "/-/merge_requests/" }
    ]
  };

  [
    { key: 'onCommitted', value: browser.webNavigation.onCommitted },
    { key: 'onHistoryStateUpdated', value: browser.webNavigation.onHistoryStateUpdated }
  ].forEach(kv => {
    const event = kv.value;
    if (event) {
      event.addListener((details) => {
        if (details.frameId !== 0 || !details.tabId || !details.url) {
          return;
        }
        void tryInitContentForTab(details.tabId, details.url);
      }, eventUrlFilters)
    } else {
      debug(`Event is not supported ${kv.key}`);
    }
  });
} else {
  debug(`webNavigation is not available`);
}

browser.runtime.onInstalled.addListener(() => {
  void updateActiveTabIcon();
});

browser.storage.onChanged.addListener((_changes, areaName) => {
  if (areaName === "local") {
    debug(`Settings are changed`, areaName);
    void updateActiveTabIcon();
  }
});

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
  writeDebugMessageToConsole(typed.payload.timestamp, typed.payload.data, typed.payload.stack);
});

void updateActiveTabIcon();
