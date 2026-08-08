import "./styles.css";
import { getCatalog, launchConnection, saveMetadata, saveSettings } from "./api";
import { displayName, filterHosts, type Scope } from "./filter";
import { applyAccentColor, DEFAULT_ACCENT_COLOR } from "./theme";
import type { Catalog, HostMetadata, LaunchMode, SshHost } from "./types";

const root = document.querySelector<HTMLDivElement>("#app")!;
let catalog: Catalog = { hosts: [], configPath: "", warnings: [], settings: { accentColor: DEFAULT_ACCENT_COLOR } };
let selectedAlias = "";
let query = "";
let scope: Scope = "all";
let launchMode: LaunchMode = "window";
let busy = false;
let toastTimer = 0;

root.innerHTML = `
  <div class="titlebar" data-tauri-drag-region="deep">
    <div class="brand" data-tauri-drag-region><span class="brand-mark" data-tauri-drag-region>R</span><span data-tauri-drag-region>RelayDeck</span></div>
    <div class="search-wrap" data-tauri-drag-region="false"><span>⌕</span><input id="search" type="search" placeholder="接続先を検索" autocomplete="off"><kbd>⌘ K</kbd></div>
    <div class="title-actions" data-tauri-drag-region="false">
      <button class="icon-button" id="settings" title="設定" aria-label="設定" data-tauri-drag-region="false">⚙</button>
      <button class="icon-button" id="reload" title="SSH configを再読込" aria-label="再読込" data-tauri-drag-region="false">↻</button>
    </div>
  </div>
  <main class="workspace">
    <aside class="sidebar" id="sidebar"></aside>
    <section class="list-panel">
      <header class="panel-header"><div><h1 id="list-title">すべての接続</h1><p id="count"></p></div></header>
      <div class="host-list" id="host-list"></div>
    </section>
    <aside class="detail-panel" id="detail"></aside>
  </main>
  <div class="settings-overlay" id="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title" hidden>
    <section class="settings-dialog">
      <div class="settings-head"><div><span>環境設定</span><h2 id="settings-title">外観</h2></div><button class="dialog-close" id="settings-close" type="button" aria-label="閉じる">×</button></div>
      <div class="accent-setting">
        <label for="accent-color">アクセントカラー</label>
        <p>アイコン、接続ボタン、選択状態に共通で使用します。</p>
        <div class="color-row"><input id="accent-color" type="color" value="${DEFAULT_ACCENT_COLOR}"><output id="accent-value">${DEFAULT_ACCENT_COLOR}</output><button class="reset-color" id="reset-color" type="button">デフォルト</button></div>
      </div>
      <div class="settings-actions"><button class="secondary-button" id="settings-cancel" type="button">キャンセル</button><button class="primary-button" id="settings-save" type="button">保存</button></div>
    </section>
  </div>
  <div class="toast" id="toast" role="status"></div>
`;

const search = document.querySelector<HTMLInputElement>("#search")!;
search.addEventListener("input", () => { query = search.value; renderList(); });
document.addEventListener("keydown", (event) => {
  if (event.metaKey && event.key.toLowerCase() === "k") {
    event.preventDefault(); search.focus();
  }
  if (event.metaKey && event.key === "Enter" && selectedAlias) void connectSelected();
});
document.querySelector("#reload")!.addEventListener("click", () => void load());

const settingsDialog = document.querySelector<HTMLDivElement>("#settings-dialog")!;
const accentInput = document.querySelector<HTMLInputElement>("#accent-color")!;
const accentValue = document.querySelector<HTMLOutputElement>("#accent-value")!;
let savedAccentColor = DEFAULT_ACCENT_COLOR;

function previewAccent(color: string): void {
  const normalized = applyAccentColor(color);
  accentInput.value = normalized;
  accentValue.value = normalized;
}

function openSettings(): void {
  savedAccentColor = catalog.settings.accentColor;
  previewAccent(savedAccentColor);
  settingsDialog.hidden = false;
  document.querySelector<HTMLButtonElement>("#settings-close")!.focus();
}

function cancelSettings(): void {
  previewAccent(savedAccentColor);
  settingsDialog.hidden = true;
}

