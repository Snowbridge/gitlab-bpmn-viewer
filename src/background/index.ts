/**
 * Background script (Service Worker) — точка входа для MV3
 */
import { Configuration } from "../lib/configuration";
import { ContextualIconUpdater } from "./contextual-icon-updater";
import { Logger } from "./logger";
import { ContentScriptBootstraper } from "./content-script-bootstraper";

(new Configuration(new Logger(false, false)))
  .init()
  // здесь происходит запуск и настройка зависимостей приложения
  .then(async (config: Configuration) => {

    // изменение иконки расширения в зависимости от настройки hosts и url текущей вкладки
    await (new ContextualIconUpdater(config))
      .init();

    // запуск контент-скриптов
    (new ContentScriptBootstraper(config))
      .init();
  })
