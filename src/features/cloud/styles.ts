import { StyleSheet } from "react-native";
import { colors, radii, spacing } from "../../ui/theme";

// Shared look for the account, join and sharing screens.
export const cloudStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: 48 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md
  },
  heading: { fontSize: 18, fontWeight: "700", color: colors.text },
  body: { fontSize: 14, lineHeight: 20, color: colors.textBody },
  muted: { fontSize: 13, lineHeight: 18, color: colors.textMuted },
  error: { fontSize: 13, lineHeight: 18, color: colors.danger },
  label: { fontSize: 13, fontWeight: "600", color: colors.textBody },
  input: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surface
  },
  codeInput: { fontSize: 22, letterSpacing: 4, textAlign: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  divider: { height: 1, backgroundColor: colors.border },
  pill: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radii.pill,
    backgroundColor: colors.brandSoft
  },
  pillText: { fontSize: 12, fontWeight: "600", color: colors.brandText }
});

export function errorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error && typeof (error as { message: unknown }).message === "string") {
    return (error as { message: string }).message;
  }
  return "Something went wrong. Check your connection and try again.";
}

export const ROLE_LABELS = { owner: "Owner", contributor: "Can add photos", viewer: "Can view" } as const;
