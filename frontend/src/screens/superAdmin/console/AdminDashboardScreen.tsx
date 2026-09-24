import { useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, useWindowDimensions } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { adminConsoleApi } from "../../../api/adminConsoleApi";
import { LineChart } from "../../../components/LineChart";
import { DonutChart } from "../../../components/DonutChart";
import { useRefetchOnFocus } from "../../../hooks/useRefetchOnFocus";
import { BarChart, BarList } from "./BarChart";
import {
  C, Card, DateRange, DaysLeft, EmptyState, ErrorState, Loading, PageHeader, StatCard, StatusBadge, STATUS_META,
  bytes, isoDay, money, monthLabel, s,
} from "./ui";
import type { AdminStudioStatus } from "../../../types/adminConsole";

function defaultRange() {
  const end = new Date();
  const start = new Date(end.getFullYear(), end.getMonth() - 11, 1);
  return { from: isoDay(start), to: isoDay(end) };
}

export function AdminDashboardScreen({ onOpenStudio, onViewStudios }: {
  onOpenStudio: (studioId: number) => void;
  onViewStudios: (status?: AdminStudioStatus) => void;
}) {
  const wide = useWindowDimensions().width >= 1100;
  const [range, setRange] = useState(defaultRange);

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["admin-overview", range.from, range.to],
    queryFn: () => adminConsoleApi.overview(range),
  });
  const { data: expiring, refetch: refetchExpiring } = useQuery({
    queryKey: ["admin-studios", "expiring"],
    queryFn: () => adminConsoleApi.studios({ sort: "daysRemaining", page: 1, pageSize: 6 }),
  });
  useRefetchOnFocus(() => { refetch(); refetchExpiring(); });

  const soon = (expiring?.items ?? []).filter((r) => (r.status === "Active" || r.status === "Trial") && r.daysRemaining <= 14);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <PageHeader
        title="Dashboard"
        subtitle="Every studio on the platform at a glance."
        actions={<DateRange from={range.from} to={range.to} onChange={(from, to) => setRange({ from, to })} />}
      />

      {isPending ? <Loading /> : isError || !data ? <ErrorState text="Couldn't load the dashboard." onRetry={refetch} /> : (
        <View style={{ gap: 16 }}>
          <View style={styles.stats}>
            <StatCard label="Total studios" value={String(data.totalStudios)} icon="business-outline"
              hint={data.blocked > 0 ? `${data.blocked} blocked` : "All studios"} />
            <StatCard label="Active subscriptions" value={String(data.activeSubscriptions)} icon="card-outline" tone={C.good}
              hint={data.expiringIn7Days > 0 ? `${data.expiringIn7Days} end within 7 days` : "Paid and running"} />
            <StatCard label="Active trials" value={String(data.activeTrials)} icon="hourglass-outline" hint="Free trial running" />
            <StatCard label="Expired" value={String(data.expired)} icon="alert-circle-outline" tone={data.expired > 0 ? C.bad : C.accent}
              hint="Subscription or trial ended" />
            <StatCard label="Total revenue" value={money(data.totalRevenue)} icon="wallet-outline" tone={C.good}
              hint={`${money(data.rangeRevenue)} in this range`} />
            <StatCard label="Storage used" value={bytes(data.appStorageBytes)} icon="server-outline"
              hint={`Originals on studio PCs: ${bytes(data.originalStorageBytes)}`} />
          </View>

          <View style={[styles.row, !wide && styles.column]}>
            <Card title="Monthly subscription revenue" style={styles.grow2}>
              {data.revenueByMonth.every((m) => m.value === 0) ? (
                <EmptyState icon="stats-chart-outline" title="No payments in this range" />
              ) : (
                <LineChart
                  height={190}
                  color={C.accent}
                  accentColor="#9d8cf2"
                  formatValue={money}
                  points={data.revenueByMonth.map((m) => ({ label: monthLabel(m.month), value: m.value }))}
                />
              )}
            </Card>
            <Card title="Active vs expired" style={styles.grow1}>
              <View style={styles.donutRow}>
                <DonutChart
                  size={150}
                  centerLabel="Studios"
                  centerValue={String(data.totalStudios)}
                  segments={(Object.keys(STATUS_META) as AdminStudioStatus[])
                    .filter((k) => data.statusBreakdown[k] > 0)
                    .map((k) => ({ label: STATUS_META[k].label, value: data.statusBreakdown[k], color: STATUS_META[k].color }))}
                />
                <View style={{ gap: 8, flexShrink: 1 }}>
                  {(Object.keys(STATUS_META) as AdminStudioStatus[]).map((k) => (
                    <Pressable key={k} style={styles.legendRow} onPress={() => onViewStudios(k)} accessibilityRole="button">
                      <View style={[styles.legendDot, { backgroundColor: STATUS_META[k].color }]} />
                      <Text style={styles.legendLabel}>{STATUS_META[k].label}</Text>
                      <Text style={styles.legendValue}>{data.statusBreakdown[k] ?? 0}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </Card>
          </View>

          <View style={[styles.row, !wide && styles.column]}>
            <Card title="New studios" style={styles.grow1}>
              <BarChart
                data={data.newStudiosByMonth.map((m) => ({ label: monthLabel(m.month), value: m.value }))}
                format={(v) => `${v} studio${v === 1 ? "" : "s"}`}
              />
            </Card>
            <Card title="Storage consumption" style={styles.grow1}>
              {data.storageByStudio.length === 0 ? (
                <EmptyState icon="server-outline" title="No photos stored yet" />
              ) : (
                <BarList
                  items={data.storageByStudio.map((st) => ({
                    key: st.studioId,
                    name: st.studioName,
                    value: st.appBytes,
                    sub: `${st.photoCount.toLocaleString("en-IN")} photos · originals ${bytes(st.originalBytes)}`,
                  }))}
                  format={bytes}
                />
              )}
              <Text style={s.faint}>WebP previews and thumbnails the app keeps. Originals stay on each studio's own computer.</Text>
            </Card>
            <Card title="Ending soon" style={styles.grow1} action={
              <Pressable onPress={() => onViewStudios()}><Text style={styles.link}>All studios →</Text></Pressable>
            }>
              {soon.length === 0 ? (
                <EmptyState icon="checkmark-done-outline" title="Nothing ends in the next 14 days" />
              ) : (
                <View style={{ gap: 10 }}>
                  {soon.map((r) => (
                    <Pressable key={r.studioId} style={styles.soonRow} onPress={() => onOpenStudio(r.studioId)} accessibilityRole="button">
                      <View style={{ flex: 1 }}>
                        <Text style={styles.soonName} numberOfLines={1}>{r.studioName}</Text>
                        <Text style={s.faint} numberOfLines={1}>{r.planName ?? "—"}</Text>
                      </View>
                      <StatusBadge status={r.status} />
                      <DaysLeft status={r.status} days={r.daysRemaining} />
                    </Pressable>
                  ))}
                </View>
              )}
            </Card>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.page },
  content: { padding: 24, gap: 16, maxWidth: 1400, width: "100%", alignSelf: "center" },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  row: { flexDirection: "row", gap: 16, alignItems: "stretch" },
  column: { flexDirection: "column" },
  grow1: { flex: 1, minWidth: 0 },
  grow2: { flex: 2, minWidth: 0 },
  donutRow: { flexDirection: "row", alignItems: "center", gap: 18, flexWrap: "wrap" },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { color: C.muted, fontSize: 12.5, width: 70 },
  legendValue: { color: C.text, fontSize: 12.5, fontWeight: "700", fontVariant: ["tabular-nums"] },
  link: { color: C.accent, fontSize: 12, fontWeight: "700" },
  soonRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 },
  soonName: { color: C.text, fontSize: 13, fontWeight: "600" },
});
