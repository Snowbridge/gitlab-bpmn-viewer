import { BackgroundConfig } from "@/lib/configuration";
import { debug } from "@/lib/logger";
import urlMessageResolver from "@/lib/url-message-resolver";
import browser from "webextension-polyfill";
import { ContextualIconUpdater } from "./contextual-icon-updater";
import type { BrowserApi, StorageChangeRecord } from "../types/types";
import { MESSAGE_TYPE_CONFIG_CHANGED } from "@/types/messages";

async function ensureContentScriptInjected(
  browserApi: BrowserApi,
  config: BackgroundConfig,
  tabId: number,
  url: string
): Promise<boolean> {
  await config.load();
  if (!config.isHostConfigured(url)) return false;

  // SPA navigation: if the content script was not loaded on the initial document,
  // the browser will not automatically inject it after a History API route change.
  // Inject it manually when needed.
  try {
    // In the built extension this file becomes `src/content/index.js`.
    await browserApi.scripting.executeScript({
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
  browserApi: BrowserApi,
  config: BackgroundConfig,
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
    await browserApi.tabs.sendMessage(tabId, {
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

      // Self-healing: inject the content script and retry exactly once.
      const injected = await ensureContentScriptInjected(browserApi, config, tabId, url);
      if (injected) {
        try {
          await browserApi.tabs.sendMessage(tabId, {
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
 * Runs the background script: registers listeners and initializes the icon updater.
 * Accepts browser API and config as parameters for testability.
 */
async function runBackgroundScript(browserApi: BrowserApi, config: BackgroundConfig): Promise<void> {
  browserApi.tabs.onActivated.addListener(async (activeInfo) => {
    const tab = await browserApi.tabs.get(activeInfo.tabId);
    if (tab && tab.url) {
      void checkUrlAndSendMessage(browserApi, config, activeInfo.tabId, tab.url, "onActivated");
    }
  });

  browserApi.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === "complete" && tab.url) {
      void checkUrlAndSendMessage(browserApi, config, tabId, tab.url, "onUpdated[Complete]");
    }
  });

  browserApi.webNavigation.onCommitted.addListener(
    (details) => {
      if (details.tabId && details.url) {
        void checkUrlAndSendMessage(browserApi, config, details.tabId, details.url, "onCommitted");
      }
    },
    { url: [{ urlContains: "/-/blob/" }, { urlContains: "/-/merge_requests/" }] }
  );

  browserApi.webNavigation.onHistoryStateUpdated.addListener(
    (details) => {
      if (details.tabId && details.url) {
        void checkUrlAndSendMessage(
          browserApi,
          config,
          details.tabId,
          details.url,
          "onHistoryStateUpdated"
        );
      }
    },
    { url: [{ urlContains: "/-/blob/" }, { urlContains: "/-/merge_requests/" }] }
  );

  browserApi.storage.onChanged.addListener(
    async (_changes: StorageChangeRecord, areaName: string) => {
      if (areaName === "local") {
        const [tab] = await browserApi.tabs.query({
          active: true,
          currentWindow: true,
        });

        if (!tab || !tab.url || !tab.id)
          return;

        const isResolved = urlMessageResolver(tab.url);
        if (isResolved) {
          debug("Relaying config changed event to foreground", tab.url);
          try {
            void await browserApi.tabs.sendMessage(tab.id, {
              type: MESSAGE_TYPE_CONFIG_CHANGED,
              url: tab.url,
            });
          } catch {
            /* nothing: there's no content-script on the tab, so no need to update config either */
          }
        }
      }
    }
  );

  await config.load();
  await new ContextualIconUpdater(config, browserApi).init();
  
}

const config = new BackgroundConfig();
runBackgroundScript(browser, config);
