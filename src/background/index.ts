/**
 * Background script (Service Worker) — точка входа для MV3
 */
import browser from "webextension-polyfill";

browser.runtime.onInstalled.addListener(() => {
  console.log("[GitLab BPMN Viewer] Extension installed");
});
