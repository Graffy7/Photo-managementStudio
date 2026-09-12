import { View, Text, Pressable, StyleSheet, ActivityIndicator, ScrollView } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { dashboardApi } from "../../api/dashboardApi";
import { useRefetchOnFocus } from "../../hooks/useRefetchOnFocus";

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

export function DashboardScreen({ onViewStudios }: { onViewStudios: () => void }) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: dashboardApi.getSummary,
  });
  useRefetchOnFocus(refetch);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Dashboard</Text>
          <Text style={styles.subtitle}>Platform overview, across every studio.</Text>
        </View>
        <Pressable style={styles.studiosButton} onPress={onViewStudios}>
          <Text style={styles.studiosButtonText}>Studios ›</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <ActivityIndicator color="#ff9a4d" style={{ marginTop: 40 }} />
      ) : isError || !data ? (
        <Text style={styles.error}>Couldn't load the dashboard.</Text>
      ) : (
        <>
          <Text style={styles.sectionLabel}>Studios</Text>
          <View style={styles.grid}>
            <StatTile label="Total" value={data.totalStudios} />
            <StatTile label="Active" value={data.activeStudios} tone="good" />
            <StatTile label="Blocked" value={data.blockedStudios} tone={data.blockedStudios > 0 ? "bad" : undefined} />
            <StatTile label="New this month" value={data.newStudiosThisMonth} />
          </View>

          <Text style={styles.sectionLabel}>Subscriptions</Text>
          <View style={styles.grid}>
            <StatTile label="Expiring in 7 days" value={data.expiringSoon} tone={data.expiringSoon > 0 ? "warn" : undefined} />
            <StatTile label="Expired" value={data.expiredSubscriptions} tone={data.expiredSubscriptions > 0 ? "bad" : undefined} />
          </View>

          <Text style={styles.sectionLabel}>Revenue</Text>
          <View style={styles.grid}>
            <StatTile label="This month" value={formatCurrency(data.revenueThisMonth)} tone="good" />
            <StatTile label="All time" value={formatCurrency(data.totalRevenue)} />
          </View>

          {data.planDistribution.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>Plan distribution</Text>
              <View style={styles.planList}>
                {data.planDistribution.map((p) => (
                  <View key={p.planName} style={styles.planRow}>
                    <Text style={styles.planName}>{p.planName}</Text>
                    <Text style={styles.planCount}>{p.studioCount} studio{p.studioCount === 1 ? "" : "s"}</Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0d1826" },
  content: { padding: 24, maxWidth: 720, width: "100%", alignSelf: "center" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 },
  title: { fontSize: 26, fontWeight: "700", color: "#e8edf3" },
  subtitle: { fontSize: 13, color: "#6f83a0", marginTop: 2 },
  studiosButton: { backgroundColor: "#132540", borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16, borderWidth: 1, borderColor: "#23405c" },
  studiosButtonText: { color: "#7fc0e6", fontWeight: "600", fontSize: 13 },
  error: { color: "#ff7a72", marginTop: 40, textAlign: "center" },
  sectionLabel: {
    fontSize: 12, color: "#7fc0e6", fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5,
    marginTop: 24, marginBottom: 10,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  tile: {
    flexGrow: 1, minWidth: 140, backgroundColor: "#132540", borderRadius: 10, borderWidth: 1, borderColor: "#23405c",
    paddingVertical: 16, paddingHorizontal: 18,
  },
  tileValue: { fontSize: 26, fontWeight: "700", fontVariant: ["tabular-nums"] },
  tileLabel: { fontSize: 12, color: "#a7b7cb", marginTop: 4 },
  planList: {
    borderWidth: 1, borderColor: "#23405c", borderRadius: 10, backgroundColor: "#132540", overflow: "hidden",
  },
  planRow: {
    flexDirection: "row", justifyContent: "space-between", paddingVertical: 12, paddingHorizontal: 18,
    borderBottomWidth: 1, borderBottomColor: "#1b2c42",
  },
  planName: { color: "#e8edf3", fontSize: 14, fontWeight: "600" },
  planCount: { color: "#a7b7cb", fontSize: 13 },
});
