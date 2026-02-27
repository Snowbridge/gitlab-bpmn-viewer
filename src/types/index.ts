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