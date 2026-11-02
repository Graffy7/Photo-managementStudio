import { ScrollView, Pressable, Text, StyleSheet } from "react-native";
import { colors, radius, space, type } from "./theme";

// One row of choices (All / Upcoming / Completed...). Scrolls sideways on narrow screens rather
// than wrapping, so the list below never jumps when the selection changes.
export function FilterChips<T extends string | number | null>({ options, value, onChange }: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            onPress={() => onChange(o.value)}
            style={[styles.chip, on && styles.chipOn]}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
          >
            <Text style={[styles.text, on && styles.textOn]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: space.sm },
  chip: {
    minHeight: 36, justifyContent: "center", borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.pill,
    paddingHorizontal: 14, backgroundColor: colors.card,
  },
  chipOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  text: { ...type.small, fontWeight: "600", color: colors.textMuted },
  textOn: { color: colors.primary },
});
