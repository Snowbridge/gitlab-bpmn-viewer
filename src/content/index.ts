
import browser from "webextension-polyfill";
import { ForegroundConfig } from "@/lib/configuration";
import { Logger } from "@/lib/logger";
import { ContentScriptInitializer } from "./initializer";

const config = new ForegroundConfig(browser);
const logger = new Logger(config);

const initializer = new ContentScriptInitializer(browser, config, logger);
ContentScriptInitializer.addGlobalSubscription(initializer, browser);
initializer.alertBackgroundOnReady();
