const URL_REGEXP = /^\/?(.+?)\/-\/merge_requests\/(\d+)\/diffs\/?$/

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

export function inject(){

}