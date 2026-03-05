/**
 * Popup — quick access to settings
 */
import browser from "webextension-polyfill";

document.getElementById("open-options")?.addEventListener("click", (e) => {
  e.preventDefault();
  browser.runtime.openOptionsPage();
});
