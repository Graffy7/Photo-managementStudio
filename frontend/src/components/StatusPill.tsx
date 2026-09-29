import { View, Text, StyleSheet } from "react-native";
import { colors, radius } from "../ui/theme";

export type Tone = "good" | "bad" | "warn" | "info" | "neutral";

const TONE_COLORS: Record<Tone, { bg: string; fg: string }> = {
  good: { bg: colors.successSoft, fg: colors.success },
  bad: { bg: colors.dangerSoft, fg: colors.danger },
  warn: { bg: colors.warningSoft, fg: colors.warning },
  info: { bg: colors.infoSoft, fg: colors.info },
  neutral: { bg: "rgba(159,176,197,0.14)", fg: colors.textMuted },
};

// Colour carries meaning only: green done/paid, amber waiting, red cancelled/overdue, blue upcoming.
export function StatusPill({ label, tone }: { label: string; tone: Tone }) {
  const c = TONE_COLORS[tone];
  return (
    <View style={[styles.pill, { backgroundColor: c.bg }]}>
      <Text style={[styles.label, { color: c.fg }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

// Event statuses as used across the app.
export function eventStatusTone(status: string): Tone {
  switch (status) {
    case "Completed": return "good";
    case "Cancelled": return "bad";
    case "Confirmed": return "info";
    case "Upcoming": return "info";
    default: return "neutral";
  }
}

const styles = StyleSheet.create({
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, alignSelf: "flex-start" },
  label: { fontSize: 12, fontWeight: "600" },
});
