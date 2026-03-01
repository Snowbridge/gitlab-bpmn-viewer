/**
 * Типы для настроек и API
 */

export interface HostConfig {
  host: string;
  token: string;
}

export type Settings = {
  hosts: HostConfig[];
  /** Глобальный флаг включения отладочного вывода. */
  debugEnabled?: boolean;
  /** При включении добавляем stack trace в вывод debug. */
  debugPrintStack?: boolean;
};

export enum ExecutionContext {
  ServiceWorker,
  ExtensionPage,
  ContentScript
}

export const DEBUG_MESSAGE_TYPE = "gl-bpmn-viewer-debug-message";
export const INIT_MESSAGE_TYPE = "gl-bpmn-viewer-init";

/**
 * Эти классы:
 *  1. добавляют необходимые им подписки в конструкторе;
 *  2. имеют один единственный метод, который и выполняет всю логику фичи
 */
export interface ExtensionBackendFeature {
 /**
 * У расширения всего четыре фичи:
 * 1. [BE] Изменение иконки расширения в зависимости от урла табы и настроек
 *  - browser.tabs.onActivated
 *  - browser.tabs.onUpdated
 *  - browser.runtime.onInstalled
 *  - browser.storage.onChanged
 * 2. [FE] Добавление кнопки на диф-страницах
 *  - browser.webNavigation.onCommitted
 *  - browser.webNavigation.onHistoryStateUpdated
 *  - browser.tabs.onUpdated
 *  - browser.tabs.onActivated
 * 3. [FE] Добавление кнопки и визуализация на блоб-страницах
 *  - browser.webNavigation.onCommitted
 *  - browser.webNavigation.onHistoryStateUpdated
 *  - browser.tabs.onUpdated
 *  - browser.tabs.onActivated 
 * 4. [BE] Централизованный лог на бэке
 *  - browser.runtime.onMessage[DEBUG_MESSAGE_TYPE]
 */
  execute(...args: any[]): Promise<void>;
  init(): Promise<void>;
}