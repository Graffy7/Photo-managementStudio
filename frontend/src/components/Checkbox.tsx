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
    width: 18, height: 18, borderRadius: 4, borderWidth: 1, borderColor: "#2E4377",
    alignItems: "center", justifyContent: "center", backgroundColor: "#070F24",
  },
  boxChecked: { backgroundColor: "#5B9BFF", borderColor: "#5B9BFF" },
  check: { color: "#070F24", fontSize: 12, fontWeight: "700", lineHeight: 14 },
  label: { color: "#A4AFCF", fontSize: 13 },
});
