// Shared design tokens. New and refactored UI should read colors, spacing and
// radii from here instead of hard-coding hex values.
export const colors = {
  brand: "#6B5BD2",
  brandSoft: "#EDE8FA",
  brandText: "#4E3FBC",
  canvas: "#FBF6EE",
  surface: "#FFFFFF",
  surfaceMuted: "#F3EBDE",
  border: "#E8DFD2",
  borderStrong: "#D8CFC2",
  text: "#241F1B",
  textBody: "#4A4239",
  textMuted: "#6B6156"
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;

export const radii = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

export const type = {
  label: { fontSize: 13, fontWeight: "600" as const, color: colors.textBody },
  caption: { fontSize: 12, color: colors.textMuted }
} as const;
