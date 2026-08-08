export const DEFAULT_ACCENT_COLOR = "#7C5CE7";

function rgb(hex: string): [number, number, number] {
  const value = hex.slice(1);
  return [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16)) as [number, number, number];
}

function hex([red, green, blue]: [number, number, number]): string {
  return `#${[red, green, blue].map((value) => Math.round(value).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

function mix(color: string, target: [number, number, number], amount: number): string {
  return hex(rgb(color).map((value, index) => value + (target[index] - value) * amount) as [number, number, number]);
}

function rgba(color: string, alpha: number): string {
  return `rgba(${rgb(color).join(", ")}, ${alpha})`;
}

function luminance(color: string): number {
  const channels = rgb(color).map((value) => {
    const normalized = value / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

export function normalizeAccentColor(color: string): string {
  return /^#[0-9a-f]{6}$/i.test(color) ? color.toUpperCase() : DEFAULT_ACCENT_COLOR;
}

export function applyAccentColor(color: string): string {
  const accent = normalizeAccentColor(color);
  const style = document.documentElement.style;
  style.setProperty("--accent", accent);
  style.setProperty("--accent-hover", mix(accent, [255, 255, 255], 0.1));
  style.setProperty("--accent-soft", rgba(accent, 0.16));
  style.setProperty("--accent-border", rgba(accent, 0.55));
  style.setProperty("--accent-glow", rgba(accent, 0.42));
  style.setProperty("--accent-on-soft", mix(accent, [255, 255, 255], 0.38));
  style.setProperty("--accent-contrast", luminance(accent) > 0.179 ? "#0B0F18" : "#FFFFFF");
  return accent;
}
