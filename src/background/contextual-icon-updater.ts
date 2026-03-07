import { BackgroundConfig } from "@/lib/configuration";
import { Logger } from "@/lib/logger";
import type {
    BrowserApi,
    RuntimeOnInstalledDetailsType,
    StorageChangeRecord,
    TabsOnActivatedActiveInfoType,
    TabsOnUpdatedChangeInfoType,
    TabsTab,
} from "../types/types";

const ICON_ENABLED = "/icons/icon16.png" as const;
const ICON_DISABLED = "/icons/icon16gray.png" as const;

export class ContextualIconUpdater {
    private config: BackgroundConfig;
    private browserApi: BrowserApi;
    private logger: Logger;

    constructor(browserApi: BrowserApi, config: BackgroundConfig, logger: Logger) {
        this.config = config;
        this.browserApi = browserApi;
        this.logger = logger;
    }

    // Update icon for a given tab
    async updateIconForTab(tabId: number, url?: string, source?: string) {
        this.logger.debug(`Updating icon for tab from [${source ?? "<unknown>"}]`, tabId, url);
        
        await this.config.load();

        const isHostConfigured = url && this.config.isHostConfigured(url);
        this.logger.debug(`Host ${isHostConfigured ? 'IS' : 'is NOT'} configured fo url ${url}`);

        const path = isHostConfigured ? ICON_ENABLED : ICON_DISABLED;

        await this.browserApi.action.setIcon({ tabId, path });
        this.logger.debug(`The icon is set to ${path}`);
    }

    static async addGlobalSubscriptions(iconUpdater: ContextualIconUpdater, browserApi: BrowserApi): Promise<void> {

        browserApi.tabs.onUpdated.addListener(async (tabId: number, _changeInfo: TabsOnUpdatedChangeInfoType, tab: TabsTab) => {
            void await iconUpdater.updateIconForTab(tabId, tab.url, "tabs.onUpdated");
        });

        browserApi.tabs.onActivated.addListener(async (activeInfo: TabsOnActivatedActiveInfoType) => {
            let url = undefined;
            try {
                const tabInfo = await browserApi.tabs.get(activeInfo.tabId);
                url = tabInfo.url ?? undefined
            } catch {
                /* nothing */
            }
            void iconUpdater.updateIconForTab(activeInfo.tabId, url, "tabs.onActivated");
        });

        browserApi.runtime.onInstalled.addListener(async (_details: RuntimeOnInstalledDetailsType) => {
            const [tab] = await browserApi.tabs.query({
                active: true,
                currentWindow: true,
            });
            if (tab && tab.id)
                void await iconUpdater.updateIconForTab(tab.id, tab.url, "runtime.onInstalled");
        });

        browserApi.storage.onChanged.addListener(async (_changes: StorageChangeRecord, areaName: string) => {
            if (areaName === "local") {
                const [tab] = await browserApi.tabs.query({
                    active: true,
                    currentWindow: true,
                });
                if (tab && tab.id)
                    void await iconUpdater.updateIconForTab(tab.id, tab.url, "storage.onChanged");
            }
        });
    }
}
