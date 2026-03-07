import {  BaseConfig } from "./configuration";

interface LogRecord {
    message: string;
    timestamp: string;
    data?: any[];
    stack?: string[];
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

        const payload: LogRecord = {
            message: message,
            timestamp: timestamp,
            data: data
        };

        if (this.config.isDebugStackIncluded())
            payload.stack = (new Error).stack?.split('\n');

        this.log(payload.message, payload.timestamp, payload.data, payload.stack);

    }

    private log(message: string, timestamp: string, data?: any[], stack?: string[]): void {
        const payload: any[] = [...data ?? []];

        if (stack){
            const refinedStack = stack.slice(2);
            if(refinedStack.length>0)
                payload.push(refinedStack.join('\n')); // only if stack contains something else except the word Error an the debug function itself
        }

        console.log(`[gl-bpmn-viewer@${timestamp}] ${message}`, ...payload);
    }
}