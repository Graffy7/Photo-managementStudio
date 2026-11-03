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
    width: 18, height: 18, borderRadius: 4, borderWidth: 1, borderColor: "#4B4F63",
    alignItems: "center", justifyContent: "center", backgroundColor: "#191B22",
  },
  boxChecked: { backgroundColor: "#B5A5FF", borderColor: "#B5A5FF" },
  check: { color: "#191B22", fontSize: 12, fontWeight: "700", lineHeight: 14 },
  label: { color: "#A1A5B3", fontSize: 13 },
});
