import { BackgroundConfig } from "@/lib/configuration";
import { debug } from "@/lib/logger";
import urlMessageResolver from "@/lib/url-message-resolver";
import browser from "webextension-polyfill";
import { ContextualIconUpdater } from "./contextual-icon-updater";
import { MESSAGE_TYPE_CONFIG_CHANGED } from "@/types/messages";

const config = new BackgroundConfig();

async function ensureContentScriptInjected(tabId: number, url: string): Promise<boolean> {
  await config.load();
  if (!config.isHostConfigured(url)) return false;

  // Для SPA-навигаций: если content script не был загружен на стартовой странице,
  // браузер не подгрузит его сам при History API переходе.
  // Поэтому при необходимости инжектим вручную.
  try {
    // В собранном расширении файл будет `src/content/index.js`.
    await browser.scripting.executeScript({
      target: { tabId },
      files: ["src/content/index.js"],
    });
    return true;
  } catch (error: unknown) {
    const msg = (error as Error)?.message ?? String(error);
    debug("Unable to inject content script via scripting.executeScript", tabId, url, msg);
    return false;
  }
}

/**
 * Sends a message to the content page to inject extension functionality.
 * Works only on hosts that are present in the settings.
 * The "Receiving end does not exist" error is suppressed and logged as debug.
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

      // Попытка самовосстановления: инжектим content script и ретраим ровно 1 раз.
      const injected = await ensureContentScriptInjected(tabId, url);
      if (injected) {
        try {
          await browser.tabs.sendMessage(tabId, {
            type: message,
            url: url,
            eventSource: `${eventSource}[afterInject]`,
          });
        } catch (retryError: unknown) {
          const retryMsg = (retryError as Error)?.message ?? String(retryError);
          debug(
            "Retry sendMessage failed after content script injection",
            tabId,
            url,
            eventSource,
            retryMsg
          );
        }
      }
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
 * Global subscriptions that trigger sending a message to the content script.
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

browser.storage.onChanged.addListener(async (_changes: Record<string, browser.Storage.StorageChange>, areaName: string) => {
  if (areaName === "local") {
    const [tab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!tab || !tab.url || !tab.id)
      return;

    const isResolved = urlMessageResolver(tab.url);
    if (isResolved) {
      debug("Relaying config changed event to foreground", tab.url);
      try {
        void await browser.tabs.sendMessage(tab.id, {
          type: MESSAGE_TYPE_CONFIG_CHANGED,
          url: tab.url,
        });
      } catch {
        /* nothing: there's no content-script on the tab, so no need to update config either */
      }
    }
  }
});

async function initBackgroundScript() {
  await config.load();
  await new ContextualIconUpdater(config).init();
}

void initBackgroundScript();