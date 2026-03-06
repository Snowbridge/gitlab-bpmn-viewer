import { BaseConfig } from "@/lib/configuration";
import { debug } from "@/lib/logger";
import browser from "webextension-polyfill";

const ICON_ENABLED = "/icons/icon16.png";
const ICON_DISABLED = "/icons/icon16gray.png";

function emptyWatchdogHandler(){/* empty by purpose */}

export class ContextualIconUpdater {
    private config: BaseConfig;
    constructor(config: BaseConfig){
        this.config = config;
        this.subscribeListeners();
    }

    private subscribeListeners(){

        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const self = this;
        if(!browser.tabs.onUpdated.hasListener(emptyWatchdogHandler)){
            browser.tabs.onUpdated.addListener(emptyWatchdogHandler);
            browser.tabs.onUpdated.addListener(async (tabId: number, _changeInfo: browser.Tabs.OnUpdatedChangeInfoType, tab: browser.Tabs.Tab) => {
                debug(`ContextualIconUpdater.onUpdated is called`, tabId, tab.url);
                void await self.updateIconForTab(tabId, tab.url);
            });
        }
            
        if(!browser.tabs.onActivated.hasListener(emptyWatchdogHandler)){
            browser.tabs.onActivated.addListener(emptyWatchdogHandler);
            browser.tabs.onActivated.addListener(async (activeInfo: browser.Tabs.OnActivatedActiveInfoType) => {
                debug(`ContextualIconUpdater.tabs.onActivated is called`, activeInfo);
                const execute = (tab: { url?: string }) => { void self.updateIconForTab(activeInfo.tabId, tab.url) };
                browser.tabs
                    .get(activeInfo.tabId)
                    .then(execute, execute);
            });
        }
            
        if(!browser.runtime.onInstalled.hasListener(emptyWatchdogHandler)){
            browser.runtime.onInstalled.addListener(emptyWatchdogHandler);
            browser.runtime.onInstalled.addListener(async (details: browser.Runtime.OnInstalledDetailsType) => {
                debug(`ContextualIconUpdater.runtime.onInstalled by ${details.reason}`);
                void await self.init();
            });
        }
            
        if(!browser.storage.onChanged.hasListener(emptyWatchdogHandler)){
            browser.storage.onChanged.addListener(emptyWatchdogHandler);
            browser.storage.onChanged.addListener(async (_changes: Record<string, browser.Storage.StorageChange>, areaName: string) => {
                if (areaName === "local") {
                    debug(`ContextualIconUpdater.storage.onChanged: Settings are changed`, _changes);
                    void await self.init()
                }
            });
        }
  
    }

    // Update icon for a given tab
    async updateIconForTab(tabId: number, url?: string) {
        debug(`Updating icon for tab`, tabId, url);
        let path = ICON_DISABLED;

        await this.config.load();

        const isHostConfigured = url && this.config.isHostConfigured(url);
        debug(`Host ${isHostConfigured ? 'IS' : 'is NOT'} configured fo url ${url}`);

        if (isHostConfigured)
            path = ICON_ENABLED;

        await browser.action.setIcon({ tabId, path });
        debug(`The icon is set to ${path}`);
    }

    // Request current tab and update icon, if successful
    async init(){
        const [tab] = await browser.tabs.query({
            active: true,
            currentWindow: true,
        });
        
        if (tab && tab.id)
            void await this.updateIconForTab(tab.id, tab.url);
    }

}
