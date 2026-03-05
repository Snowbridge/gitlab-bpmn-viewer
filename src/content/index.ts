
import urlMessageResolver from "@/lib/url-message-resolver";
import { CommunicationMessage, MESSAGE_TYPE_BLOB_CONTENT_INIT, MESSAGE_TYPE_CONTENT_SCRIPT_READY, MESSAGE_TYPE_DIFF_CONTENT_INIT } from "@/types/messages";
import browser, { Runtime } from "webextension-polyfill";
import { BlobPageLogic } from "./blob-page";
import { DiffPageLogic } from "./diff-page";
import { ForegroundConfig } from "@/lib/configuration";
import { debug } from "@/lib/logger";

function emptyWatchdogHandler() {/* empty by purpose */ }

const config = new ForegroundConfig();
config.load();

// Singleton is needed only for diff pages to avoid multiplying observers
// and duplicating buttons. For blob pages, on the contrary, the logic
// must be reinitialized on every SPA navigation.
let diffPageLogicInstance: DiffPageLogic | null = null;

async function init() {

  // Initialization on signal from background script (SPA navigation, etc.).
  if (!browser.runtime.onMessage.hasListener(emptyWatchdogHandler)) {
    browser.runtime.onMessage.addListener(emptyWatchdogHandler);
    browser.runtime.onMessage.addListener(onMessageFromBackgroundHandler);
  }

  debug(`Foreground event listeners are set up, notifying background...`);

  try {
    await browser.runtime.sendMessage({
      type: MESSAGE_TYPE_CONTENT_SCRIPT_READY,
      url: window.location.href
    });
  } catch (error: unknown) {
    const msg = (error as Error)?.message ?? String(error);
    if (msg.includes("Could not establish connection. Receiving end does not exist")) {
      debug(
        "Background script is not ready yet while sending CONTENT_SCRIPT_READY",
        window.location.href
      );
    } else {
      debug(
        "Unexpected error while sending CONTENT_SCRIPT_READY",
        window.location.href,
        msg
      );
    }
  }
}

function onMessageFromBackgroundHandler(message: unknown, _sender: Runtime.MessageSender) {
  if (!(message as CommunicationMessage).type)
    return;

  void processMessageFromBackground((message as CommunicationMessage));
}

async function processMessageFromBackground(message: CommunicationMessage) {

  await config.load();

  if (!config.isHostConfigured(message.url))
    return; // it means that we are on a diff/blob page, but on a site whose host is absent in the settings

  const messageType = message.type ?? urlMessageResolver(message.url);

  switch (messageType) {
    case MESSAGE_TYPE_BLOB_CONTENT_INIT:
      // Blob pages: each INIT corresponds to a new blob page (including SPA),
      // so we create a new instance of the logic every time.
      // Protection against duplicates is implemented inside BlobPageLogic itself via WATCHDOG_FLAG.
      new BlobPageLogic();
      break;
    case MESSAGE_TYPE_DIFF_CONTENT_INIT:
      // Diff pages: keep a single instance of the logic for the whole lifecycle
      // of the content script in a tab to avoid multiplying observers
      // and duplicating buttons.
      if (!diffPageLogicInstance) {
        diffPageLogicInstance = new DiffPageLogic();
      } else {
        debug(`DiffPageLogic is already initialized, skipping re-init`);
      }
      break;
    default:
      debug(`This is not a diff/blob page`, message.url);
  }
}

init();