document.querySelector("#settings")!.addEventListener("click", openSettings);
document.querySelector("#settings-close")!.addEventListener("click", cancelSettings);
document.querySelector("#settings-cancel")!.addEventListener("click", cancelSettings);
document.querySelector("#reset-color")!.addEventListener("click", () => previewAccent(DEFAULT_ACCENT_COLOR));
accentInput.addEventListener("input", () => previewAccent(accentInput.value));
settingsDialog.addEventListener("click", (event) => { if (event.target === settingsDialog) cancelSettings(); });
document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !settingsDialog.hidden) cancelSettings(); });
document.querySelector("#settings-save")!.addEventListener("click", async () => {
  const accentColor = applyAccentColor(accentInput.value);
  try {
    await saveSettings({ accentColor });
    catalog.settings.accentColor = accentColor;
    savedAccentColor = accentColor;
    settingsDialog.hidden = true;
    showToast("外観設定を保存しました");
  } catch (error) { showToast(String(error), true); }
});

function escapeHtml(value: string | number | undefined): string {
  return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]!);
}

function formatRelative(timestamp?: number): string {
  if (!timestamp) return "未接続";
  const minutes = Math.floor((Date.now() - timestamp) / 60000);
  if (minutes < 1) return "たった今";
  if (minutes < 60) return `${minutes}分前`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}時間前`;
  return `${Math.floor(minutes / 1440)}日前`;
}

function showToast(message: string, isError = false): void {
  const toast = document.querySelector<HTMLDivElement>("#toast")!;
  toast.textContent = message;
  toast.className = `toast show${isError ? " error" : ""}`;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { toast.className = "toast"; }, 3200);
}

function setScope(next: Scope): void {
  scope = next;
  renderSidebar(); renderList();
}

function renderSidebar(): void {
  const folders = [...new Set(catalog.hosts.map((host) => host.metadata.folder).filter(Boolean))].sort();
  const tags = [...new Set(catalog.hosts.flatMap((host) => host.metadata.tags))].sort();
  const nav = (id: Scope, icon: string, label: string, count?: number) => `
    <button class="nav-item ${scope === id ? "active" : ""}" data-scope="${escapeHtml(id)}"><span>${icon}</span><span>${escapeHtml(label)}</span>${count === undefined ? "" : `<b>${count}</b>`}</button>`;
  document.querySelector<HTMLDivElement>("#sidebar")!.innerHTML = `
    <div class="nav-section">${nav("all", "▦", "すべて", catalog.hosts.length)}${nav("favorites", "★", "お気に入り", catalog.hosts.filter((h) => h.metadata.favorite).length)}${nav("recent", "◷", "最近の接続")}</div>
    <div class="nav-heading"><span>フォルダ</span></div>
    <div class="nav-section">${folders.length ? folders.map((folder) => nav(`folder:${folder}`, "▸", folder, catalog.hosts.filter((h) => h.metadata.folder === folder).length)).join("") : '<p class="nav-empty">まだありません</p>'}</div>
    <div class="nav-heading"><span>タグ</span></div>
    <div class="tag-cloud">${tags.map((tag) => `<button class="${scope === `tag:${tag}` ? "active" : ""}" data-scope="tag:${escapeHtml(tag)}">#${escapeHtml(tag)}</button>`).join("")}</div>
    <div class="config-path"><span>読込元</span><code>${escapeHtml(catalog.configPath)}</code></div>`;
  document.querySelectorAll<HTMLElement>("[data-scope]").forEach((item) => item.addEventListener("click", () => setScope(item.dataset.scope as Scope)));
}

function scopeTitle(): string {
  if (scope === "all") return "すべての接続";
  if (scope === "favorites") return "お気に入り";
  if (scope === "recent") return "最近の接続";
  if (scope.startsWith("folder:")) return scope.slice(7);
  return `#${scope.slice(4)}`;
}

function renderList(): void {
  const hosts = filterHosts(catalog.hosts, query, scope);
  if (!hosts.some((host) => host.alias === selectedAlias)) selectedAlias = hosts[0]?.alias ?? "";
  document.querySelector("#list-title")!.textContent = scopeTitle();
  document.querySelector("#count")!.textContent = `${hosts.length}件`;
  const list = document.querySelector<HTMLDivElement>("#host-list")!;
  list.innerHTML = hosts.length ? hosts.map((host) => `
    <button class="host-row ${selectedAlias === host.alias ? "selected" : ""}" data-alias="${escapeHtml(host.alias)}">
      <span class="status-dot"></span>
      <span class="host-main"><strong>${escapeHtml(displayName(host))}</strong><small>${escapeHtml(host.user ? `${host.user}@${host.hostName || host.alias}` : host.hostName || host.alias)}</small></span>
      <span class="host-folder">${escapeHtml(host.metadata.folder)}</span>
      <span class="last-used">${formatRelative(host.metadata.lastConnectedAt)}</span>
      <span class="favorite">${host.metadata.favorite ? "★" : ""}</span>
    </button>`).join("") : `<div class="empty"><span>⌕</span><h2>接続先がありません</h2><p>検索条件を変えるか、SSH configを確認してください。</p></div>`;
  list.querySelectorAll<HTMLButtonElement>("[data-alias]").forEach((row) => {
    row.addEventListener("click", () => { selectedAlias = row.dataset.alias!; renderList(); renderDetail(); });
    row.addEventListener("dblclick", () => void connectSelected());
  });
  renderDetail();
}

