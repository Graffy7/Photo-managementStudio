import { useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator, ScrollView } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { reportsApi } from "../../api/reportsApi";
import { DATE_RANGE_PRESET_LABELS, type DateRangePreset } from "../../types/studioDashboard";
import { useRefetchOnFocus } from "../../hooks/useRefetchOnFocus";
import { MiniDatePicker } from "../../components/MiniDatePicker";

const REPORT_PRESETS: DateRangePreset[] = ["Today", "ThisWeek", "ThisMonth", "PreviousYear", "Custom"];

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

export function ReportsScreen() {
  const navigation = useNavigation<any>();
  const [preset, setPreset] = useState<DateRangePreset>("ThisMonth");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const customRangeReady = customStart.length > 0 && customEnd.length > 0;

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["profit-report", preset, customStart, customEnd],
    queryFn: () => reportsApi.getProfitReport(preset, customStart, customEnd),
    enabled: preset !== "Custom" || customRangeReady,
  });
  useRefetchOnFocus(refetch);

  const maxCategoryAmount = Math.max(1, ...(data?.expensesByCategory.map((c) => c.totalAmount) ?? [1]));

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Profit report</Text>
          <Text style={styles.subtitle}>Revenue, expenses, and per-event profitability</Text>
        </View>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>‹ Home</Text>
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetRow} contentContainerStyle={styles.presetRowContent}>
        {REPORT_PRESETS.map((p) => (
          <Pressable key={p} style={[styles.presetChip, preset === p && styles.presetChipSelected]} onPress={() => setPreset(p)}>
            <Text style={[styles.presetChipText, preset === p && styles.presetChipTextSelected]}>{DATE_RANGE_PRESET_LABELS[p]}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {preset === "Custom" && (
        <View style={styles.customRangeRow}>
          <MiniDatePicker label="From" value={customStart} onChange={setCustomStart} />
          <Ionicons name="arrow-forward" size={14} color="#6f83a0" style={{ marginTop: 20 }} />
          <MiniDatePicker label="To" value={customEnd} onChange={setCustomEnd} />
        </View>
      )}

      {preset === "Custom" && !customRangeReady ? (
        <Text style={styles.empty}>Enter both dates above to load this range.</Text>
      ) : isPending ? (
        <ActivityIndicator color="#ff9a4d" style={{ marginTop: 40 }} />
      ) : isError || !data ? (
        <Text style={styles.error}>Couldn't load the report.</Text>
      ) : (
        <>
          <View style={styles.grid}>
            <StatTile label="Quotation value" value={formatCurrency(data.totalQuotationValue)} />
            <StatTile label="Collected revenue" value={formatCurrency(data.totalCollectedRevenue)} tone="good" />
            <StatTile label="Expenses" value={formatCurrency(data.totalExpenses)} tone="bad" />
            <StatTile label="Expected profit" value={formatCurrency(data.totalExpectedProfit)} tone={data.totalExpectedProfit >= 0 ? "good" : "bad"} />
            <StatTile label="Cash profit" value={formatCurrency(data.totalCashProfit)} tone={data.totalCashProfit >= 0 ? "good" : "bad"} />
          </View>

          <Text style={styles.sectionLabel}>Expenses by category</Text>
          {data.expensesByCategory.length === 0 ? (
            <Text style={styles.empty}>No expenses recorded in this range.</Text>
          ) : (
            <View style={styles.categoryList}>
              {data.expensesByCategory.map((c) => (
                <View key={c.categoryName} style={styles.categoryRow}>
                  <View style={styles.categoryHeader}>
                    <Text style={styles.categoryName}>{c.categoryName}</Text>
                    <Text style={styles.categoryAmount}>{formatCurrency(c.totalAmount)}</Text>
                  </View>
                  <View style={styles.categoryBarTrack}>
                    <View style={[styles.categoryBarFill, { width: `${(c.totalAmount / maxCategoryAmount) * 100}%` }]} />
                  </View>
                </View>
              ))}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0d1826" },
  content: { padding: 24, maxWidth: 720, width: "100%", alignSelf: "center" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 },
  title: { fontSize: 24, fontWeight: "700", color: "#e8edf3" },
  subtitle: { fontSize: 13, color: "#6f83a0", marginTop: 2 },
  backButton: { backgroundColor: "#132540", borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16, borderWidth: 1, borderColor: "#23405c" },
  backText: { color: "#7fc0e6", fontWeight: "600", fontSize: 13 },
  presetRow: { marginBottom: 20 },
  presetRowContent: { gap: 8, paddingRight: 8 },
  presetChip: { borderWidth: 1, borderColor: "#23405c", borderRadius: 100, paddingVertical: 7, paddingHorizontal: 14, backgroundColor: "#132540" },
  presetChipSelected: { borderColor: "#ff9a4d", backgroundColor: "rgba(255, 154, 77, 0.14)" },
  presetChipText: { color: "#a7b7cb", fontSize: 12, fontWeight: "600" },
  presetChipTextSelected: { color: "#ff9a4d" },
  customRangeRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 18, flexWrap: "wrap" },
  error: { color: "#ff7a72", marginTop: 40, textAlign: "center" },
  empty: { color: "#6f83a0", fontSize: 13, textAlign: "center", padding: 16 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 8 },
  tile: {
    flexGrow: 1, minWidth: 140, backgroundColor: "#132540", borderRadius: 10, borderWidth: 1, borderColor: "#23405c",
    paddingVertical: 16, paddingHorizontal: 18,
  },
  tileValue: { fontSize: 20, fontWeight: "700", fontVariant: ["tabular-nums"] },
  tileLabel: { fontSize: 12, color: "#a7b7cb", marginTop: 4 },
  sectionLabel: {
    fontSize: 12, color: "#7fc0e6", fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5,
    marginTop: 24, marginBottom: 10,
  },
  categoryList: { gap: 12 },
  categoryRow: { gap: 6 },
  categoryHeader: { flexDirection: "row", justifyContent: "space-between" },
  categoryName: { color: "#e8edf3", fontSize: 14, fontWeight: "600" },
  categoryAmount: { color: "#a7b7cb", fontSize: 13, fontVariant: ["tabular-nums"] },
  categoryBarTrack: { height: 6, borderRadius: 3, backgroundColor: "#132540", overflow: "hidden" },
  categoryBarFill: { height: 6, borderRadius: 3, backgroundColor: "#ff9a4d" },
});
