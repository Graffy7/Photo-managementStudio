import type { ReactNode } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, space, type } from "./theme";

// Shown instead of a blank area: what this space is for, and the one thing to do next.
export function EmptyState({ icon, title, text, action }: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  text?: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.box}>
      <Ionicons name={icon} size={36} color={colors.textFaint} />
      <Text style={styles.title}>{title}</Text>
      {text && <Text style={styles.text}>{text}</Text>}
      {action && <View style={{ marginTop: space.sm }}>{action}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: "center", gap: space.sm, paddingVertical: 48, paddingHorizontal: space.xl },
  title: { ...type.heading, color: colors.text, textAlign: "center" },
  text: { ...type.body, color: colors.textMuted, textAlign: "center", maxWidth: 420 },
});
