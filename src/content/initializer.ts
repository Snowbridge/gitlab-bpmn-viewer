import { ForegroundConfig } from "@/lib/configuration";
import { Logger } from "@/lib/logger";
import urlMessageResolver from "@/lib/url-message-resolver";
import { CommunicationMessage, MESSAGE_TYPE_BLOB_CONTENT_INIT, MESSAGE_TYPE_CONTENT_SCRIPT_READY, MESSAGE_TYPE_DIFF_CONTENT_INIT } from "@/types/messages";
import { BrowserApi } from "@/types/types";
import { BlobPageLogic } from "./blob-page";
import { DiffPageLogic } from "./diff-page";
import { Runtime } from "webextension-polyfill";

export class ContentScriptInitializer {
    private config: ForegroundConfig;
    private logger: Logger;
    private browserApi: BrowserApi;
    constructor(browserApi: BrowserApi, config: ForegroundConfig, logger: Logger) {
        this.config = config;
        this.logger = logger;
        this.browserApi = browserApi;
    }

    async alertBackgroundOnReady() {
        try {
            await this.browserApi.runtime.sendMessage({
                type: MESSAGE_TYPE_CONTENT_SCRIPT_READY,
                url: window.location.href
            });
        } catch (error: unknown) {
            const msg = (error as Error)?.message ?? String(error);
            if (msg.includes("Could not establish connection. Receiving end does not exist")) {
                this.logger.debug(
                    "Background script is not ready yet while sending CONTENT_SCRIPT_READY",
                    window.location.href
                );
            } else {
                this.logger.debug(
                    "Unexpected error while sending CONTENT_SCRIPT_READY",
                    window.location.href,
                    msg
                );
            }
        }
    }

    async processMessageFromBackground(message: CommunicationMessage) {

        if (!(message as CommunicationMessage).type)
            return;

        await this.config.load();

        if (!this.config.isHostConfigured(message.url))
            return; // we are on a diff/blob page, but on a site whose host is not present in the settings

        const messageType = message.type ?? urlMessageResolver(message.url);

        switch (messageType) {
            case MESSAGE_TYPE_BLOB_CONTENT_INIT:
                new BlobPageLogic();
                break;
            case MESSAGE_TYPE_DIFF_CONTENT_INIT:
                new DiffPageLogic();
                break;
            default:
                this.logger.debug(`This is not a diff/blob page`, message.url);
        }
    }

    static async addGlobalSubscription(initializer: ContentScriptInitializer, browserApi: BrowserApi){
        browserApi.runtime.onMessage.addListener((message: unknown, _sender: Runtime.MessageSender) => {
            void initializer.processMessageFromBackground((message as CommunicationMessage));
          });        
    }
}
