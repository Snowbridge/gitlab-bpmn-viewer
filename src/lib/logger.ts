import { BackgroundConfig } from "./configuration";

const config = new BackgroundConfig();
config.load();

interface LogRecord {
    message: string;
    timestamp: string;
    logger: string;
    data?: any[];
    stack?: string[];
}

/**
 * Пишет логи в едином формате и в зависимости
 * от настроек debugEnabled и debugStackIncluded в local storage
 * @param message сообщение
 * @param data массив с произвольными данными
 */
export function debug(message: string, ...data: any[]): void {

    const timestamp = (new Date()).toISOString();
    const rawStack = (new Error).stack ?? "<unknown>";

    config.load()
        .then(() => {
            if (!config.isDebugEnabled())
                return;

            const stack = rawStack.split('\n').slice(2, 5);

            const payload: LogRecord = {
                message: message,
                timestamp: timestamp,
                logger: stack.at(1)?.trim() ?? "<unknown>", // строчка кода, из которой вызван debug()
            };

            if (data && (!Array.isArray(data) || data.length > 0))
                payload.data = data;

            if (config.isDebugStackIncluded())
                payload.stack = stack.slice(2, 5) ?? ["<unknown>"];

            log(payload.message, payload.timestamp, payload.logger, payload.data, payload.stack);
        })

}

/**
 * Записать сообщение в консоль
 * @param message - текст сообщения
 * @param timestamp - timestamp
 * @param logger - logger
 * @param data - дополнительный контекст, массив с любыми данными
 * @param stack - stack
 */
function log(message: string, timestamp: string, logger?: string, data?: any[], stack?: string[]) {
    const payload: any[] = [message, timestamp, logger ?? "<unknown>"];

    if (data)
        payload.concat([...data]);

    if (stack)
        payload.push(stack);

    console.log(`[gl-bpmn-viewer] DEBUG`, ...payload);
}