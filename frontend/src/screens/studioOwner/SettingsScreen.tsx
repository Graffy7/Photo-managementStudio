import { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { StudioProfileTab } from "./settings/StudioProfileTab";
import { BusinessSettingsTab } from "./settings/BusinessSettingsTab";
import { NotificationSettingsTab } from "./settings/NotificationSettingsTab";
import { QuotationSettingsTab } from "./settings/QuotationSettingsTab";
import { PdfSettingsTab } from "./settings/PdfSettingsTab";
import { SecurityTab } from "./settings/SecurityTab";
import { Screen } from "../../ui/Screen";
import { PageHeader } from "../../ui/PageHeader";
import { FilterChips } from "../../ui/FilterChips";
import { useBreakpoint } from "../../ui/useBreakpoint";
import { colors, radius, space, type } from "../../ui/theme";

type TabKey = "profile" | "business" | "notifications" | "quotation" | "pdf" | "security";

const TABS: { key: TabKey; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "profile", label: "Studio profile", icon: "business-outline" },
  { key: "business", label: "Business", icon: "briefcase-outline" },
  { key: "notifications", label: "Notifications", icon: "notifications-outline" },
  { key: "quotation", label: "Quotations", icon: "document-text-outline" },
  { key: "pdf", label: "Quotation PDF", icon: "print-outline" },
  { key: "security", label: "Security", icon: "lock-closed-outline" },
];

const MORE: { route: string; label: string; hint: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { route: "Lookups", label: "Dropdown lists", hint: "Event types, enquiry sources, statuses, worker types", icon: "list-outline" },
  { route: "LeadFormConfig", label: "Enquiry form fields", hint: "Show, hide, require, or add fields to your enquiry form", icon: "create-outline" },
  { route: "Activity", label: "Activity", hint: "See who did what and when in your studio", icon: "time-outline" },
];

export function SettingsScreen() {
  const navigation = useNavigation<any>();
  const { isDesktop } = useBreakpoint();
  const [tab, setTab] = useState<TabKey>("profile");
  const current = TABS.find((t) => t.key === tab)!;

  const content = (
    <View style={styles.tabContent}>
      {isDesktop && <Text style={styles.tabTitle}>{current.label}</Text>}
      {tab === "profile" && <StudioProfileTab />}
      {tab === "business" && <BusinessSettingsTab />}
      {tab === "notifications" && <NotificationSettingsTab />}
      {tab === "quotation" && <QuotationSettingsTab />}
      {tab === "pdf" && <PdfSettingsTab />}
      {tab === "security" && <SecurityTab />}
    </View>
  );

  return (
    <Screen maxWidth={1400}>
      <PageHeader title="Settings" subtitle="Your studio's profile, branding and defaults." />

      {isDesktop ? (
        // Desktop: every settings area listed on the left, the chosen one on the right.
        <View style={styles.panes}>
          <View style={styles.menu}>
            {TABS.map((t) => (
              <Pressable key={t.key} style={({ pressed }) => [styles.menuItem, tab === t.key && styles.menuItemActive, pressed && tab !== t.key && styles.menuItemPressed]} onPress={() => setTab(t.key)} accessibilityRole="tab" accessibilityState={{ selected: tab === t.key }}>
                <Ionicons name={t.icon} size={18} color={tab === t.key ? colors.primary : colors.textMuted} />
                <Text style={[styles.menuText, tab === t.key && styles.menuTextActive]}>{t.label}</Text>
              </Pressable>
            ))}
            <View style={styles.menuSeparator} />
            {MORE.map((m) => (
              <Pressable key={m.route} style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]} onPress={() => navigation.navigate(m.route)} accessibilityRole="link">
                <Ionicons name={m.icon} size={18} color={colors.textMuted} />
                <Text style={styles.menuText}>{m.label}</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
              </Pressable>
            ))}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>{content}</View>
        </View>
      ) : (
        <>
          <View style={{ marginBottom: space.lg }}>
            <FilterChips<TabKey> options={TABS.map((t) => ({ value: t.key, label: t.label }))} value={tab} onChange={setTab} />
          </View>
          {content}
          <Text style={styles.moreLabel}>More settings</Text>
          <View style={styles.list}>
            {MORE.map((m, i) => (
              <Pressable key={m.route} style={({ pressed }) => [styles.row, i > 0 && styles.rowSeparator, pressed && styles.menuItemPressed]} onPress={() => navigation.navigate(m.route)} accessibilityRole="link">
                <Ionicons name={m.icon} size={20} color={colors.textMuted} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.rowTitle}>{m.label}</Text>
                  <Text style={styles.rowSubtitle}>{m.hint}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
              </Pressable>
            ))}
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  panes: { flexDirection: "row", alignItems: "flex-start", gap: space.xl },
  menu: { width: 240, backgroundColor: colors.card, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, padding: space.sm, gap: 2 },
  menuItem: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 42, paddingHorizontal: space.md, borderRadius: radius.control },
  menuItemActive: { backgroundColor: colors.primarySoft },
  menuItemPressed: { backgroundColor: colors.cardRaised },
  menuText: { ...type.small, fontSize: 14, fontWeight: "600", color: colors.text, flex: 1 },
  menuTextActive: { color: colors.primary },
  menuSeparator: { height: 1, backgroundColor: colors.border, marginVertical: space.sm },
  tabContent: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.card, backgroundColor: colors.card, padding: space.lg },
  tabTitle: { ...type.heading, color: colors.text, marginBottom: space.lg },
  moreLabel: { ...type.heading, color: colors.text, marginTop: space.xl, marginBottom: space.md },
  list: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.card, backgroundColor: colors.card, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.lg, minHeight: 64 },
  rowSeparator: { borderTopWidth: 1, borderTopColor: colors.border },
  rowTitle: { ...type.body, fontWeight: "600", color: colors.text },
  rowSubtitle: { ...type.small, color: colors.textMuted, marginTop: 2 },
});
