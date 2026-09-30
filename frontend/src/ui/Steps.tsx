import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useBreakpoint } from "./useBreakpoint";
import { colors, radius, space, type } from "./theme";

export interface Step {
  title: string;
  // One short line under the title: what this step is, or how far along it is.
  detail: string;
}

// A numbered process with the current step highlighted: finished steps get a tick, later ones are
// dimmed. Four across on wider screens, a compact vertical list on phones. Tapping a step jumps to it.
export function StepGuide({ steps, current, done, onPress }: {
  steps: Step[];
  // 0-based index of the step the user is on.
  current: number;
  // Every step finished (the last one included).
  done?: boolean;
  onPress?: (index: number) => void;
}) {
  const { isPhone } = useBreakpoint();
  return (
    <View style={[styles.guide, isPhone ? styles.guidePhone : styles.guideWide]} accessibilityRole="list">
      {steps.map((s, i) => {
        const state = done || i < current ? "done" : i === current ? "current" : "todo";
        return (
          <Pressable
            key={s.title}
            onPress={onPress ? () => onPress(i) : undefined}
            disabled={!onPress}
            accessibilityRole="button"
            accessibilityLabel={`Step ${i + 1}: ${s.title}. ${state === "done" ? "Done" : state === "current" ? "Current step" : "Not yet"}. ${s.detail}`}
            style={({ pressed }) => [
              styles.step,
              isPhone ? styles.stepPhone : styles.stepWide,
              state === "current" && styles.stepCurrent,
              pressed && styles.pressed,
            ]}
          >
            <StepNumber n={i + 1} state={state} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.title, state === "todo" && styles.dim]} numberOfLines={1}>{s.title}</Text>
              <Text style={[styles.detail, state === "current" && styles.detailCurrent]} numberOfLines={2}>{s.detail}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function StepNumber({ n, state }: { n: number; state: "done" | "current" | "todo" }) {
  return (
    <View style={[styles.num, state === "done" && styles.numDone, state === "current" && styles.numCurrent]}>
      {state === "done"
        ? <Ionicons name="checkmark" size={16} color={colors.success} />
        : <Text style={[styles.numText, state === "current" && styles.numTextCurrent]}>{n}</Text>}
    </View>
  );
}

// Section heading that carries its step number, so each card on the page matches the guide.
export function StepTitle({ n, title, right }: { n: number; title: string; right?: React.ReactNode }) {
  return (
    <View style={styles.stepTitle}>
      <View style={[styles.num, styles.numSmall]}><Text style={styles.numText}>{n}</Text></View>
      <Text style={styles.stepTitleText} numberOfLines={1}>{title}</Text>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  guide: { gap: space.sm },
  guideWide: { flexDirection: "row" },
  guidePhone: { flexDirection: "column" },
  step: {
    flexDirection: "row", alignItems: "center", gap: space.md, backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.card, paddingHorizontal: space.md,
  },
  stepWide: { flex: 1, minWidth: 0, paddingVertical: space.md },
  stepPhone: { paddingVertical: space.sm, minHeight: 52 },
  stepCurrent: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  pressed: { opacity: 0.8 },
  num: {
    width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.page,
  },
  numSmall: { width: 26, height: 26, borderRadius: 13 },
  numDone: { borderColor: colors.success, backgroundColor: colors.successSoft },
  numCurrent: { borderColor: colors.primary, backgroundColor: colors.primary },
  numText: { ...type.small, fontWeight: "700", color: colors.textMuted },
  numTextCurrent: { color: colors.onPrimary },
  title: { ...type.body, fontWeight: "700", color: colors.text },
  dim: { color: colors.textMuted },
  detail: { ...type.caption, color: colors.textFaint },
  detailCurrent: { color: colors.text },
  stepTitle: { flexDirection: "row", alignItems: "center", gap: space.sm },
  stepTitleText: { ...type.heading, color: colors.text, flex: 1 },
});
