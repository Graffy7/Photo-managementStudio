import { useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { StudioProfileTab } from "./settings/StudioProfileTab";
import { LogoBrandingTab } from "./settings/LogoBrandingTab";
import { BusinessSettingsTab } from "./settings/BusinessSettingsTab";
import { NotificationSettingsTab } from "./settings/NotificationSettingsTab";
import { QuotationSettingsTab } from "./settings/QuotationSettingsTab";
import { PdfSettingsTab } from "./settings/PdfSettingsTab";
import { SecurityTab } from "./settings/SecurityTab";

type TabKey = "profile" | "logo" | "business" | "notifications" | "quotation" | "pdf" | "security";

const TABS: { key: TabKey; label: string }[] = [
  { key: "profile", label: "Studio Profile" },
  { key: "logo", label: "Logo & Branding" },
  { key: "business", label: "Business" },
  { key: "notifications", label: "Notifications" },
  { key: "quotation", label: "Quotations" },
  { key: "pdf", label: "Quotation PDF" },
  { key: "security", label: "Security" },
];

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
  const [tab, setTab] = useState<TabKey>("profile");

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
        <Text style={styles.backText}>‹ Back</Text>
      </Pressable>
      <Text style={styles.title}>Studio settings</Text>
      <Text style={styles.subtitle}>Manage your studio's profile, branding, and defaults.</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabRow} contentContainerStyle={styles.tabRowContent}>
        {TABS.map((t) => (
          <Pressable key={t.key} style={[styles.tab, tab === t.key && styles.tabActive]} onPress={() => setTab(t.key)}>
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.tabContent}>
        {tab === "profile" && <StudioProfileTab />}
        {tab === "logo" && <LogoBrandingTab />}
        {tab === "business" && <BusinessSettingsTab />}
        {tab === "notifications" && <NotificationSettingsTab />}
        {tab === "quotation" && <QuotationSettingsTab />}
        {tab === "pdf" && <PdfSettingsTab />}
        {tab === "security" && <SecurityTab />}
      </View>

      <Text style={styles.moreLabel}>More</Text>
      <View style={styles.list}>
        <SettingsRow
          title="Dropdown lists"
          subtitle="Event types, enquiry sources, statuses, worker types"
          onPress={() => navigation.navigate("Lookups")}
        />
        <View style={styles.separator} />
        <SettingsRow
          title="Enquiry form fields"
          subtitle="Show, hide, require, or add fields to your enquiry form"
          onPress={() => navigation.navigate("LeadFormConfig")}
        />
        <View style={styles.separator} />
        <SettingsRow
          title="Activity"
          subtitle="See who did what and when in your studio"
          onPress={() => navigation.navigate("Activity")}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0d1826" },
  content: { padding: 24, maxWidth: 760, width: "100%", alignSelf: "center" },
  backButton: { marginBottom: 14 },
  backText: { color: "#7fc0e6", fontSize: 13, fontWeight: "600" },
  title: { fontSize: 24, fontWeight: "700", color: "#e8edf3" },
  subtitle: { fontSize: 13, color: "#6f83a0", marginTop: 4, marginBottom: 20 },
  tabRow: { marginBottom: 20 },
  tabRowContent: { gap: 8, paddingRight: 8 },
  tab: { borderWidth: 1, borderColor: "#23405c", borderRadius: 100, paddingVertical: 8, paddingHorizontal: 16, backgroundColor: "#132540" },
  tabActive: { backgroundColor: "rgba(255, 154, 77, 0.14)", borderColor: "#ff9a4d" },
  tabText: { color: "#a7b7cb", fontSize: 13, fontWeight: "600" },
  tabTextActive: { color: "#ff9a4d" },
  tabContent: {
    borderWidth: 1, borderColor: "#23405c", borderRadius: 12, backgroundColor: "#0f1e30", padding: 20, marginBottom: 28,
  },
  moreLabel: {
    fontSize: 12, color: "#7fc0e6", fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10,
  },
  list: {
    borderWidth: 1, borderColor: "#23405c", borderRadius: 10, backgroundColor: "#132540", overflow: "hidden",
  },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16 },
  rowTitle: { color: "#e8edf3", fontSize: 15, fontWeight: "600" },
  rowSubtitle: { color: "#6f83a0", fontSize: 12, marginTop: 2 },
  chevron: { color: "#6f83a0", fontSize: 18 },
  separator: { height: 1, backgroundColor: "#1b2c42" },
});
