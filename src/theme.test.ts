import { describe, expect, it } from "vitest";
import { DEFAULT_ACCENT_COLOR, normalizeAccentColor } from "./theme";

describe("accent color", () => {
  it("normalizes a valid color", () => {
    expect(normalizeAccentColor("#7c5ce7")).toBe("#7C5CE7");
  });

  it("falls back to the default purple", () => {
    expect(normalizeAccentColor("purple")).toBe(DEFAULT_ACCENT_COLOR);
  });
});
