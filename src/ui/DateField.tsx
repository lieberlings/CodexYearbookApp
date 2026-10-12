import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Button } from "./Button";
import {
  WEEKDAY_LABELS,
  buildMonthGrid,
  formatDisplayDate,
  isOutsideRange,
  monthTitle,
  parseIsoDate,
  shiftMonth,
  todayIso
} from "./calendarModel";
import { colors, radii, spacing } from "./theme";

type DateFieldProps = {
  // "YYYY-MM-DD" or "" when unset.
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  // Days outside [min, max] can't be picked (e.g. an end date before the start).
  min?: string;
  max?: string;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

// A tappable date that opens a month calendar. Tap the month title to jump years.
export function DateField({ value, onChange, placeholder, min, max, accessibilityLabel, style }: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState({ year: 0, monthIndex: 0 });
  const [pickingYear, setPickingYear] = useState(false);
  const hasValue = Boolean(parseIsoDate(value));

  const openCalendar = () => {
    const start = parseIsoDate(value) ?? parseIsoDate(min) ?? parseIsoDate(max) ?? parseIsoDate(todayIso())!;
    setView({ year: start.year, monthIndex: start.monthIndex });
    setPickingYear(false);
    setOpen(true);
  };

  const choose = (iso: string) => {
    onChange(iso);
    setOpen(false);
  };

  // Newest first: five years ahead back to 1900, so old trips can be dated too.
  const newestYear = new Date().getFullYear() + 5;
  const years = Array.from({ length: newestYear - 1899 }, (_, index) => newestYear - index);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? placeholder}
        accessibilityValue={{ text: hasValue ? formatDisplayDate(value) : "Not set" }}
        onPress={openCalendar}
        style={[styles.field, style]}
      >
        <Ionicons name="calendar-outline" size={18} color={colors.textMuted} />
        <Text numberOfLines={1} style={[styles.fieldText, !hasValue && styles.placeholder]}>
          {hasValue ? formatDisplayDate(value) : placeholder}
        </Text>
      </Pressable>

      <Modal transparent animationType="fade" visible={open} onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => undefined}>
            <View style={styles.header}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Previous month"
                hitSlop={8}
                disabled={pickingYear}
                onPress={() => setView(shiftMonth(view.year, view.monthIndex, -1))}
                style={[styles.arrow, pickingYear && styles.hidden]}
              >
                <Ionicons name="chevron-back" size={22} color={colors.textBody} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={pickingYear ? "Back to days" : "Choose year"}
                onPress={() => setPickingYear((current) => !current)}
                style={styles.titleButton}
              >
                <Text style={styles.title}>{monthTitle(view.year, view.monthIndex)}</Text>
                <Ionicons name={pickingYear ? "chevron-up" : "chevron-down"} size={16} color={colors.textBody} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Next month"
                hitSlop={8}
                disabled={pickingYear}
                onPress={() => setView(shiftMonth(view.year, view.monthIndex, 1))}
                style={[styles.arrow, pickingYear && styles.hidden]}
              >
                <Ionicons name="chevron-forward" size={22} color={colors.textBody} />
              </Pressable>
            </View>

            {pickingYear ? (
              <ScrollView style={styles.yearScroll} contentContainerStyle={styles.yearGrid}>
                {years.map((year) => {
                  const selected = year === view.year;
                  return (
                    <Pressable
                      key={year}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() => {
                        setView({ year, monthIndex: view.monthIndex });
                        setPickingYear(false);
                      }}
                      style={[styles.yearCell, selected && styles.selectedCell]}
                    >
                      <Text style={[styles.dayText, selected && styles.selectedText]}>{year}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : (
              <View>
                <View style={styles.week}>
                  {WEEKDAY_LABELS.map((label, index) => (
                    <Text key={index} style={styles.weekday}>{label}</Text>
                  ))}
                </View>
                {buildMonthGrid(view.year, view.monthIndex).map((week) => (
                  <View key={week[0].iso} style={styles.week}>
                    {week.map((day) => {
                      const selected = day.iso === value;
                      const disabled = isOutsideRange(day.iso, min, max);
                      return (
                        <Pressable
                          key={day.iso}
                          accessibilityRole="button"
                          accessibilityLabel={formatDisplayDate(day.iso)}
                          accessibilityState={{ selected, disabled }}
                          disabled={disabled}
                          onPress={() => choose(day.iso)}
                          style={[styles.dayCell, selected && styles.selectedCell]}
                        >
                          <Text
                            style={[
                              styles.dayText,
                              !day.inMonth && styles.outsideText,
                              disabled && styles.disabledText,
                              selected && styles.selectedText
                            ]}
                          >
                            {day.day}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ))}
              </View>
            )}

            <View style={styles.actions}>
              <Button label="Clear" variant="link" onPress={() => choose("")} />
              <View style={styles.actionsEnd}>
                <Button
                  label="Today"
                  size="sm"
                  disabled={isOutsideRange(todayIso(), min, max)}
                  onPress={() => choose(todayIso())}
                />
                <Button label="Cancel" size="sm" onPress={() => setOpen(false)} />
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 48,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.md
  },
  fieldText: { flex: 1, color: colors.text, fontSize: 16 },
  placeholder: { color: colors.textMuted },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(36, 31, 27, 0.4)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg
  },
  sheet: {
    width: "100%",
    maxWidth: 380,
    borderRadius: radii.lg + 4,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.md
  },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  arrow: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  hidden: { opacity: 0 },
  titleButton: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingVertical: spacing.xs },
  title: { color: colors.text, fontSize: 17, fontWeight: "700" },
  week: { flexDirection: "row" },
  weekday: { flex: 1, textAlign: "center", color: colors.textMuted, fontSize: 12, fontWeight: "600", paddingVertical: spacing.xs },
  dayCell: { flex: 1, aspectRatio: 1, alignItems: "center", justifyContent: "center", borderRadius: radii.pill },
  selectedCell: { backgroundColor: colors.brand },
  dayText: { color: colors.text, fontSize: 15 },
  outsideText: { color: colors.borderStrong },
  disabledText: { color: colors.border },
  selectedText: { color: colors.onBrand, fontWeight: "700" },
  yearScroll: { maxHeight: 300 },
  yearGrid: { flexDirection: "row", flexWrap: "wrap" },
  yearCell: { width: "25%", paddingVertical: spacing.md, alignItems: "center", borderRadius: radii.pill },
  actions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  actionsEnd: { flexDirection: "row", gap: spacing.sm }
});
