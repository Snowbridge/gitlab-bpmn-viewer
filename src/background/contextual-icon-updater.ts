import { BackgroundConfig } from "@/lib/configuration";
import { debug } from "@/lib/logger";
import type {
  BrowserApi,
  RuntimeOnInstalledDetailsType,
  StorageChangeRecord,
  TabsOnActivatedActiveInfoType,
  TabsOnUpdatedChangeInfoType,
  TabsTab,
} from "../types/types";

const ICON_ENABLED = "/icons/icon16.png";
const ICON_DISABLED = "/icons/icon16gray.png";

function emptyWatchdogHandler(){/* empty by purpose */}

export class ContextualIconUpdater {
    private config: BackgroundConfig;
    private browserApi: BrowserApi;

    constructor(config: BackgroundConfig, browserApi: BrowserApi){
        this.config = config;
        this.browserApi = browserApi;
        this.subscribeListeners();
    }

    private subscribeListeners(){

        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const self = this;
        if(!this.browserApi.tabs.onUpdated.hasListener(emptyWatchdogHandler)){
            this.browserApi.tabs.onUpdated.addListener(emptyWatchdogHandler);
            this.browserApi.tabs.onUpdated.addListener(async (tabId: number, _changeInfo: TabsOnUpdatedChangeInfoType, tab: TabsTab) => {
                debug(`ContextualIconUpdater.onUpdated is called`, tabId, tab.url);
                void await self.updateIconForTab(tabId, tab.url);
            });
        }
            
        if(!this.browserApi.tabs.onActivated.hasListener(emptyWatchdogHandler)){
            this.browserApi.tabs.onActivated.addListener(emptyWatchdogHandler);
            this.browserApi.tabs.onActivated.addListener(async (activeInfo: TabsOnActivatedActiveInfoType) => {
                debug(`ContextualIconUpdater.tabs.onActivated is called`, activeInfo);
                const execute = (tab: { url?: string }) => { void self.updateIconForTab(activeInfo.tabId, tab.url) };
                this.browserApi.tabs
                    .get(activeInfo.tabId)
                    .then(execute, execute);
            });
        }
            
        if(!this.browserApi.runtime.onInstalled.hasListener(emptyWatchdogHandler)){
            this.browserApi.runtime.onInstalled.addListener(emptyWatchdogHandler);
            this.browserApi.runtime.onInstalled.addListener(async (details: RuntimeOnInstalledDetailsType) => {
                debug(`ContextualIconUpdater.runtime.onInstalled by ${details.reason}`);
                void await self.init();
            });
        }
            
        if(!this.browserApi.storage.onChanged.hasListener(emptyWatchdogHandler)){
            this.browserApi.storage.onChanged.addListener(emptyWatchdogHandler);
            this.browserApi.storage.onChanged.addListener(async (_changes: StorageChangeRecord, areaName: string) => {
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

        await this.browserApi.action.setIcon({ tabId, path });
        debug(`The icon is set to ${path}`);
    }

    // Request current tab and update icon, if successful
    async init(){
        const [tab] = await this.browserApi.tabs.query({
            active: true,
            currentWindow: true,
        });
        
        if (tab && tab.id)
            void await this.updateIconForTab(tab.id, tab.url);
    }

}
