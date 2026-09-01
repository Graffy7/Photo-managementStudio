import { View, Text, StyleSheet } from "react-native";

type Tone = "good" | "bad" | "warn" | "neutral";

const TONE_COLORS: Record<Tone, { bg: string; fg: string }> = {
  good: { bg: "rgba(76, 196, 147, 0.16)", fg: "#4cc493" },
  bad: { bg: "rgba(255, 122, 114, 0.16)", fg: "#ff7a72" },
  warn: { bg: "rgba(242, 189, 92, 0.16)", fg: "#f2bd5c" },
  neutral: { bg: "rgba(167, 183, 203, 0.14)", fg: "#a7b7cb" },
};

export function StatusPill({ label, tone }: { label: string; tone: Tone }) {
  const colors = TONE_COLORS[tone];
  return (
    <View style={[styles.pill, { backgroundColor: colors.bg }]}>
      <Text style={[styles.label, { color: colors.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
    alignSelf: "flex-start",
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
  },
});
