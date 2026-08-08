import type { SshHost } from "./types";

export type Scope = "all" | "favorites" | "recent" | `folder:${string}` | `tag:${string}`;

export function searchableText(host: SshHost): string {
  const fields = [
    host.alias,
    host.hostName,
    host.user,
    host.proxyJump,
    host.metadata.displayName,
    host.metadata.folder,
    host.metadata.note,
    ...host.metadata.tags
  ];
  return fields.filter(Boolean).join(" ").toLocaleLowerCase();
}

export function filterHosts(hosts: SshHost[], query: string, scope: Scope): SshHost[] {
  const needle = query.trim().toLocaleLowerCase();
  return hosts
    .filter((host) => {
      if (scope === "favorites" && !host.metadata.favorite) return false;
      if (scope === "recent" && !host.metadata.lastConnectedAt) return false;
      if (scope.startsWith("folder:") && host.metadata.folder !== scope.slice(7)) return false;
      if (scope.startsWith("tag:") && !host.metadata.tags.includes(scope.slice(4))) return false;
      return !needle || searchableText(host).includes(needle);
    })
    .sort((a, b) => {
      if (scope === "recent") {
        return (b.metadata.lastConnectedAt ?? 0) - (a.metadata.lastConnectedAt ?? 0);
      }
      if (a.metadata.favorite !== b.metadata.favorite) return a.metadata.favorite ? -1 : 1;
      return displayName(a).localeCompare(displayName(b), "ja");
    });
}

export function displayName(host: SshHost): string {
  return host.metadata.displayName.trim() || host.alias;
}
