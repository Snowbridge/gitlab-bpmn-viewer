/**
 * Модуль работы с настройками расширения
 */
import browser from "webextension-polyfill";

import type { HostConfig, Settings } from "../types";

const STORAGE_KEY = "settings";

const DEFAULT_SETTINGS: Settings = {
  hosts: [],
};

/**
 * Извлекает хост из URL (без протокола, с портом если нестандартный)
 */
export function getHostFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const port = u.port && u.port !== "80" && u.port !== "443" ? `:${u.port}` : "";
    return `${u.hostname}${port}`;
  } catch {
    return null;
  }
}

/**
 * Загружает настройки из storage
 */
export async function loadSettings(): Promise<Settings> {
  const result = await browser.storage.local.get(STORAGE_KEY);
  const raw = result[STORAGE_KEY];
  if (!raw || !Array.isArray((raw as Settings).hosts)) {
    return { ...DEFAULT_SETTINGS };
  }
  const hosts = ((raw as Settings).hosts as HostConfig[]).filter(
    (h): h is HostConfig =>
      typeof h?.host === "string" &&
      h.host.length > 0 &&
      typeof h?.token === "string"
  );
  return { hosts };
}

/**
 * Сохраняет настройки в storage
 */
export async function saveSettings(settings: Settings): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEY]: settings });
}

/**
 * Проверяет, настроен ли хост для расширения
 */
export function isHostConfigured(settings: Settings, host: string): boolean {
  const normalized = host.toLowerCase().trim();
  return settings.hosts.some(
    (h) => h.host.toLowerCase().trim() === normalized
  );
}

/**
 * Получает токен для хоста (если настроен)
 */
export function getTokenForHost(
  settings: Settings,
  host: string
): string | undefined {
  const normalized = host.toLowerCase().trim();
  const entry = settings.hosts.find(
    (h) => h.host.toLowerCase().trim() === normalized
  );
  return entry?.token;
}
