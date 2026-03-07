import type browser from "webextension-polyfill";

/**
 * Type for the browser extension API. Injected in background scripts for testability.
 */
export type BrowserApi = typeof browser;

/**
 * Type for storage.onChanged listener callback (changes argument).
 * Re-exported so background scripts need not import webextension-polyfill for typing.
 */
export type StorageChangeRecord = Record<string, browser.Storage.StorageChange>;

/** Re-exported for background scripts (e.g. ContextualIconUpdater) without webextension-polyfill import. */
export type TabsTab = browser.Tabs.Tab;
/** Re-exported for background scripts (e.g. ContextualIconUpdater) without webextension-polyfill import. */
export type TabsOnUpdatedChangeInfoType = browser.Tabs.OnUpdatedChangeInfoType;
/** Re-exported for background scripts (e.g. ContextualIconUpdater) without webextension-polyfill import. */
export type TabsOnActivatedActiveInfoType = browser.Tabs.OnActivatedActiveInfoType;
/** Re-exported for background scripts (e.g. ContextualIconUpdater) without webextension-polyfill import. */
export type RuntimeOnInstalledDetailsType = browser.Runtime.OnInstalledDetailsType;