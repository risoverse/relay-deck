import { invoke } from "@tauri-apps/api/core";
import { DEFAULT_ACCENT_COLOR } from "./theme";
import type { AppSettings, Catalog, HostMetadata, LaunchMode } from "./types";

const isTauri = "__TAURI_INTERNALS__" in window;
const demoKey = "relaydeck-demo-state";
const demoSettingsKey = "relaydeck-demo-settings";

const demoCatalog: Catalog = {
  configPath: "~/.ssh/config",
  warnings: ["ブラウザプレビューです。Tauri版では実際のSSH configを読み込みます。"],
  settings: { accentColor: DEFAULT_ACCENT_COLOR },
  hosts: [
    {
      alias: "example-web-01",
      hostName: "192.0.2.10",
      user: "demo",
      port: 22,
      proxyJump: "example-bastion",
      source: "~/.ssh/config",
      metadata: { alias: "example-web-01", displayName: "Example Web 01", folder: "Examples", tags: ["demo", "web"], favorite: true, note: "Documentation-only sample host", connectionCount: 12, lastConnectedAt: Date.now() - 7200000 }
    },
    {
      alias: "example-router",
      hostName: "198.51.100.1",
      user: "demo",
      source: "~/.ssh/config",
      metadata: { alias: "example-router", displayName: "Example Router", folder: "Examples", tags: ["demo", "router"], favorite: true, note: "Documentation-only sample gateway", connectionCount: 4 }
    },
    {
      alias: "example-linux",
      hostName: "203.0.113.40",
      user: "demo",
      source: "~/.ssh/examples.conf",
      metadata: { alias: "example-linux", displayName: "", folder: "Examples", tags: ["demo", "linux"], favorite: false, note: "", connectionCount: 1 }
    }
  ]
};

function loadDemo(): Catalog {
  const saved = localStorage.getItem(demoKey);
  const savedSettings = localStorage.getItem(demoSettingsKey);
  return {
    ...structuredClone(demoCatalog),
    hosts: saved ? JSON.parse(saved) : structuredClone(demoCatalog.hosts),
    settings: savedSettings ? JSON.parse(savedSettings) : structuredClone(demoCatalog.settings)
  };
}

export async function getCatalog(): Promise<Catalog> {
  return isTauri ? invoke<Catalog>("get_catalog") : loadDemo();
}

export async function saveMetadata(metadata: HostMetadata): Promise<void> {
  if (isTauri) return invoke("save_metadata", { metadata });
  const catalog = loadDemo();
  catalog.hosts = catalog.hosts.map((host) => host.alias === metadata.alias ? { ...host, metadata } : host);
  localStorage.setItem(demoKey, JSON.stringify(catalog.hosts));
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  if (isTauri) return invoke("save_settings", { settings });
  localStorage.setItem(demoSettingsKey, JSON.stringify(settings));
}

export async function launchConnection(alias: string, mode: LaunchMode): Promise<HostMetadata> {
  if (isTauri) return invoke<HostMetadata>("launch_connection", { alias, mode });
  const catalog = loadDemo();
  const target = catalog.hosts.find((host) => host.alias === alias);
  if (!target) throw new Error("接続先が見つかりません");
  target.metadata.connectionCount += 1;
  target.metadata.lastConnectedAt = Date.now();
  localStorage.setItem(demoKey, JSON.stringify(catalog.hosts));
  return target.metadata;
}
