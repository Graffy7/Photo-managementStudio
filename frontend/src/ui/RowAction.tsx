import { Pressable, Text, StyleSheet, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, type, transition } from "./theme";

export type RowActionKind = "neutral" | "primary" | "danger";

const KIND_COLORS: Record<RowActionKind, { fg: string; hoverBg: string; hoverBorder: string }> = {
  neutral: { fg: colors.textMuted, hoverBg: colors.hover, hoverBorder: colors.borderStrong },
  primary: { fg: colors.primary, hoverBg: colors.primarySoft, hoverBorder: colors.borderStrong },
  danger: { fg: colors.danger, hoverBg: colors.dangerSoft, hoverBorder: colors.dangerBorder },
};

// A compact table-row action, coloured by what it does (neutral for Edit/Quote, primary for the
// main step, danger for Delete). iconOnly: a small square icon button - the label is still read
// out by screen readers. Shared by the lists. busy: a spinner replaces the icon and presses are
// ignored (e.g. while a PDF is prepared). color: overrides the kind's icon colour (brand icons).
export function RowAction({ icon, label, kind = "neutral", onPress, accessibilityLabel, iconOnly, busy, color, selected }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  kind?: RowActionKind;
  onPress: () => void;
  accessibilityLabel?: string;
  iconOnly?: boolean;
  busy?: boolean;
  color?: string;
  selected?: boolean;
}) {
  const c = KIND_COLORS[kind];
  const fg = color ?? c.fg;
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ busy: !!busy, selected: !!selected }}
      style={(state) => [
        styles.action, iconOnly && styles.iconOnly,
        ((state as { hovered?: boolean }).hovered || selected) && { backgroundColor: c.hoverBg, borderColor: c.hoverBorder },
      ]}
    >
      {busy ? <ActivityIndicator size="small" color={fg} /> : <Ionicons name={icon} size={iconOnly ? 16 : 15} color={fg} />}
      {!iconOnly && <Text style={[styles.label, { color: fg }]}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  action: {
    flexDirection: "row", alignItems: "center", gap: 5, height: 32, paddingHorizontal: 10, borderRadius: radius.control,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.cardRaised, ...transition,
  },
  iconOnly: { width: 32, paddingHorizontal: 0, justifyContent: "center" },
  label: { ...type.small, fontWeight: "500" },
});
