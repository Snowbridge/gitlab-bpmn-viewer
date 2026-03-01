/**
 * Агрегирует все логи на бэке для удобства траблшутинга:
 *  без этого логи будут поделены между сервис воркером
 *      и клиентской вкладкой, что предельно не удобно
 */

import { getExecutionContext } from "@/content/utils";
import { ExecutionContext } from "@/types";
import browser from "webextension-polyfill";

export const DEBUG_MESSAGE_TYPE = "gl-bpmn-viewer-debug-message";

/**
 * 1. Выводит в консоль дебаг-сообщения, если дебаг включен
 * 2. Ловит сообщения DEBUG_MESSAGE_TYPE и выводит в лог то, что прилетело, если дебаг включен
 */
export class Logger {
    private isDebugEnabled;
    private isDebugStackIncluded;

    constructor(isDebugEnabled: boolean, isDebugStackIncluded: boolean) {
        this.isDebugEnabled = isDebugEnabled;
        this.isDebugStackIncluded = isDebugStackIncluded;

        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const self = this;
        browser.runtime.onMessage.addListener(async (message: unknown) => {
            const typed = message as {
                type?: string;
                payload: {
                    timestamp: string;
                    message: string;
                    logger?: string;
                    data?: any[];
                    stack?: string[]
                };
            };
            if (typed.type !== DEBUG_MESSAGE_TYPE || !typed.payload) {
                return;
            }
            self.log(
                typed.payload.message,
                typed.payload.timestamp,
                typed.payload.logger,
                typed.payload.data,
                typed.payload.stack
            )
        });
    }

    /**
     * Отправить сообщение в debug-лог на бэке
     * @param message - текст сообщения
     * @param data - дополнительный контекст, массив с любыми данными
     * @returns 
     */
    debug(message: string, ...data: any[]): void {
        if (!this.isDebugEnabled)
            return;

        const timestamp = (new Date()).toISOString();

        const stack = (new Error).stack?.split('\n').slice(2, 5);
        const logger = stack?.at(0)?.trim();

        const payload: Record<string, any> = {};
        payload["message"] = message;
        payload["timestamp"] = timestamp;
        payload["logger"] = logger;

        if (data && (!Array.isArray(data) || data.length > 0))
            payload["data"] = data;

        if (this.isDebugStackIncluded)
            payload["stack"] = stack;

        // если это на бэкэнде, то сразу в консоль
        if (getExecutionContext() == ExecutionContext.ServiceWorker) {
            this.log(payload.message, payload.timestamp, payload.logger, payload.data, payload.stack);
        } else { // иначе отправляем на бэкэнд
            browser.runtime
                .sendMessage({
                    type: DEBUG_MESSAGE_TYPE,
                    payload: payload,
                })
        }
    }

    setDebugEnabled(isDebugEnabled: boolean) {
        this.isDebugEnabled = isDebugEnabled;
    }
    setDebugStackIncluded(isDebugStackIncluded: boolean) {
        this.isDebugStackIncluded = isDebugStackIncluded;
    }

    /**
     * Записать сообщение в консоль
     * @param message - текст сообщения
     * @param timestamp - timestamp
     * @param logger - logger
     * @param data - дополнительный контекст, массив с любыми данными
     * @param stack - stack
     */
    private log(message: string, timestamp: string, logger?: string, data?: any[], stack?: string[]) {
        const payload: any[] = [message, timestamp, logger ?? "<unknown>"];

        if (data)
            payload.concat([...data]);

        if (stack)
            payload.push(stack);

        console.log(`[gl-bpmn-viewer] DEBUG`, ...payload);
    }
}
