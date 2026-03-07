/**
 * Extension settings page
 */
import { BackgroundConfig } from "@/lib/configuration";
import { HostConfig } from "@/types/settings";
import browser from "webextension-polyfill";

const HOSTS_LIST_ID = "hosts-list";
const ADD_HOST_ID = "add-host";
const FORM_ID = "settings-form";
const STATUS_ID = "status";
const DEBUG_ENABLED_ID = "debug-enabled";
const DEBUG_PRINT_STACK_ID = "debug-print-stack";

function getEl<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Element #${id} not found`);
  return el as T;
}

function createRow(config: HostConfig, index: number): HTMLElement {
  const row = document.createElement("div");
  row.className = "row";
  row.dataset.index = String(index);

  const hostInput = document.createElement("input");
  hostInput.type = "text";
  hostInput.className = "host-input";
  hostInput.placeholder = "git.example.com";
  hostInput.value = config.host;
  hostInput.name = `host-${index}`;

  const tokenInput = document.createElement("input");
  tokenInput.type = "password";
  tokenInput.className = "token-input";
  tokenInput.placeholder = "Personal Access Token";
  tokenInput.value = config.token;
  tokenInput.name = `token-${index}`;

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "danger";
  removeBtn.textContent = "Удалить";
  removeBtn.addEventListener("click", () => {
    row.remove();
  });

  row.appendChild(hostInput);
  row.appendChild(tokenInput);
  row.appendChild(removeBtn);

  return row;
}

function collectFromForm(hostsList: HTMLElement): HostConfig[] {
  const rows = hostsList.querySelectorAll(".row");
  const result: HostConfig[] = [];

  rows.forEach((row) => {
    const inputs = row.querySelectorAll("input");
    const host = (inputs[0]?.value ?? "").trim();
    const token = (inputs[1]?.value ?? "").trim();
    if (host) {
      result.push({ host, token });
    }
  });

  return result;
}

function renderHosts(hostsList: HTMLElement, hosts: HostConfig[]): void {
  hostsList.innerHTML = "";
  if (hosts.length === 0) {
    hosts.push({ host: "", token: "" });
  }
  hosts.forEach((h, i) => {
    hostsList.appendChild(createRow(h, i));
  });
}

function showStatus(message: string, isError = false): void {
  const status = getEl<HTMLDivElement>(STATUS_ID);
  status.textContent = message;
  status.className = "status" + (isError ? " error" : "");
  if (message) {
    window.setTimeout(() => {
      status.textContent = "";
    }, 3000);
  }
}

async function init() {
  const config = new BackgroundConfig(browser);
  await config.load();

  const hostsList = getEl<HTMLDivElement>(HOSTS_LIST_ID);
  const addBtn = getEl<HTMLButtonElement>(ADD_HOST_ID);
  const form = getEl<HTMLFormElement>(FORM_ID);
  const debugEnabledCheckbox = getEl<HTMLInputElement>(DEBUG_ENABLED_ID);
  const debugPrintStackCheckbox =
    getEl<HTMLInputElement>(DEBUG_PRINT_STACK_ID);

  const configuredHosts = config.getHosts();
  renderHosts(hostsList, configuredHosts);

  debugEnabledCheckbox.checked = config.isDebugEnabled();
  debugPrintStackCheckbox.checked = config.isDebugStackIncluded();

  addBtn.addEventListener("click", () => {
    const newRow = createRow({ host: "", token: "" }, configuredHosts.length);
    hostsList.appendChild(newRow);
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const hosts = collectFromForm(hostsList);
    const valid = hosts.every((h) => h.host.length > 0);
    if (!valid) {
      showStatus("Укажите хост для всех записей.", true);
      return;
    }

    try {
      config.update(hosts, debugEnabledCheckbox.checked, debugPrintStackCheckbox.checked)
      await config.save();
      showStatus("Настройки сохранены.");
    } catch (err) {
      showStatus("Ошибка сохранения: " + String(err), true);
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    void init();
  });
} else {
  void init();
}
