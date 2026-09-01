import { View, Text, Pressable, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";

function SettingsRow({ title, subtitle, onPress }: { title: string; subtitle: string; onPress: () => void }) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSubtitle}>{subtitle}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

export function SettingsScreen() {
  const navigation = useNavigation<any>();

  return (
    <View style={styles.screen}>
      <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
        <Text style={styles.backText}>‹ Back</Text>
      </Pressable>
      <Text style={styles.title}>Studio settings</Text>

      <View style={styles.list}>
        <SettingsRow
          title="Dropdown lists"
          subtitle="Event types, lead sources, statuses, worker types"
          onPress={() => navigation.navigate("Lookups")}
        />
        <View style={styles.separator} />
        <SettingsRow
          title="Lead form fields"
          subtitle="Show, hide, require, or add fields to your lead form"
          onPress={() => navigation.navigate("LeadFormConfig")}
        />
        <View style={styles.separator} />
        <SettingsRow
          title="Activity"
          subtitle="See who did what and when in your studio"
          onPress={() => navigation.navigate("Activity")}
        />
        <View style={styles.separator} />
        <SettingsRow title="Change password" subtitle="Update your login password" onPress={() => navigation.navigate("ChangePassword")} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0d1826", padding: 24 },
  backButton: { marginBottom: 14 },
  backText: { color: "#7fc0e6", fontSize: 13, fontWeight: "600" },
  title: { fontSize: 24, fontWeight: "700", color: "#e8edf3", marginBottom: 20 },
  list: {
    maxWidth: 480, width: "100%", alignSelf: "center",
    borderWidth: 1, borderColor: "#23405c", borderRadius: 10, backgroundColor: "#132540", overflow: "hidden",
  },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16 },
  rowTitle: { color: "#e8edf3", fontSize: 15, fontWeight: "600" },
  rowSubtitle: { color: "#6f83a0", fontSize: 12, marginTop: 2 },
  chevron: { color: "#6f83a0", fontSize: 18 },
  separator: { height: 1, backgroundColor: "#1b2c42" },
});
