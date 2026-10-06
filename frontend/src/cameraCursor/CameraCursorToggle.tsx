import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useCameraCursor } from "./cameraCursorStore";
import { colors, radius, space, touch, type } from "../ui/theme";

// Switches Camera Cursor Mode on and off. "row" sits in the sidebar with a label and a switch;
// "icon" is the compact button for the phone/tablet top bar. Web only - there's no mouse pointer
// to replace in the native apps.
export function CameraCursorToggle({ variant = "row" }: { variant?: "row" | "icon" }) {
  const enabled = useCameraCursor((s) => s.enabled);
  const toggle = useCameraCursor((s) => s.toggle);
  if (Platform.OS !== "web") return null;

  const a11y = {
    accessibilityRole: "switch" as const,
    accessibilityState: { checked: enabled },
    accessibilityLabel: "Camera cursor",
    "aria-checked": enabled,
  };

  if (variant === "icon") {
    return (
      <Pressable style={styles.icon} onPress={toggle} {...a11y}>
        <Ionicons name={enabled ? "camera" : "camera-outline"} size={22} color={enabled ? colors.primary : colors.text} />
      </Pressable>
    );
  }

  return (
    <Pressable style={({ pressed }) => [styles.row, pressed && styles.pressed]} onPress={toggle} {...a11y}>
      <Ionicons name={enabled ? "camera" : "camera-outline"} size={18} color={enabled ? colors.primary : colors.textMuted} />
      <Text style={[styles.label, enabled && styles.labelOn]} numberOfLines={1}>Camera cursor</Text>
      <View style={[styles.track, enabled && styles.trackOn]}>
        <View style={[styles.knob, enabled && styles.knobOn]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row", alignItems: "center", gap: space.md, minHeight: touch, paddingHorizontal: space.md,
    borderRadius: radius.control,
  },
  pressed: { backgroundColor: colors.cardRaised },
  label: { ...type.small, fontWeight: "600", color: colors.textMuted, flex: 1 },
  labelOn: { color: colors.text },
  track: {
    width: 34, height: 20, borderRadius: 10, padding: 2, justifyContent: "center",
    backgroundColor: colors.border, borderWidth: 1, borderColor: colors.borderStrong,
  },
  trackOn: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  knob: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.textFaint },
  knobOn: { backgroundColor: colors.primary, alignSelf: "flex-end" },
  icon: { width: touch, height: touch, alignItems: "center", justifyContent: "center" },
});
