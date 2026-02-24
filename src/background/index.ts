/**
 * Background script (Service Worker) — точка входа для MV3
 */
import browser from "webextension-polyfill";

import { getHostFromUrl, isHostConfigured, loadSettings } from "./../lib/settings";

const ICON_ENABLED = "/icons/icon16.png";
const ICON_DISABLED = "/icons/icon16gray.png";

async function updateIconForTab(tabId: number, url?: string): Promise<void> {
  let path = ICON_DISABLED;
  if (url && url.startsWith("http")) {
    const host = getHostFromUrl(url);
    const settings = await loadSettings();
    if (host && isHostConfigured(settings, host)) {
      path = ICON_ENABLED;
    }
  }

  await browser.action.setIcon({ tabId, path });
}

async function updateActiveTabIcon(): Promise<void> {
  try {
    const [tab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tab?.id != null) {
      await updateIconForTab(tab.id, tab.url);
    }
  } catch {
    // Игнорируем (например, нет доступа к вкладке)
  }
}

browser.runtime.onInstalled.addListener(() => {
  updateActiveTabIcon();
});

browser.tabs.onActivated.addListener((activeInfo) => {
  browser.tabs.get(activeInfo.tabId).then(
    (tab) => updateIconForTab(activeInfo.tabId, tab.url),
    () => updateIconForTab(activeInfo.tabId, undefined)
  );
});

browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url) {
    updateIconForTab(tabId, changeInfo.url);
  }
});

browser.storage.onChanged.addListener((_changes, areaName) => {
  if (areaName === "local") {
    updateActiveTabIcon();
  }
});

updateActiveTabIcon();
