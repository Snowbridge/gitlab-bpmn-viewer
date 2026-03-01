import browser from "webextension-polyfill";

import { messageMapEntry as diffMME } from "@/content/diff-page";
import { messageMapEntry as blobMME } from "@/content/blob-page";
import { Configuration } from "@/lib/configuration";

const EVENT_URL_FILTERS: browser.WebNavigation.EventUrlFilters = {
    url: [
        { urlContains: "/-/blob/" },
        { urlContains: "/-/merge_requests/" }
    ]
};

export class ContentScriptBootstraper {
    private messageMap: Array<{
        predicate: (url: string) => boolean,
        message: string
    }> = [];
    private config: Configuration;

    constructor(config: Configuration) {
        this.messageMap.push(diffMME);
        this.messageMap.push(blobMME);

        this.config = config;
        this.subscribeListeners();
    }

    async init(){
        const [tab] = await browser.tabs.query({
            active: true,
            currentWindow: true,
        });
        
        if (!tab || !tab.id || !tab.url)
            return;

        const messageId = this.resolveMessageId(tab.url);
        if (messageId)
            void await this.bootstrap(messageId, tab.id, tab.url);        
    }

    private async bootstrap(messageId: string, tabId: number, url: string) {
        await browser.tabs.sendMessage(tabId, {
            type: messageId,
            url,
        });
    }

    private resolveMessageId(url: string): string | undefined {
        if (this.config.isHostConfigured(url))
            return this.messageMap
                .find(it => it.predicate(url))
                ?.message;
    }

    private subscribeListeners() {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const self = this;
        
        browser.tabs.onActivated.addListener(async (activeInfo) => {
            this.config.debug(`tabs.onActivated is called`, activeInfo);
            const tab = await browser.tabs.get(activeInfo.tabId);
            if (!tab.url || !tab.id)
                return;

            const messageId = self.resolveMessageId(tab.url);
            if (messageId)
                self.bootstrap(messageId, tab.id, tab.url)
        });

        browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            if (changeInfo.url && tab.status === "complete") {
                this.config.debug(`tabs.onUpdated is called`, tabId, changeInfo.url);
                const messageId = self.resolveMessageId(changeInfo.url);
                if (messageId)
                    self.bootstrap(messageId, tabId, changeInfo.url)
            }
        });

        if (!browser.webNavigation) {
            this.config.debug(`webNavigation is not available`);
        }

        [
            { key: 'onCommitted', value: browser.webNavigation.onCommitted },
            { key: 'onHistoryStateUpdated', value: browser.webNavigation.onHistoryStateUpdated }
        ].forEach(kv => {
            const event = kv.value;
            if (!event) {
                this.config.debug(`Event is not supported ${kv.key}`);
                return;
            }
            event.addListener((details) => {
                if (details.frameId !== 0 || !details.tabId || !details.url)
                    return;
                const messageId = self.resolveMessageId(details.url);
                if (messageId)
                    self.bootstrap(messageId, details.tabId, details.url);
            }, EVENT_URL_FILTERS)

        });
    }
}