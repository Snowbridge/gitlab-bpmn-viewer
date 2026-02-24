/**
 * Background script (Service Worker) — точка входа для MV3
 */
import browser from "webextension-polyfill";

import { getHostFromUrl, isHostConfigured, loadSettings } from "./../lib/settings";

const ICON_ENABLED = "src/icons/icon16.png";
const ICON_DISABLED = "src/icons/icon16gray.png";

async function updateIconForTab(tabId: number, url?: string): Promise<void> {
  if (!url || !url.startsWith("http")) {
    await browser.action.setIcon({
      tabId,
      path: ICON_DISABLED,
    });
    return;
  }

  const host = getHostFromUrl(url);
  const settings = await loadSettings();
  const configured = host ? isHostConfigured(settings, host) : false;

  await browser.action.setIcon({
    tabId,
    path: configured ? ICON_ENABLED : ICON_DISABLED,
  });
}

async function updateActiveTabIcon(): Promise<void> {
  const [tab] = await browser.tabs.query({
    active: true,
    currentWindow: true,
  });
  if (tab?.id && tab.url) {
    await updateIconForTab(tab.id, tab.url);
  }
}

browser.runtime.onInstalled.addListener(() => {
  console.log("[GitLab BPMN Viewer] Extension installed");
});

browser.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await browser.tabs.get(activeInfo.tabId);
  if (tab?.url) {
    await updateIconForTab(activeInfo.tabId, tab.url);
  }
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

// Инициализация иконки при старте
updateActiveTabIcon();
