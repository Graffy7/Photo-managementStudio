import { View, Text, Image, Pressable, Platform, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Toggle } from "../components/Toggle";
import { colors, radius, space } from "../ui/theme";
import { useCameraModeStore } from "./cameraModeStore";
import { CAMERA_CURSORS, cameraImageUri } from "./cameraCursors";

const PREVIEW_SIZE = 30;

// The Camera Mode on/off switch, as a self-contained card that can be dropped onto any screen.
// On web, where there is a mouse pointer, it also lets the person pick which camera the pointer is.
export function CameraModeToggle() {
  const enabled = useCameraModeStore((s) => s.enabled);
  const setEnabled = useCameraModeStore((s) => s.setEnabled);
  const cursor = useCameraModeStore((s) => s.cursor);
  const setCursor = useCameraModeStore((s) => s.setCursor);

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Ionicons name="camera-outline" size={20} color={enabled ? colors.primary : colors.textMuted} />
        <View style={styles.text}>
          <Text style={styles.label}>Camera Mode</Text>
          <Text style={styles.caption}>Shutter effect and click sound when you tap. Saved on this device.</Text>
        </View>
        <Toggle value={enabled} onValueChange={setEnabled} />
      </View>

      {enabled && Platform.OS === "web" && (
        <View style={styles.picker}>
          <Text style={styles.pickerTitle}>Pointer</Text>
          <View style={styles.options}>
            {CAMERA_CURSORS.map((c) => {
              const on = c.id === cursor;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => setCursor(c.id)}
                  style={[styles.option, on && styles.optionOn]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${c.label} pointer`}
                >
                  <Image source={{ uri: cameraImageUri(c.id, PREVIEW_SIZE) }} style={styles.preview} />
                  <Text style={[styles.optionText, on && styles.optionTextOn]}>{c.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.card, backgroundColor: colors.cardRaised },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.md, paddingHorizontal: space.lg },
  text: { flex: 1, minWidth: 0 },
  label: { color: colors.text, fontSize: 14, fontWeight: "600" },
  caption: { color: colors.textFaint, fontSize: 11, marginTop: 2 },
  picker: { borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: space.md, paddingHorizontal: space.lg },
  pickerTitle: { color: colors.textMuted, fontSize: 12, fontWeight: "600", marginBottom: space.sm },
  options: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  option: {
    width: 76, paddingVertical: space.sm, alignItems: "center", gap: 6,
    borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.control, backgroundColor: colors.card,
  },
  optionOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  preview: { width: PREVIEW_SIZE, height: PREVIEW_SIZE },
  optionText: { color: colors.textMuted, fontSize: 11, fontWeight: "600" },
  optionTextOn: { color: colors.text },
});
