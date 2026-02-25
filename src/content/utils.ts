/**
 * Общие утилиты для content-скриптов (blob, diff и т.д.)
 */
import browser from "webextension-polyfill";

export function createIconButton(
  iconPath: string,
  title: string
): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "gl-button btn btn-default btn-md";
  btn.title = title;
  const img = document.createElement("img");
  img.src = browser.runtime.getURL(iconPath);
  img.alt = title;
  img.style.cssText = "width:16px;height:16px;display:block;";
  btn.appendChild(img);
  return btn;
}
