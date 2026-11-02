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
    width: 18, height: 18, borderRadius: 4, borderWidth: 1, borderColor: "#d9dbec",
    alignItems: "center", justifyContent: "center", backgroundColor: "#f7f7ff",
  },
  boxChecked: { backgroundColor: "#6d4aff", borderColor: "#6d4aff" },
  check: { color: "#f7f7ff", fontSize: 12, fontWeight: "700", lineHeight: 14 },
  label: { color: "#74758c", fontSize: 13 },
});
