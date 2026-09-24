import { ScrollView, StyleSheet } from "react-native";
import { ActivityTable } from "./ActivityTable";
import { C, PageHeader } from "./ui";

export function AdminActivityScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <PageHeader title="Activity" subtitle="What studios and admins have done across the platform." />
      <ActivityTable />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.page },
  content: { padding: 24, gap: 16, maxWidth: 1400, width: "100%", alignSelf: "center" },
});
