import { MESSAGE_TYPE_CONFIG_CHANGED } from "@/types/messages";
import { HostConfig, StoredSettings } from "@/types/settings";
import type { BrowserApi, StorageChangeRecord } from "@/types/types";

function urlFromString(strUrl: string): URL {
    if (!strUrl.match(/^[a-z]\w*:\/\//))
        strUrl = `https://${strUrl}`;
    return new URL(strUrl);
}

/**
 * Reading and writing extension settings in local storage.
 * This class has no subscriptions and is used directly only
 * in the settings editing form.
 */
export abstract class BaseConfig {
    private STORAGE_KEY = "gl-bpmn-viewer-configuration";
    private hosts: Array<HostConfig> = [];
    private debugEnabled = false;
    private debugStackIncluded = false;
    private loadPromise?: Promise<this>;
    protected readonly browserApi: BrowserApi;

    constructor(browserApi: BrowserApi) {
        this.browserApi = browserApi;
        this.subscribeListeners();
    }

    protected abstract subscribeListeners(): void;

    async refresh(): Promise<this> {
        if (this.debugEnabled)
            console.log(`Reloading config from storage`);

        this.loadPromise = undefined;
        return await this.load();
    }

    async load(): Promise<this> {
        if (this.loadPromise)
            return this.loadPromise;

        this.loadPromise = new Promise<this>((resolve, reject) => {
            this.browserApi.storage.local.get(this.STORAGE_KEY)
                .then((rawStorageData) => {
                    const rawSettings = rawStorageData[this.STORAGE_KEY] as Partial<StoredSettings> | undefined;
                    if (!rawSettings) {
                        if (this.debugEnabled)
                            console.log(`No settings found in local storage`);
                        return resolve(this);
                    }

                    const debugEnabled = rawSettings?.debugEnabled == true;
                    const debugStackIncluded = rawSettings?.debugStackIncluded == true;

                    const hosts = Array.isArray(rawSettings?.hosts) ? rawSettings.hosts : [];
                    this.update(hosts, debugEnabled, debugStackIncluded);
                    if (debugEnabled)
                        console.log(`Settings loaded from local storage successfully`);
                    resolve(this);
                })
                .catch((error) => {
                    console.log(`Can not load settings from local storage`, error);
                    reject(this);
                })
        });

        return this.loadPromise;
    }

    update(hosts: Array<HostConfig>, isDebugEnabled: boolean, isDebugStackIncluded: boolean) {
        this.debugEnabled = isDebugEnabled;
        this.debugStackIncluded = isDebugStackIncluded;
        this.setHosts(hosts);
    }

    async save() {
        try {
            await this.browserApi.storage.local.set({
                [this.STORAGE_KEY]:
                {
                    hosts: [...this.hosts],
                    debugEnabled: this.debugEnabled,
                    debugStackIncluded: this.debugStackIncluded,
                }
            });
            if (this.debugEnabled)
                console.log(`Settings saved in local storage successfully`);
        } catch (error) {
            console.log(`Unable to save settings in local storage`, error);
            throw error;
        }
    }

    private setHosts(hosts: Array<HostConfig>) {
        this.hosts = hosts
            .map(row => {
                const url = urlFromString(row.host);
                return { host: url.host, token: row.token } as HostConfig;
            })
            .filter(it => it.host.length > 0 && it.token.length > 0);
        if (this.debugEnabled)
            console.log(`Loaded hosts [${this.hosts.map(it => it.host).join(', ')}]`);
    }

    isDebugEnabled(): boolean {
        return this.debugEnabled;
    }

    isDebugStackIncluded(): boolean {
        return this.debugStackIncluded;
    }

    isHostConfigured(url: string): boolean {
        try {
            const host = urlFromString(url).host;
            if (this.debugEnabled)
                console.log(`Checking ${host} among known hosts: [${this.hosts.map(it => it.host).join(', ')}]`);
            return this.hosts.some(it => it.host.toLowerCase() == host.toLowerCase());
        } catch (error) {
            console.log(`Unable to parse url`, url, error);
        }
        return false;
    }

    getToken(url: string): string {
        const host = urlFromString(url).host;
        const hostConfig = this.hosts.filter(it => it.host == host).shift();
        return hostConfig?.token ?? '<no token in settings for this host>';
    }

    getHosts(): Array<HostConfig> {
        return this.hosts.map(it => { return { host: it.host, token: it.token } as HostConfig });
    }
}

/**
 * Specialized config for background scripts:
 *  it refreshes itself on browser.storage.onChanged
 */
export class BackgroundConfig extends BaseConfig {
    subscribeListeners() {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const self = this;
        this.browserApi.storage.onChanged.addListener(async (_changes: StorageChangeRecord, areaName: string) => {
            if (areaName === "local") {
                await self.refresh();
            }
        })
    }
}

/**
 * Specialization for usage in content scripts: 
 *  self refreshing on browser.runtime.onMessage[MESSAGE_TYPE_CONFIG_CHANGED]
 */
export class ForegroundConfig extends BaseConfig {
    subscribeListeners() {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const self = this;
        this.browserApi.runtime.onMessage.addListener(async (message: unknown) => {
            const typed = message as { type: string; url: string; token: string };
            if (typed.type == MESSAGE_TYPE_CONFIG_CHANGED) {
                await self.refresh();
            }
        });
    }
}
