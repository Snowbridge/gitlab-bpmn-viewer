import { Configuration } from "../lib/configuration";
import browser from "webextension-polyfill";


const ICON_ENABLED = "/icons/icon16.png";
const ICON_DISABLED = "/icons/icon16gray.png";

export class ContextualIconUpdater {
    private config: Configuration;
    constructor(config: Configuration){
        this.config = config;
        this.subscribeListeners();
    }

    private subscribeListeners(){
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const self = this;
        browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            if (changeInfo.url && tab.status === "complete") {
                this.config.debug(`ContextualIconUpdater.onUpdated is called`, tabId, changeInfo.url);
                void self.updateIconForTab(tabId, changeInfo.url);
            }
        });
        browser.tabs.onActivated.addListener((activeInfo) => {
            this.config.debug(`ContextualIconUpdater.tabs.onActivated is called`, activeInfo);
            const execute = (tab: { url?: string }) => { void self.updateIconForTab(activeInfo.tabId, tab.url) };
            browser.tabs
                .get(activeInfo.tabId)
                .then(execute, execute);
        });

        browser.runtime.onInstalled.addListener((details)=>{
            this.config.debug(`ContextualIconUpdater.runtime.onInstalled by ${details.reason}`);
            void this.init();
        });

        browser.storage.onChanged.addListener((_changes, areaName) => {
            if (areaName === "local") {
                this.config.debug(`ContextualIconUpdater.storage.onChanged: Settings are changed`, _changes);
                void this.init()
            }
        });
    }

    async updateIconForTab(tabId: number, url?: string) {
        this.config.debug(`Updating icon for tab`, tabId, url);
        let path = ICON_DISABLED;

        const isHostConfigured = url && this.config.isHostConfigured(url);
        this.config.debug(`Host ${isHostConfigured ? 'IS' : 'is NOT'} configured`);

        if (isHostConfigured)
            path = ICON_ENABLED;

        await browser.action.setIcon({ tabId, path });
        this.config.debug(`The icon is set to ${path}`);
    }

    async init(){
        const [tab] = await browser.tabs.query({
            active: true,
            currentWindow: true,
        });
        
        if (tab && tab.id)
            void await this.updateIconForTab(tab.id, tab.url);
    }

}
