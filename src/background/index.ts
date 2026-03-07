import { BackgroundConfig } from "@/lib/configuration";
import { Logger } from "@/lib/logger";
import browser from "webextension-polyfill";
import { ContextualIconUpdater } from "./contextual-icon-updater";
import { BackgroundContentScriptsBootstraper } from "./content-script-bootstraper";

const config = new BackgroundConfig(browser);
const logger = new Logger(config);
const iconUpdater = new ContextualIconUpdater(browser, config, logger);
ContextualIconUpdater.addGlobalSubscriptions(iconUpdater, browser);

const contentScriptBootstraper = new BackgroundContentScriptsBootstraper(browser, config, logger);
BackgroundContentScriptsBootstraper.addGlobalSubscriptions(contentScriptBootstraper, browser);
