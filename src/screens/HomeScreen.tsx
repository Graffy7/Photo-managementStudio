import { useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator, ScrollView } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "../auth/authStore";
import { featuresApi } from "../api/featuresApi";
import { studioDashboardApi } from "../api/studioDashboardApi";
import { notificationsApi } from "../api/notificationsApi";
import { StatusPill } from "../components/StatusPill";
import { DATE_RANGE_PRESETS, DATE_RANGE_PRESET_LABELS, type DateRangePreset } from "../types/studioDashboard";

function formatCurrency(value: number): string {
  return `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function StatTile({ label, value, tone }: { label: string; value: string | number; tone?: "good" | "bad" | "warn" }) {
  const toneColor = tone === "good" ? "#4cc493" : tone === "bad" ? "#ff7a72" : tone === "warn" ? "#f2bd5c" : "#e8edf3";
  return (
    <View style={styles.tile}>
      <Text style={[styles.tileValue, { color: toneColor }]}>{value}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </View>
  );
}

export function HomeScreen() {
  const navigation = useNavigation<any>();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const [preset, setPreset] = useState<DateRangePreset>("ThisMonth");

  const { data: myFeatures } = useQuery({
    queryKey: ["my-features"],
    queryFn: featuresApi.getMyFeatures,
  });

  const { data: unreadCount } = useQuery({
    queryKey: ["notifications-unread-count"],
    queryFn: notificationsApi.getUnreadCount,
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ["studio-dashboard-summary", preset],
    queryFn: () => studioDashboardApi.getSummary(preset),
  });

  const enabledModules = Object.entries(myFeatures ?? {}).filter(([, enabled]) => enabled);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Dashboard</Text>
          <Text style={styles.subtitle}>{user?.fullName} · Studio #{user?.studioId}</Text>
        </View>
        <View style={styles.headerButtons}>
          <Pressable style={styles.secondaryButton} onPress={() => navigation.navigate("Leads")}>
            <Text style={styles.secondaryButtonText}>Leads</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => navigation.navigate("Customers")}>
            <Text style={styles.secondaryButtonText}>Customers</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => navigation.navigate("Events")}>
            <Text style={styles.secondaryButtonText}>Events</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => navigation.navigate("Workers")}>
            <Text style={styles.secondaryButtonText}>Workers</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => navigation.navigate("Services")}>
            <Text style={styles.secondaryButtonText}>Services</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => navigation.navigate("Quotations")}>
            <Text style={styles.secondaryButtonText}>Quotations</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => navigation.navigate("Payments")}>
            <Text style={styles.secondaryButtonText}>Payments</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => navigation.navigate("Expenses")}>
            <Text style={styles.secondaryButtonText}>Expenses</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => navigation.navigate("Reports")}>
            <Text style={styles.secondaryButtonText}>Reports</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => navigation.navigate("DayBoard")}>
            <Text style={styles.secondaryButtonText}>Day Board</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => navigation.navigate("Notifications")}>
            <Text style={styles.secondaryButtonText}>Notifications</Text>
            {!!unreadCount && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
              </View>
            )}
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => navigation.navigate("Settings")}>
            <Text style={styles.secondaryButtonText}>Settings</Text>
          </Pressable>
          <Pressable style={styles.button} onPress={() => logout()}>
            <Text style={styles.buttonText}>Sign out</Text>
          </Pressable>
        </View>
      </View>

      {enabledModules.length > 0 && (
        <View style={styles.pillRow}>
          {enabledModules.map(([code]) => (
            <StatusPill key={code} label={code.replace("_", " ")} tone="good" />
          ))}
        </View>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetRow} contentContainerStyle={styles.presetRowContent}>
        {DATE_RANGE_PRESETS.map((p) => (
          <Pressable key={p} style={[styles.presetChip, preset === p && styles.presetChipSelected]} onPress={() => setPreset(p)}>
            <Text style={[styles.presetChipText, preset === p && styles.presetChipTextSelected]}>{DATE_RANGE_PRESET_LABELS[p]}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {isLoading ? (
        <ActivityIndicator color="#ff9a4d" style={{ marginTop: 40 }} />
      ) : isError || !data ? (
        <Text style={styles.error}>Couldn't load the dashboard.</Text>
      ) : (
        <>
          <Text style={styles.sectionLabel}>Leads</Text>
          <View style={styles.grid}>
            <StatTile label="Total" value={data.totalLeads} />
            <StatTile label="New" value={data.newLeads} />
            <StatTile label="Converted" value={data.convertedLeads} tone="good" />
            <StatTile label="Conversion rate" value={`${data.conversionRate}%`} />
          </View>

          <Text style={styles.sectionLabel}>Customers</Text>
          <View style={styles.grid}>
            <StatTile label="Total customers" value={data.totalCustomers} />
          </View>

          <Text style={styles.sectionLabel}>Events</Text>
          <View style={styles.grid}>
            <StatTile label="Total" value={data.totalEvents} />
            <StatTile label="Upcoming" value={data.upcomingEvents} tone="warn" />
            <StatTile label="Completed" value={data.completedEvents} tone="good" />
            <StatTile label="Cancelled" value={data.cancelledEvents} tone={data.cancelledEvents > 0 ? "bad" : undefined} />
          </View>

          <Text style={styles.sectionLabel}>Finance</Text>
          <View style={styles.grid}>
            <StatTile label="Quotation value" value={formatCurrency(data.quotationValue)} />
            <StatTile label="Collected revenue" value={formatCurrency(data.collectedRevenue)} tone="good" />
            <StatTile label="Outstanding" value={formatCurrency(data.outstandingBalance)} tone={data.outstandingBalance > 0 ? "warn" : undefined} />
            <StatTile label="Expenses" value={formatCurrency(data.totalExpenses)} />
            <StatTile label="Expected profit" value={formatCurrency(data.expectedProfit)} tone={data.expectedProfit >= 0 ? "good" : "bad"} />
            <StatTile label="Cash profit" value={formatCurrency(data.cashProfit)} tone={data.cashProfit >= 0 ? "good" : "bad"} />
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0d1826" },
  content: { padding: 24, maxWidth: 720, width: "100%", alignSelf: "center" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 },
  title: { fontSize: 26, fontWeight: "700", color: "#e8edf3" },
  subtitle: { fontSize: 13, color: "#6f83a0", marginTop: 2 },
  headerButtons: { flexDirection: "row", gap: 10 },
  button: { backgroundColor: "#23405c", borderRadius: 8, paddingVertical: 10, paddingHorizontal: 18 },
  buttonText: { color: "#e8edf3", fontWeight: "600", fontSize: 13 },
  secondaryButton: { backgroundColor: "transparent", borderRadius: 8, paddingVertical: 10, paddingHorizontal: 18, borderWidth: 1, borderColor: "#23405c" },
  secondaryButtonText: { color: "#a7b7cb", fontWeight: "600", fontSize: 13 },
  badge: {
    position: "absolute", top: -6, right: -6, backgroundColor: "#ff7a72", borderRadius: 100,
    minWidth: 18, height: 18, paddingHorizontal: 4, alignItems: "center", justifyContent: "center",
  },
  badgeText: { color: "#0d1826", fontSize: 10, fontWeight: "700" },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 16 },
  presetRow: { marginBottom: 10 },
  presetRowContent: { gap: 8, paddingRight: 8 },
  presetChip: { borderWidth: 1, borderColor: "#23405c", borderRadius: 100, paddingVertical: 7, paddingHorizontal: 14, backgroundColor: "#132540" },
  presetChipSelected: { borderColor: "#ff9a4d", backgroundColor: "rgba(255, 154, 77, 0.14)" },
  presetChipText: { color: "#a7b7cb", fontSize: 12, fontWeight: "600" },
  presetChipTextSelected: { color: "#ff9a4d" },
  error: { color: "#ff7a72", marginTop: 40, textAlign: "center" },
  sectionLabel: {
    fontSize: 12, color: "#7fc0e6", fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5,
    marginTop: 20, marginBottom: 10,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  tile: {
    flexGrow: 1, minWidth: 140, backgroundColor: "#132540", borderRadius: 10, borderWidth: 1, borderColor: "#23405c",
    paddingVertical: 16, paddingHorizontal: 18,
  },
  tileValue: { fontSize: 24, fontWeight: "700", fontVariant: ["tabular-nums"] },
  tileLabel: { fontSize: 12, color: "#a7b7cb", marginTop: 4 },
});
