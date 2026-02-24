/**
 * Content script — внедряется в страницы GitLab
 * Выполняется только на сайтах, хост которых присутствует в настройках (требование 3.1)
 */
import { getHostFromUrl, isHostConfigured, loadSettings } from "../lib/settings";

async function init(): Promise<void> {
  const host = getHostFromUrl(window.location.href);
  if (!host) {
    return;
  }

  const settings = await loadSettings();
  if (!isHostConfigured(settings, host)) {
    return;
  }

  // TODO: 3.2, 3.3, 3.4 — контекстное меню, BPMN-превью, diff
  console.log("[GitLab BPMN Viewer] Content active for host:", host);
}

init();
