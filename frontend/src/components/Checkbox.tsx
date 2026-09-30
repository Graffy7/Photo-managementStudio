import { Pressable, View, Text, StyleSheet } from "react-native";

export function Checkbox({ checked, onToggle, label }: { checked: boolean; onToggle: () => void; label: string }) {
  return (
    <Pressable style={styles.row} onPress={onToggle}>
      <View style={[styles.box, checked && styles.boxChecked]}>{checked && <Text style={styles.check}>✓</Text>}</View>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  box: {
    width: 18, height: 18, borderRadius: 4, borderWidth: 1, borderColor: "#2c4463",
    alignItems: "center", justifyContent: "center", backgroundColor: "#0b1522",
  },
  boxChecked: { backgroundColor: "#ff9a4d", borderColor: "#ff9a4d" },
  check: { color: "#0b1522", fontSize: 12, fontWeight: "700", lineHeight: 14 },
  label: { color: "#9fb0c5", fontSize: 13 },
});
