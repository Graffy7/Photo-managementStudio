import { Pressable, Text, StyleSheet } from "react-native";
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
// out by screen readers. Shared by the lists.
export function RowAction({ icon, label, kind = "neutral", onPress, accessibilityLabel, iconOnly }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  kind?: RowActionKind;
  onPress: () => void;
  accessibilityLabel?: string;
  iconOnly?: boolean;
}) {
  const c = KIND_COLORS[kind];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={(state) => [styles.action, iconOnly && styles.iconOnly, (state as { hovered?: boolean }).hovered && { backgroundColor: c.hoverBg, borderColor: c.hoverBorder }]}
    >
      <Ionicons name={icon} size={iconOnly ? 16 : 15} color={c.fg} />
      {!iconOnly && <Text style={[styles.label, { color: c.fg }]}>{label}</Text>}
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
