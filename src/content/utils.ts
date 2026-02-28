/**
 * Общие утилиты для content-скриптов (blob, diff и т.д.)
 */
import config from "../lib/configuration";
import browser from "webextension-polyfill";
import { DEBUG_MESSAGE_TYPE, ExecutionContext } from "../types";

export function createIconButton(
  iconPath: string,
  title: string
): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "gl-button btn btn-default btn-md";
  btn.title = title;
  const img = document.createElement("img");
  img.src = browser.runtime.getURL(iconPath);
  img.alt = title;
  img.style.cssText = "width:16px;height:16px;display:block;";
  btn.appendChild(img);
  return btn;
}

// определяет, в каком контексте выполняется код
export function getExecutionContext(): ExecutionContext {
  if (typeof document === "undefined")
    return ExecutionContext.ServiceWorker;
  else if (window.location.href.startsWith(browser.runtime.getURL("")))
    return ExecutionContext.ExtensionPage;
  return ExecutionContext.ContentScript;
}

/**
 * Общая функция логирования, обеспечивающая:
 *  - единство формата отладочных логов
 *  - наличие таймстэмпа
 *  - вывод стэка в зависимости от настроек
 * @param data - данные, которые нужно вывести в консоль
 */
export function debug(...data: any[]): void {
  const timestamp = (new Date()).toISOString();
  if(!config.isDebugEnabled())
    return;

  let stack = undefined;
  if (config.isDebugStackIncluded())
    stack = (new Error).stack?.split('\n');

  // если это на бэкэнде, то сразу в консоль
  if (getExecutionContext() == ExecutionContext.ServiceWorker) {
    writeDebugMessageToConsole(timestamp, data, stack);
  } else { // иначе отправляем на бэкэнд
    browser.runtime
      .sendMessage({
        type: DEBUG_MESSAGE_TYPE,
        payload: {
          data: data,
          timestamp: new Date().toISOString(),
          stack: (new Error()).stack?.split('\n')
        },
      })
      .catch((error) => {
        writeDebugMessageToConsole(timestamp, [`Debug message sending failed`, error, data], error?.stack.split('\n'));
      })
  }
}

// в дебаг лог пишет именно эта приватная функция, а публичная - только обёртка
export function writeDebugMessageToConsole(timestamp: string, data: any[], stack?: string[]) {
  console.log(`[gl-bpmn-viewer] DEBUG ${timestamp}`, data, stack?.slice(1).join('\n'));
}