function selectedHost(): SshHost | undefined {
  return catalog.hosts.find((host) => host.alias === selectedAlias);
}

function renderDetail(): void {
  const panel = document.querySelector<HTMLDivElement>("#detail")!;
  const host = selectedHost();
  if (!host) { panel.innerHTML = '<div class="detail-empty">接続先を選択してください</div>'; return; }
  const m = host.metadata;
  panel.innerHTML = `
    <div class="detail-head"><button class="star-button ${m.favorite ? "on" : ""}" id="favorite" aria-label="お気に入り">★</button><div class="device-icon">›_</div><h2>${escapeHtml(displayName(host))}</h2><code>${escapeHtml(host.alias)}</code></div>
    <div class="connect-row"><button class="connect-button" id="connect" ${busy ? "disabled" : ""}>iTerm2で接続 <kbd>⌘↵</kbd></button><select id="launch-mode"><option value="window" ${launchMode === "window" ? "selected" : ""}>新規ウィンドウ</option><option value="tab" ${launchMode === "tab" ? "selected" : ""}>新規タブ</option></select></div>
    <section class="info-grid"><h3>SSH設定</h3>${info("ホスト", host.hostName || host.alias)}${info("ユーザー", host.user || "既定値")}${info("ポート", host.port || 22)}${info("踏み台", host.proxyJump || "なし")}${info("秘密鍵", host.identityFile || "SSH既定値")}</section>
    <form id="metadata-form">
      <h3>整理</h3>
      <label>表示名<input name="displayName" value="${escapeHtml(m.displayName)}" placeholder="任意の表示名"></label>
      <label>フォルダ<input name="folder" value="${escapeHtml(m.folder)}" placeholder="例: Production"></label>
      <label>タグ<input name="tags" value="${escapeHtml(m.tags.join(", "))}" placeholder="aws, web"></label>
      <label>メモ<textarea name="note" rows="3" placeholder="この接続先についてのメモ">${escapeHtml(m.note)}</textarea></label>
      <button class="save-button" type="submit">変更を保存</button>
    </form>
    <footer class="detail-foot"><span>${m.connectionCount}回接続</span><span>${escapeHtml(host.source)}</span></footer>`;
  panel.querySelector("#connect")!.addEventListener("click", () => void connectSelected());
  panel.querySelector<HTMLSelectElement>("#launch-mode")!.addEventListener("change", (event) => { launchMode = (event.target as HTMLSelectElement).value as LaunchMode; });
  panel.querySelector("#favorite")!.addEventListener("click", async () => { m.favorite = !m.favorite; await persist(m); });
  panel.querySelector<HTMLFormElement>("#metadata-form")!.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget as HTMLFormElement);
    m.displayName = String(data.get("displayName") || "").trim();
    m.folder = String(data.get("folder") || "").trim();
    m.tags = [...new Set(String(data.get("tags") || "").split(",").map((tag) => tag.trim()).filter(Boolean))];
    m.note = String(data.get("note") || "").trim();
    await persist(m);
  });
}

function info(label: string, value: string | number): string {
  return `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`;
}

async function persist(metadata: HostMetadata): Promise<void> {
  try { await saveMetadata(metadata); renderSidebar(); renderList(); showToast("保存しました"); }
  catch (error) { showToast(String(error), true); }
}

async function connectSelected(): Promise<void> {
  if (!selectedAlias || busy) return;
  busy = true; renderDetail();
  try {
    const updated = await launchConnection(selectedAlias, launchMode);
    const host = selectedHost(); if (host) host.metadata = updated;
    renderSidebar(); renderList(); showToast(`${selectedAlias} をiTerm2で開きました`);
  } catch (error) { showToast(String(error), true); }
  finally { busy = false; renderDetail(); }
}

async function load(): Promise<void> {
  try {
    catalog = await getCatalog();
    catalog.settings.accentColor = applyAccentColor(catalog.settings.accentColor);
    selectedAlias = catalog.hosts[0]?.alias ?? "";
    renderSidebar(); renderList();
    if (catalog.warnings.length) showToast(catalog.warnings[0], true);
  } catch (error) { showToast(`読込に失敗しました: ${String(error)}`, true); }
}

void load();
