import type { ReactNode } from "react";
import { Pressable, Text, View, ActivityIndicator, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, touch, shadow, transition, webShadow, hoverMotion } from "./theme";

type Variant = "primary" | "secondary" | "link" | "danger" | "destructive";

interface Props {
  label: string;
  onPress: () => void;
  variant?: Variant;
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  // Shows a spinner in place of the label; the button keeps its size so nothing around it moves.
  loading?: boolean;
  full?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  children?: ReactNode;
}

// The app's one button. Primary = the main action on a screen (use one), secondary = everything
// else, link = light inline actions (View), danger = destructive (Delete) in a row of buttons,
// destructive = the solid red final "Delete" in a confirmation dialog.
export function Button({ label, onPress, variant = "secondary", icon, disabled, loading, full, style, accessibilityLabel }: Props) {
  const v = VARIANTS[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      style={(state) => {
        // `hovered` exists on the web (mouse); phones only get `pressed`.
        const hovered = (state as { hovered?: boolean }).hovered && !inactive;
        return [
          styles.base,
          v.box,
          full && styles.full,
          hovered && v.hover,
          state.pressed && !inactive && v.pressed,
          disabled && styles.disabled,
          style,
        ];
      }}
    >
      <View style={[styles.row, loading && styles.hidden]}>
        {icon && <Ionicons name={icon} size={18} color={v.text.color} />}
        <Text style={[styles.label, v.text]} numberOfLines={1}>{label}</Text>
      </View>
      {loading && (
        <View style={styles.spinner} pointerEvents="none">
          <ActivityIndicator size="small" color={v.text.color} />
        </View>
      )}
    </Pressable>
  );
}

const lift = hoverMotion([{ translateY: -1 }]);
const VARIANTS: Record<Variant, { box: ViewStyle; hover: ViewStyle; pressed: ViewStyle; text: { color: string } }> = {
  primary: {
    box: { backgroundColor: colors.primaryFill },
    hover: { backgroundColor: colors.primaryFillHover, ...lift, ...webShadow(shadow.button) },
    pressed: { backgroundColor: colors.primaryFillHover },
    text: { color: colors.onPrimaryFill },
  },
  secondary: {
    box: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
    hover: { borderColor: colors.primary, backgroundColor: colors.primarySoft, ...lift },
    pressed: { backgroundColor: colors.primarySoft },
    text: { color: colors.text },
  },
  link: { box: { paddingHorizontal: 10 }, hover: { backgroundColor: colors.primarySoft }, pressed: { opacity: 0.7 }, text: { color: colors.link } },
  destructive: {
    box: { backgroundColor: "#D92D4A" }, // deeper than colors.danger so white text stays readable
    hover: { backgroundColor: "#E5405B", ...lift, ...webShadow("0 6px 18px rgba(255,92,117,0.35)") },
    pressed: { backgroundColor: "#E5405B" },
    text: { color: colors.onPrimaryFill },
  },
  danger: {
    box: { borderWidth: 1, borderColor: colors.dangerBorder, backgroundColor: colors.card },
    hover: { backgroundColor: colors.dangerSoft, ...lift },
    pressed: { backgroundColor: colors.dangerSoft },
    text: { color: colors.danger },
  },
};

const styles = StyleSheet.create({
  base: {
    minHeight: touch, borderRadius: radius.control, paddingHorizontal: 18,
    alignItems: "center", justifyContent: "center", ...transition,
  },
  full: { alignSelf: "stretch" },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  hidden: { opacity: 0 },
  spinner: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
  label: { fontSize: 14, fontWeight: "500" },
  disabled: { opacity: 0.45 },
});
