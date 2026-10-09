// Pure helpers behind ColorPicker, kept free of React Native so they can be unit tested.

// One palette for every color choice in the app (page, text, borders, fills, cover).
export const STANDARD_COLORS: readonly string[] = [
  "#FFFFFF", "#F8FAFC", "#E2E8F0", "#94A3B8", "#64748B", "#334155", "#0F172A", "#000000",
  "#FBF6EE", "#241F1B", "#991B1B", "#DC2626", "#EA580C", "#D97706", "#EAB308", "#16A34A",
  "#0D9488", "#0284C7", "#2563EB", "#6B5BD2", "#7C3AED", "#DB2777", "#FECDD3", "#FED7AA",
  "#FDE68A", "#BBF7D0", "#BAE6FD", "#DDD6FE", "#E0E7FF", "#FCE7F3"
];

export const QUICK_COLOR_COUNT = 6;
export const MAX_RECENT_COLORS = 8;

export function normalizeColor(color: string | undefined): string | undefined {
  if (!color) return undefined;
  const value = color.trim().toUpperCase();
  const short = /^#([0-9A-F])([0-9A-F])([0-9A-F])$/.exec(value);
  return short ? `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}` : value;
}

export function sameColor(a: string | undefined, b: string | undefined): boolean {
  const left = normalizeColor(a);
  return left !== undefined && left === normalizeColor(b);
}

function unique(colors: readonly (string | undefined)[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const color of colors) {
    const normalized = normalizeColor(color);
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      result.push(normalized);
    }
  }
  return result;
}

export type ColorSection = { id: "theme" | "recent" | "standard"; label: string; colors: string[] };

// Sections of the expanded picker. Empty sections are left out.
export function buildColorSections(
  themeColors: readonly string[] = [],
  recentColors: readonly string[] = [],
  themeLabel = "Page theme"
): ColorSection[] {
  const sections: ColorSection[] = [
    { id: "theme", label: themeLabel, colors: unique(themeColors) },
    { id: "recent", label: "Recent", colors: unique(recentColors) },
    { id: "standard", label: "Standard", colors: unique(STANDARD_COLORS) }
  ];
  return sections.filter((section) => section.colors.length > 0);
}

// The compact row: theme colors first, then recent ones, then standard, without
// repeating the current value (it is shown separately).
export function quickColors(value: string | undefined, themeColors: readonly string[] = [], recentColors: readonly string[] = []): string[] {
  return unique([...themeColors, ...recentColors, ...STANDARD_COLORS])
    .filter((color) => !sameColor(color, value))
    .slice(0, QUICK_COLOR_COUNT);
}

export function pushRecentColor(recent: readonly string[], color: string): string[] {
  return unique([color, ...recent]).slice(0, MAX_RECENT_COLORS);
}
