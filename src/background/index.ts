import { BackgroundConfig } from "@/lib/configuration";
import { debug } from "@/lib/logger";
import urlMessageResolver from "@/lib/url-message-resolver";
import browser from "webextension-polyfill";
import { ContextualIconUpdater } from "./contextual-icon-updater";

const config = new BackgroundConfig();

/**
 * Отправляет контент-странице сообщение для внедрения функционала расширения.
 * Работает только на хостах, которые есть в настройках.
 * Ошибку "Receiving end does not exist" гасим и логируем как debug.
 */
async function checkUrlAndSendMessage(
  tabId: number,
  url: string,
  eventSource: string
) {
  await config.load();
  if (!config.isHostConfigured(url)) {
    return;
  }

  const message = urlMessageResolver(url);
  if (!message) {
    debug(`Message ID is not resolved from URL`, url);
    return;
  }

  debug(`Sending message to foreground on [${eventSource}]`, url);

  try {
    await browser.tabs.sendMessage(tabId, {
      type: message,
      url: url,
      eventSource: eventSource,
    });
  } catch (error: unknown) {
    const msg = (error as Error)?.message ?? String(error);
    if (msg.includes("Could not establish connection. Receiving end does not exist")) {
      debug(
        "Content script is not ready yet while sending message to foreground",
        tabId,
        url,
        eventSource
      );
    } else {
      debug(
        "Unexpected error while sending message to foreground",
        tabId,
        url,
        eventSource,
        msg
      );
    }
  }
}

/**
 * Глобальные подписки, которые триггерят отправку сообщения в контент-скрипт,
 * если вкладка находится в readyTabs.
 */
browser.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await browser.tabs.get(activeInfo.tabId);
  if (tab && tab.url) {
    void checkUrlAndSendMessage(activeInfo.tabId, tab.url, "onActivated");
  }
});

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    void checkUrlAndSendMessage(tabId, tab.url, "onUpdated[Complete]");
  }
});

browser.webNavigation.onCommitted.addListener(
  (details) => {
    if (details.tabId && details.url) {
      void checkUrlAndSendMessage(details.tabId, details.url, "onCommitted");
    }
  },
  { url: [{ urlContains: "/-/blob/" }, { urlContains: "/-/merge_requests/" }] }
);

browser.webNavigation.onHistoryStateUpdated.addListener(
  (details) => {
    if (details.tabId && details.url) {
      void checkUrlAndSendMessage(
        details.tabId,
        details.url,
        "onHistoryStateUpdated"
      );
    }
  },
  { url: [{ urlContains: "/-/blob/" }, { urlContains: "/-/merge_requests/" }] }
);

async function initBackgroundScript() {
  await config.load();
  await new ContextualIconUpdater(config).init();
}

void initBackgroundScript();