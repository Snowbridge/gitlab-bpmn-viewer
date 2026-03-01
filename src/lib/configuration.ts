import { Logger } from "@/background/logger";
import { HostConfig } from "@/types";
import browser from "webextension-polyfill";

export class Configuration {

    private logger: Logger;
    private STORAGE_KEY = "gl-bpmn-viewer-configuration";
    private loadPromise: Promise<Configuration> | null = null;
    private hosts: Array<HostConfig> = [];
    private debugEnabled = false;
    private debugStackIncluded = false;

    /**
     * Подписывается на события, загружает настройки из хранилища
     * @returns 
     */
    async init(): Promise<Configuration> {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const self = this;
        browser.storage.onChanged.addListener((_changes, areaName) => {
            if (areaName === "local") {
                this.logger.debug(`Settings are changed`, areaName, _changes);
                self.loadFromStorage();
            }
        });

        browser.runtime.onInstalled.addListener(() => {
            self.loadFromStorage();
        });

        if (this.loadPromise === null) {
            this.loadPromise = this.loadFromStorage();
        }
        return this.loadPromise;
    }

    constructor(logger: Logger) {
        this.logger = logger;
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

        this.logger.setDebugEnabled(this.debugEnabled);
        this.logger.setDebugStackIncluded(this.debugStackIncluded);

        if (!this.hosts.length)
            this.logger.debug(`Hosts are not set up properly in settings, the extension is disabled`);
        return this;
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
            this.logger.debug(`Unable to parse url`, url, error);
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

    debug(message: string, ...data: any[]): void {
        this.logger.debug(message, data);
    }
}

function urlFromString(strUrl: string): URL {
    if (!strUrl.match(/^[a-z]\w*:\/\//))
        strUrl = `proto://${strUrl}`;
    return new URL(strUrl);
}
