import { MESSAGE_TYPE_CONFIG_CHANGED } from "@/types/messages";
import { HostConfig, StoredSettings } from "@/types/settings";
import browser from "webextension-polyfill";
import urlMessageResolver from "./url-message-resolver";

function urlFromString(strUrl: string): URL {
    if (!strUrl.match(/^[a-z]\w*:\/\//))
        strUrl = `proto://${strUrl}`;
    return new URL(strUrl);
}

/**
 * Чтение и запись настроек расширения в local storage.
 * Этот класс не имеет подписок и напрямую используется только
 * и исключительно в форме редактирования настроек.
 */
export class BaseConfig {
    private STORAGE_KEY = "gl-bpmn-viewer-configuration";
    private hosts: Array<HostConfig> = [];
    private debugEnabled = false;
    private debugStackIncluded = false;

    private loadPromise?: Promise<this>;

    constructor() {
        this.init();
    }

    protected init() {
        this.loadPromise = undefined;
        return this;
    }

    async load(): Promise<this> {
        if (!this.loadPromise) {
            this.loadPromise = new Promise<this>((resolve, reject) => {
                browser.storage.local
                    .get(this.STORAGE_KEY)
                    .then((rawStorageData) => {
                        const settings = rawStorageData[this.STORAGE_KEY] as StoredSettings;
                        let hosts: Array<HostConfig> = [];
                        if (settings.hosts && Array.isArray(settings.hosts)) {
                            hosts = (settings.hosts)
                                .filter(it => it.host && it.token); // должны обязательно быть оба поля                           
                        }

                        this.update(hosts, settings.debugEnabled, settings.debugStackIncluded)

                        console.log(`Settings loaded from local storage successfully`);
                        resolve(this);
                    })
                    .catch((error) => {
                        console.log(`Can not load settings from local storage`, error);
                        reject(error);
                    });
            });
        }
        return this.loadPromise
    }

    update(hosts: Array<HostConfig>, isDebugEnabled: boolean, isDebugStackIncluded: boolean) {
        this.setHosts(hosts);
        this.debugEnabled = isDebugEnabled;
        this.debugStackIncluded = isDebugStackIncluded;
    }

    async save() {
        try {
            await browser.storage.local.set({
                [this.STORAGE_KEY]:
                {
                    hosts: [...this.hosts],
                    debugEnabled: this.debugEnabled,
                    debugStackIncluded: this.debugStackIncluded,
                }
            });
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
 * Специализация для использования на бэкграунде: добавляет подписку
 * на изменение local storage и перечитывает настройки.
 * Имеет статический метод для создания подписки, отправляющей контент-скрипту
 * сообщение о необходимости перечитать настройки
 */
export class BackgroundConfig extends BaseConfig {
    constructor() {
        super();

        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const self = this;
        if(!browser.storage.onChanged.hasListener(emptyWatchdogHandler)){
            browser.storage.onChanged.addListener(emptyWatchdogHandler)
            browser.storage.onChanged.addListener(async (_changes: Record<string, browser.Storage.StorageChange>, areaName: string) => {
                if (areaName === "local") {
                    console.log(`Settings changed in local storage, reloading`);
                    void await self.init().load();
                }    
            });
        }
            
    }
    
    /**
     * При изменениях настроек в хранилище отправляет фронту
     * сообщение о том, что надо перечитать конфиг.
     */
    static addBackgroundSubscriptionOnChange() {
        if (!browser.storage.onChanged.hasListener(relayConfigChangedEventToForeground))
            browser.storage.onChanged.addListener(relayConfigChangedEventToForeground);
    }
}

async function relayConfigChangedEventToForeground(_changes: Record<string, browser.Storage.StorageChange>, areaName: string) {
    if (areaName === "local") {
        const [tab] = await browser.tabs.query({
            active: true,
            currentWindow: true,
        });

        if (!tab.url || !tab.id)
            return;

        const isResolved = urlMessageResolver(tab.url);
        if (isResolved){
            console.log(
                "Relaying config changed event to foreground",
                tab.url
            );
            void await browser.tabs.sendMessage(tab.id, {
                type: MESSAGE_TYPE_CONFIG_CHANGED,
                url: tab.url,
            });
        }
    }
}

/**
 * Специализация для использования в контент-скриптах: добавляет
 * подписку на сообщение о необходимости перечитать настройки из local storage
 */
export class ForegroundConfig extends BaseConfig {
    constructor() {
        super();
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const self = this;
        if(!browser.runtime.onMessage.hasListener(emptyWatchdogHandler)){
            browser.runtime.onMessage.addListener(emptyWatchdogHandler);
            browser.runtime.onMessage.addListener((message: unknown) => {
                const typed = message as { type: string; url: string; token: string };
                if (typed.type == MESSAGE_TYPE_CONFIG_CHANGED) {
                    console.log(`Settings changed in local storage, reloading`);
                    self.init().load();
                }
            });    
        }
    }
}

function emptyWatchdogHandler(){/* empty by purpose */}