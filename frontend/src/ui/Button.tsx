import type { ReactNode } from "react";
import { Pressable, Text, View, ActivityIndicator, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, touch } from "./theme";

type Variant = "primary" | "secondary" | "link" | "danger";

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
// else, link = light inline actions (View), danger = destructive (Delete).
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
      style={({ pressed }) => [
        styles.base,
        v.box,
        full && styles.full,
        pressed && !inactive && v.pressed,
        disabled && styles.disabled,
        style,
      ]}
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

const VARIANTS: Record<Variant, { box: ViewStyle; pressed: ViewStyle; text: { color: string } }> = {
  primary: { box: { backgroundColor: colors.primary }, pressed: { opacity: 0.85 }, text: { color: colors.onPrimary } },
  secondary: { box: { borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.card }, pressed: { backgroundColor: colors.cardRaised }, text: { color: colors.text } },
  link: { box: { paddingHorizontal: 10 }, pressed: { opacity: 0.7 }, text: { color: colors.link } },
  danger: { box: { borderWidth: 1, borderColor: colors.dangerBorder }, pressed: { backgroundColor: colors.dangerSoft }, text: { color: colors.danger } },
};

const styles = StyleSheet.create({
  base: {
    minHeight: touch, borderRadius: radius.control, paddingHorizontal: 18,
    alignItems: "center", justifyContent: "center",
  },
  full: { alignSelf: "stretch" },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  hidden: { opacity: 0 },
  spinner: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
  label: { fontSize: 15, fontWeight: "600" },
  disabled: { opacity: 0.45 },
});
