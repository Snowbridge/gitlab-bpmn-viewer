
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

// Синглтон нужен только для diff-страниц, чтобы не плодить наблюдателей
// и не дублировать кнопки. Для blob-страниц, наоборот, логика должна
// переинициализироваться на каждый SPA-переход.
let diffPageLogicInstance: DiffPageLogic | null = null;

async function init() {

  // Инициализация по сигналу от background-скрипта (SPA-навигация и т.п.).
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
    return; // это значит, что мы находимся на diff/blob-странице, но на сайте, хост которого отсутствует в настройках

  const messageType = message.type ?? urlMessageResolver(message.url);

  switch (messageType) {
    case MESSAGE_TYPE_BLOB_CONTENT_INIT:
      // Blob-страницы: каждый INIT соответствует новой blob-странице (в т.ч. при SPA),
      // поэтому создаём новый экземпляр логики каждый раз.
      // Защита от дубликатов реализована внутри самой BlobPageLogic через WATCHDOG_FLAG.
      new BlobPageLogic();
      break;
    case MESSAGE_TYPE_DIFF_CONTENT_INIT:
      // Diff-страницы: держим один экземпляр логики на весь жизненный цикл контент-скрипта
      // в табе, чтобы не плодить наблюдателей и не дублировать кнопки.
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