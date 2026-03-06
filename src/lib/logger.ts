import { BackgroundConfig } from "./configuration";

const config = new BackgroundConfig();

interface LogRecord {
    message: string;
    timestamp: string;
    logger: string;
    data?: any[];
    stack?: string[];
}

/**
 * Writes logs in a unified format and, depending on
 * debugEnabled and debugStackIncluded settings in local storage.
 * @param message message text
 * @param data array with arbitrary data
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
                logger: stack.at(1)?.trim() ?? "<unknown>", // the call site (line) where debug() was invoked
                data: data
            };

            if (config.isDebugStackIncluded())
                payload.stack = stack.slice(2, 5) ?? ["<unknown>"];

            log(payload.message, payload.timestamp, payload.logger, payload.data, payload.stack);
        })

}

/**
 * Write a message to the console
 * @param message - message text
 * @param timestamp - timestamp
 * @param logger - logger
 * @param data - additional context, array with any data
 * @param stack - stack
 */
function log(message: string, timestamp: string, logger?: string, data?: any[], stack?: string[]) {
    const payload: any[] = [message, timestamp, logger ?? "<unknown>", ...data ?? []];

    if (stack)
        payload.push(stack);

    console.log(`[gl-bpmn-viewer] DEBUG`, ...payload);
}