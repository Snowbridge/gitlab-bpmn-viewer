import { BackgroundConfig } from "@/lib/configuration";
import { Logger } from "@/lib/logger";
import urlMessageResolver from "@/lib/url-message-resolver";
import { MESSAGE_TYPE_CONFIG_CHANGED } from "@/types/messages";
import { BrowserApi, StorageChangeRecord } from "@/types/types";

export class BackgroundContentScriptsBootstraper {
    private browserApi: BrowserApi;
    private config: BackgroundConfig;
    private logger: Logger;
    constructor(browserApi: BrowserApi, config: BackgroundConfig, logger: Logger) {
        this.browserApi = browserApi;
        this.config = config;
        this.logger = logger;
    }

    async checkUrlAndTriggerContentScript(tabId: number, url: string, eventSource: string) {

        await this.config.load();
        if (!this.config.isHostConfigured(url)) {
            return;
        }

        const contentScriptTriggerMessage = urlMessageResolver(url);
        if (!contentScriptTriggerMessage) {
            this.logger.debug(`Content script trigger message ID is not resolved from URL`, url);
            return;
        }

        this.logger.debug(`Sending content script trigger message to foreground on [${eventSource}]`, url);

        try {
            await this.browserApi.tabs.sendMessage(tabId, {
                type: contentScriptTriggerMessage,
                url: url,
                eventSource: eventSource,
            });
        } catch (error: unknown) {
            const msg = (error as Error)?.message ?? String(error);
            if (msg.includes("Could not establish connection. Receiving end does not exist")) {
                this.logger.debug(
                    "Content script is not ready yet while sending message to foreground",
                    tabId,
                    url,
                    eventSource
                );

                // Self-healing: inject the content script and retry exactly once.
                const injected = await this.injectContentScript(tabId, url);
                if (injected) {
                    this.logger.debug(`Content script is forcibly injected from backend`, tabId, url);
                    try {
                        await this.browserApi.tabs.sendMessage(tabId, {
                            type: contentScriptTriggerMessage,
                            url: url,
                            eventSource: `${eventSource}[afterInject]`,
                        });
                    } catch (retryError: unknown) {
                        const retryMsg = (retryError as Error)?.message ?? String(retryError);
                        this.logger.debug(
                            "Something is terribly wrong. Failed to sendMessage even after content script force injection",
                            tabId,
                            url,
                            eventSource,
                            retryMsg
                        );
                    }
                }
            } else {
                this.logger.debug(
                    "Unexpected error while sending message to foreground",
                    tabId,
                    url,
                    eventSource,
                    msg
                );
            }
        }
    }

    async propagateStorageUpdatedEvent() {
        const [tab] = await this.browserApi.tabs.query({
            active: true,
            currentWindow: true,
        });

        if (!tab || !tab.url || !tab.id)
            return;

        const isResolved = urlMessageResolver(tab.url);
        if (isResolved) {
            this.logger.debug("Propagating config changed event to foreground", tab.url);
            try {
                void await this.browserApi.tabs.sendMessage(tab.id, {
                    type: MESSAGE_TYPE_CONFIG_CHANGED,
                    url: tab.url,
                });
            } catch {
                /* nothing: there's no content-script on the tab, so no need to update config either */
            }
        }
    }

    // SPA navigation: if the content script was not loaded on the initial document,
    // the browser will not automatically inject it after a History API route change.
    // Inject it manually when needed.
    async injectContentScript(tabId: number, url: string): Promise<boolean> {

        this.logger.debug(`Force injecting content script at a tab`, tabId, url);

        await this.config.load();

        if (!this.config.isHostConfigured(url)) return false;

        try {
            // In the built extension this file becomes `src/content/index.js`.
            await this.browserApi.scripting.executeScript({
                target: { tabId },
                files: ["src/content/index.js"],
            });
            return true;
        } catch (error: unknown) {
            const msg = (error as Error)?.message ?? String(error);
            this.logger.debug("Unable to inject content script via scripting.executeScript", tabId, url, msg);
            return false;
        }
    }

    static async addGlobalSubscriptions(contentScriptBootstraper: BackgroundContentScriptsBootstraper, browserApi: BrowserApi): Promise<void> {
        browserApi.tabs.onActivated.addListener(async (activeInfo) => {
          const tab = await browserApi.tabs.get(activeInfo.tabId);
          if (tab && tab.url) {
            void contentScriptBootstraper.checkUrlAndTriggerContentScript(activeInfo.tabId, tab.url, "onActivated");
          }
        });
      
        browserApi.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
          if (changeInfo.status === "complete" && tab.url) {
            void contentScriptBootstraper.checkUrlAndTriggerContentScript(tabId, tab.url, "onUpdated[Complete]");
          }
        });
      
        browserApi.webNavigation.onCommitted.addListener(
          (details) => {
            if (details.tabId && details.url) {
              void contentScriptBootstraper.checkUrlAndTriggerContentScript(details.tabId, details.url, "onCommitted");
            }
          },
          { url: [{ urlContains: "/-/blob/" }, { urlContains: "/-/merge_requests/" }] }
        );
      
        browserApi.webNavigation.onHistoryStateUpdated.addListener(
          (details) => {
            if (details.tabId && details.url) {
              void contentScriptBootstraper.checkUrlAndTriggerContentScript(details.tabId, details.url, "onHistoryStateUpdated");
            }
          },
          { url: [{ urlContains: "/-/blob/" }, { urlContains: "/-/merge_requests/" }] }
        );
      
        browserApi.storage.onChanged.addListener(
          async (_changes: StorageChangeRecord, areaName: string) => {
            if (areaName === "local") {
              contentScriptBootstraper.propagateStorageUpdatedEvent();
            }
          }
        );
      }
}