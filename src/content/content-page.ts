import { debug } from "./utils";

const URL_REGEXP = /^\/?(.+?)\/-\/merge_requests\/(\d+)\/diffs\/?$/

export abstract class ContentPageScript {
    private rootElementId; // поведение скрипта привязывается к этому элементу и его потомкам
    private rootElementObserver?: MutationObserver;
    private isInitialized = false;

    constructor(rootElementId: string) {
        this.rootElementId = rootElementId;
    }

    // true, если скрипт принадлежит странице strUrl
    abstract matchesUrl(strUrl: string): boolean;

    init() {
        if(this.isInitialized)
            return;

        debug(`${this.constructor.name}::init()`);
        this.doStuff();

        const rootElement = document.getElementById(this.rootElementId);
        if (!rootElement || this.rootElementObserver) {
            return;
        }
        this.rootElementObserver = new MutationObserver(() => {
            this.doStuff();
        });
        this.rootElementObserver.observe(rootElement, { childList: true, subtree: true });

        this.isInitialized = true;
    }

    private doStuff() {

    }
}


/**
 * По урлу определить, подходит ли эта страница
 */
export function matchesUrl(url: string): boolean {
    try {
        return URL_REGEXP.test(new URL(url).pathname);
    } catch {
        return false;
    }
}


/**
 * init-метод, который инжектит скрипт в страницу и дополняет DOM всякими штуками и:
 *  - добавляет обзёрвер, чтобы дополнять
 *  - browser.tabs.onUpdated — при changeInfo.status === 'complete'
 *  - browser.webNavigation.onCompleted — загрузка завершена.
 *  - browser.tabs.onUpdated — обновление вкладки (в т.ч. changeInfo.url при смене адреса)
 *  - browser.webNavigation.onHistoryStateUpdated
 */

export function inject() {

}