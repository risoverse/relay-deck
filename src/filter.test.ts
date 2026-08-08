import { describe, expect, it } from "vitest";
import { filterHosts, searchableText } from "./filter";
import type { SshHost } from "./types";

const host = (alias: string, overrides: Partial<SshHost> = {}): SshHost => ({
  alias,
  hostName: `${alias}.example.com`,
  source: "~/.ssh/config",
  metadata: {
    alias,
    displayName: "",
    folder: "",
    tags: [],
    favorite: false,
    note: "",
    connectionCount: 0
  },
  ...overrides
});

describe("host filtering", () => {
  it("searches aliases and metadata", () => {
    const item = host("web-01", {
      metadata: { ...host("x").metadata, alias: "web-01", folder: "Production", tags: ["aws"] }
    });
    expect(searchableText(item)).toContain("production");
    expect(filterHosts([item], "AWS", "all")).toHaveLength(1);
  });

  it("filters favorites and sorts them first", () => {
    const a = host("alpha");
    const b = host("beta", { metadata: { ...host("x").metadata, alias: "beta", favorite: true } });
    expect(filterHosts([a, b], "", "favorites").map((item) => item.alias)).toEqual(["beta"]);
    expect(filterHosts([a, b], "", "all")[0].alias).toBe("beta");
  });

  it("sorts recent hosts by timestamp", () => {
    const old = host("old", { metadata: { ...host("x").metadata, alias: "old", lastConnectedAt: 10 } });
    const fresh = host("fresh", { metadata: { ...host("x").metadata, alias: "fresh", lastConnectedAt: 20 } });
    expect(filterHosts([old, fresh], "", "recent").map((item) => item.alias)).toEqual(["fresh", "old"]);
  });
});
