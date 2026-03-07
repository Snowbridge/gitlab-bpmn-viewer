import type { BrowserApi } from "@/types/types";
import { BackgroundConfig, BaseConfig } from "./configuration";

let glconfig: BackgroundConfig | null = null;

/**
 * Initializes the logger with the browser API. Must be called from each entry point
 * (background, content script, options page) before using debug().
 */
export function initLogger(browserApi: BrowserApi): void {
    glconfig = new BackgroundConfig(browserApi);
}

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
    if (!glconfig) return;

    const timestamp = (new Date()).toISOString();
    const rawStack = (new Error).stack ?? "<unknown>";

    glconfig.load()
        .then((config) => {
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
    const payload: any[] = [...data ?? []];

    if (stack)
        payload.push(stack);

    console.log(`[gl-bpmn-viewer@${timestamp}] ${message}`, `from[${logger ?? "<unknown>"}]`, ...payload);
}

export class Logger {
    private config: BaseConfig;
    constructor(config: BaseConfig) {
        this.config = config;
    }

    public async debug(message: string, ...data: any[]): Promise<void> {
        const timestamp = (new Date()).toISOString();

        void await this.config.load();
        if (!this.config.isDebugEnabled())
            return;

        const rawStack = (new Error).stack ?? "<unknown>";
        const stack = rawStack.split('\n').slice(2, 5);

        const payload: LogRecord = {
            message: message,
            timestamp: timestamp,
            logger: stack.at(1)?.trim() ?? "<unknown>", // the call site (line) where debug() was invoked
            data: data
        };

        if (this.config.isDebugStackIncluded())
            payload.stack = stack.slice(2, 5) ?? ["<unknown>"];

        this.log(payload.message, payload.timestamp, payload.logger, payload.data, payload.stack);

    }

    private log(message: string, timestamp: string, logger?: string, data?: any[], stack?: string[]): void {
        const payload: any[] = [...data ?? []];

        if (stack)
            payload.push(stack);

        console.log(`[gl-bpmn-viewer@${timestamp}] ${message}`, `[@${logger ?? "<unknown>"}]`, ...payload);
    }
}