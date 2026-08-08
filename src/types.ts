export type LaunchMode = "window" | "tab";

export interface AppSettings {
  accentColor: string;
}

export interface HostMetadata {
  alias: string;
  displayName: string;
  folder: string;
  tags: string[];
  favorite: boolean;
  note: string;
  lastConnectedAt?: number;
  connectionCount: number;
}

export interface SshHost {
  alias: string;
  hostName?: string;
  user?: string;
  port?: number;
  proxyJump?: string;
  identityFile?: string;
  source: string;
  metadata: HostMetadata;
}

export interface Catalog {
  hosts: SshHost[];
  configPath: string;
  warnings: string[];
  settings: AppSettings;
}
