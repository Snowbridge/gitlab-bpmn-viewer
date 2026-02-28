import { debug } from "@/content/utils";
import { HostConfig } from "@/types";
import browser from "webextension-polyfill";

class Configuration {

    private STORAGE_KEY = "gl-bpmn-viewer-configuration";
    private loadPromise: Promise<void> | null = null;
    private hosts: Array<HostConfig> = [];
    private debugEnabled = false;
    private debugStackIncluded = false;

    async init(): Promise<void> {
        if (this.loadPromise === null) {
            this.loadPromise = this.loadFromStorage();
        }
        return this.loadPromise;
    }

    constructor() {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const self = this;
        browser.storage.onChanged.addListener((_changes, areaName) => {
            if (areaName === "local") {
                debug(`Configuration::storage.onChanged: Settings are changed`, areaName);
                self.loadFromStorage();
            }
        });
    }

    private async loadFromStorage() {
        const result = await browser.storage.local.get(this.STORAGE_KEY);
        const raw = result[this.STORAGE_KEY] as Record<string, boolean | Array<HostConfig>>;

        if (Object.prototype.hasOwnProperty.call(raw, "hosts") && Array.isArray(raw.hosts)) {
            const hosts = (raw.hosts as Array<HostConfig>)
                .filter(it =>
                    ["host", "token"]
                        .every(field => Object.prototype.hasOwnProperty.call(it, field)) // должны обязательно быть оба поля
                );
            this.setHosts(hosts);
        } else
            this.hosts = [];

        if (Object.prototype.hasOwnProperty.call(raw, "debugEnabled"))
            this.debugEnabled = raw.debugEnabled as boolean | false;
        if (Object.prototype.hasOwnProperty.call(raw, "debugStackIncluded"))
            this.debugStackIncluded = raw.debugStackIncluded as boolean | false;

        if (!this.hosts.length)
            debug(`Hosts are not set up properly in settings, the extension is disabled`);
    }

    async update(hosts: Array<HostConfig>, isDebugEnabled: boolean, isDebugStackIncluded: boolean) {
        this.setHosts(hosts);
        this.debugEnabled = isDebugEnabled;
        this.debugStackIncluded = isDebugStackIncluded;
        await this.save();
    }

    private async save() {
        await browser.storage.local.set({
            [this.STORAGE_KEY]:
            {
                hosts: [...this.hosts],
                debugEnabled: this.debugEnabled,
                debugStackIncluded: this.debugStackIncluded,
            }
        });
    }

    private setHosts(hosts: Array<HostConfig>) {
        this.hosts = hosts
            .map(row => {
                const url = urlFromString(row.host);
                if (!row.host.includes(url.host))
                    throw Error(`Gitlab BPMN Viewer cant operate non-latin domains right now`);
                return { host: url.host, token: row.token } as HostConfig;
            })
            .filter(it => it.host.length > 0 && it.token.length > 0)
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
            return this.hosts.some(it => it.host == host)
        } catch (error) {
            debug(`Unable to parse url`, url, error);
        }
        return false;
    }

    getToken(url: string): string | undefined {
        const host = urlFromString(url).host;
        const hostConfig = this.hosts.filter(it => it.host == host).shift();
        return hostConfig?.token;
    }

    getHosts(): Array<HostConfig> {
        return this.hosts.map(it => { return { host: it.host, token: it.token } as HostConfig });
    }
}

function urlFromString(strUrl: string): URL {
    if (!strUrl.match(/^[a-z]\w*:\/\//))
        strUrl = `proto://${strUrl}`;
    return new URL(strUrl);
}

const configInstance = new Configuration();
/** Дождаться перед первым использованием конфига. Потребители делают await configReady в начале своей инициализации. */
export default configInstance;
