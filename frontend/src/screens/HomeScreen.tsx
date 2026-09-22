import { useCallback, useMemo, useState, type ReactNode } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator, ScrollView, Platform } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "../auth/authStore";
import { studioDashboardApi } from "../api/studioDashboardApi";
import { notificationsApi } from "../api/notificationsApi";
import { dayBoardApi } from "../api/dayBoardApi";
import { leadsApi } from "../api/leadsApi";
import { LineChart } from "../components/LineChart";
import { DonutChart } from "../components/DonutChart";
import { MiniDatePicker } from "../components/MiniDatePicker";
import { DATE_RANGE_PRESET_LABELS, type DateRangePreset } from "../types/studioDashboard";
import { useRefetchOnFocus } from "../hooks/useRefetchOnFocus";

// The full DATE_RANGE_PRESETS list is shared with Reports, which still shows every preset —
// the Dashboard's chip row only surfaces the longer-range ones plus a manual custom range.
const DASHBOARD_PRESETS: DateRangePreset[] = ["ThisMonth", "PreviousMonth", "ThisYear", "PreviousYear", "Custom"];

const NATIVE_NAV_ROUTES = [
  "Calendar", "Leads", "Customers", "Events", "PhotoSelection", "Workers", "Services", "Quotations",
  "Payments", "Expenses", "Reports", "DayBoard", "Notifications", "Settings",
] as const;

const NATIVE_NAV_LABELS: Partial<Record<(typeof NATIVE_NAV_ROUTES)[number], string>> = {
  DayBoard: "Day Board",
  PhotoSelection: "Photo Selection",
};

const TIPS = [
  "Keep your customer details updated for better communication and personalized service.",
  "Send quotations within 24 hours of an enquiry to improve conversion.",
  "Assign workers on the Day Board a day ahead so nobody finds out about a shoot last minute.",
  "Mark payments as soon as they land — outstanding balances stay accurate for every report.",
  "Review your top services each month to see what your studio should be pitching more.",
];

function formatCurrency(value: number): string {
  return `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatCurrencyShort(value: number): string {
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(0)}K`;
  return `₹${value}`;
}

function formatDateRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(new Date(end).getTime() - 86400000);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${s.toLocaleDateString("en-US", opts)} – ${e.toLocaleDateString("en-US", { ...opts, year: "numeric" })}`;
}

function timeAgo(value: string): string {
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

// The backend compares against the immediately preceding range of equal length — name that
// range precisely where it has a natural name, and fall back to "previous period" otherwise
// (e.g. PreviousMonth's comparison range is "the month before last", which has no clean name).
function comparisonLabel(preset: DateRangePreset): string {
  switch (preset) {
    case "ThisMonth":
      return "vs last month";
    case "ThisYear":
      return "vs last year";
    default:
      return "vs last period";
  }
}

// Names the selected range itself (not what it's compared against) — used in stat card titles
// like "Events This Month" / "Revenue This Year" instead of a generic "This Period".
function periodLabel(preset: DateRangePreset): string {
  switch (preset) {
    case "ThisMonth":
      return "This Month";
    case "PreviousMonth":
      return "Last Month";
    case "ThisYear":
      return "This Year";
    case "PreviousYear":
      return "Last Year";
    default:
      return "This Period";
  }
}

function Delta({ percent, preset }: { percent: number | null; preset: DateRangePreset }) {
  if (percent === null) {
    return <Text style={styles.deltaNeutral}>No comparison yet</Text>;
  }
  const isUp = percent >= 0;
  return (
    <View style={styles.deltaRow}>
      <Ionicons name={isUp ? "arrow-up" : "arrow-down"} size={11} color={isUp ? "#4cc493" : "#ff7a72"} />
      <Text style={[styles.delta, { color: isUp ? "#4cc493" : "#ff7a72" }]}>{Math.abs(percent)}%</Text>
      <Text style={styles.deltaLabel}>{comparisonLabel(preset)}</Text>
    </View>
  );
}

function StatCard({
  icon, iconColor, label, value, percent, preset,
}: { icon: keyof typeof Ionicons.glyphMap; iconColor: string; label: string; value: string | number; percent: number | null; preset: DateRangePreset }) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: `${iconColor}22` }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      <Delta percent={percent} preset={preset} />
    </View>
  );
}

function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <View style={styles.panel}>
      <View style={styles.panelHeader}>
        <Text style={styles.panelTitle}>{title}</Text>
        {action}
      </View>
      {children}
    </View>
  );
}

export function HomeScreen() {
  const navigation = useNavigation<any>();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const [preset, setPreset] = useState<DateRangePreset>("ThisMonth");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const tip = useMemo(() => TIPS[dayOfYear() % TIPS.length], []);

  const customRangeReady = customStart.length > 0 && customEnd.length > 0;

  const { data: unreadCount, refetch: refetchUnreadCount } = useQuery({
    queryKey: ["notifications-unread-count"],
    queryFn: notificationsApi.getUnreadCount,
  });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["studio-dashboard-summary", preset, customStart, customEnd],
    queryFn: () => studioDashboardApi.getSummary(preset, customStart, customEnd),
    enabled: preset !== "Custom" || customRangeReady,
  });

  const { data: dayBoard, refetch: refetchDayBoard } = useQuery({
    queryKey: ["day-board", today],
    queryFn: () => dayBoardApi.getDayBoard(today),
  });

  const { data: recentLeads, refetch: refetchRecentLeads } = useQuery({
    queryKey: ["leads-recent"],
    queryFn: () => leadsApi.search({ page: 1, pageSize: 4 }),
  });

  const refetchAll = useCallback(() => {
    refetchUnreadCount();
    refetch();
    refetchDayBoard();
    refetchRecentLeads();
  }, [refetchUnreadCount, refetch, refetchDayBoard, refetchRecentLeads]);
  useRefetchOnFocus(refetchAll);

  const revenuePoints = (data?.revenueTrend ?? []).map((p) => ({
    label: new Date(p.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    value: p.amount,
    // Hover tooltip: the date, the day's full total, and what each event contributed.
    detail: {
      title: new Date(p.date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" }),
      total: formatCurrency(p.amount),
      items: (p.events ?? []).map((e) => ({
        name: e.eventName,
        // Customer and venue tell apart two events of the same type on the same day.
        sub: e.venue ? `${e.customerName} · ${e.venue}` : e.customerName,
        value: formatCurrency(e.amount),
      })),
    },
  }));

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>
            {greeting()}, <Text style={styles.greetingName}>{user?.fullName?.split(" ")[0] ?? "there"}</Text> 👋
          </Text>
          <Text style={styles.subtitle}>Here's what's happening with your studio today.</Text>
        </View>

        <View style={styles.headerRight}>
          {data && (
            <View style={styles.rangeChip}>
              <Ionicons name="calendar-outline" size={14} color="#7fc0e6" />
              <Text style={styles.rangeChipText}>{formatDateRange(data.rangeStart, data.rangeEnd)}</Text>
            </View>
          )}
          <Pressable style={styles.iconButton} onPress={() => navigation.navigate("Notifications")}>
            <Ionicons name="notifications-outline" size={18} color="#a7b7cb" />
            {!!unreadCount && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      {Platform.OS !== "web" && (
        // Native has no sidebar (that's a web-only layout for now), so it keeps this
        // in-page nav row as its only way to reach every other module.
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.nativeNavRow} contentContainerStyle={styles.nativeNavRowContent}>
          {NATIVE_NAV_ROUTES.map((route) => (
            <Pressable key={route} style={styles.nativeNavButton} onPress={() => navigation.navigate(route)}>
              <Text style={styles.nativeNavButtonText}>{NATIVE_NAV_LABELS[route] ?? route}</Text>
            </Pressable>
          ))}
          <Pressable style={styles.nativeNavButton} onPress={() => logout()}>
            <Text style={[styles.nativeNavButtonText, { color: "#ff7a72" }]}>Sign out</Text>
          </Pressable>
        </ScrollView>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetRow} contentContainerStyle={styles.presetRowContent}>
        {DASHBOARD_PRESETS.map((p) => (
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
      ) : isLoading ? (
        <ActivityIndicator color="#7fc0e6" style={{ marginTop: 40 }} />
      ) : isError || !data ? (
        <Text style={styles.error}>Couldn't load the dashboard.</Text>
      ) : (
        <>
          <View style={styles.statRow}>
            <StatCard icon="person-add-outline" iconColor="#7fc0e6" label="Total Enquiries" value={data.totalLeads} percent={data.leadsChangePercent} preset={preset} />
            <StatCard icon="people-outline" iconColor="#4cc493" label="Total Customers" value={data.totalCustomers} percent={data.customersChangePercent} preset={preset} />
            <StatCard icon="calendar-outline" iconColor="#f2bd5c" label={`Events ${periodLabel(preset)}`} value={data.totalEvents} percent={data.eventsChangePercent} preset={preset} />
            <StatCard icon="cash-outline" iconColor="#ff9a4d" label={`Revenue ${periodLabel(preset)}`} value={formatCurrency(data.collectedRevenue)} percent={data.revenueChangePercent} preset={preset} />
          </View>

          <View style={styles.columns}>
            <View style={styles.mainColumn}>
              <Panel title="Overview">
                <LineChart points={revenuePoints} formatValue={formatCurrencyShort} />
                <View style={styles.overviewStats}>
                  <View style={styles.overviewStat}>
                    <Text style={styles.overviewStatLabel}>Revenue</Text>
                    <Text style={[styles.overviewStatValue, { color: "#4cc493" }]}>{formatCurrency(data.collectedRevenue)}</Text>
                  </View>
                  <View style={styles.overviewStat}>
                    <Text style={styles.overviewStatLabel}>Expenses</Text>
                    <Text style={[styles.overviewStatValue, { color: "#ff7a72" }]}>{formatCurrency(data.totalExpenses)}</Text>
                  </View>
                  <View style={styles.overviewStat}>
                    <Text style={styles.overviewStatLabel}>Profit</Text>
                    <Text style={[styles.overviewStatValue, { color: "#4cc493" }]}>{formatCurrency(data.cashProfit)}</Text>
                  </View>
                  <View style={styles.overviewStat}>
                    <Text style={styles.overviewStatLabel}>Margin</Text>
                    <Text style={styles.overviewStatValue}>
                      {data.collectedRevenue === 0 ? "—" : `${Math.round((data.cashProfit / data.collectedRevenue) * 100)}%`}
                    </Text>
                  </View>
                </View>
              </Panel>

              <Panel title="Financial Summary">
                <View style={styles.financeGrid}>
                  <View style={styles.financeTile}>
                    <Text style={styles.financeLabel}>Quotation Value</Text>
                    <Text style={styles.financeValue}>{formatCurrency(data.quotationValue)}</Text>
                  </View>
                  <View style={styles.financeTile}>
                    <Text style={styles.financeLabel}>Collected Revenue</Text>
                    <Text style={[styles.financeValue, { color: "#4cc493" }]}>{formatCurrency(data.collectedRevenue)}</Text>
                  </View>
                  <View style={styles.financeTile}>
                    <Text style={styles.financeLabel}>Outstanding</Text>
                    <Text style={[styles.financeValue, { color: data.outstandingBalance > 0 ? "#f2bd5c" : "#e8edf3" }]}>{formatCurrency(data.outstandingBalance)}</Text>
                  </View>
                  <View style={styles.financeTile}>
                    <Text style={styles.financeLabel}>Expenses</Text>
                    <Text style={[styles.financeValue, { color: "#ff7a72" }]}>{formatCurrency(data.totalExpenses)}</Text>
                  </View>
                  <View style={styles.financeTile}>
                    <Text style={styles.financeLabel}>Expected Profit</Text>
                    <Text style={[styles.financeValue, { color: data.expectedProfit >= 0 ? "#4cc493" : "#ff7a72" }]}>{formatCurrency(data.expectedProfit)}</Text>
                  </View>
                  <View style={styles.financeTile}>
                    <Text style={styles.financeLabel}>Cash Profit</Text>
                    <Text style={[styles.financeValue, { color: data.cashProfit >= 0 ? "#4cc493" : "#ff7a72" }]}>{formatCurrency(data.cashProfit)}</Text>
                  </View>
                </View>
              </Panel>
            </View>

            <View style={styles.sideColumn}>
              <Panel title="Events Summary">
                <DonutChart
                  centerLabel="Total"
                  centerValue={data.totalEvents}
                  segments={[
                    { label: "Upcoming", value: data.upcomingEvents, color: "#f2bd5c" },
                    { label: "Completed", value: data.completedEvents, color: "#4cc493" },
                    { label: "Cancelled", value: data.cancelledEvents, color: "#ff7a72" },
                  ]}
                />
              </Panel>

              <Panel title="Top Services">
                {data.topServices.length === 0 ? (
                  <Text style={styles.empty}>No quotations in this period yet.</Text>
                ) : (
                  <View style={{ gap: 14 }}>
                    {data.topServices.map((s) => (
                      <View key={s.serviceName}>
                        <View style={styles.topServiceRow}>
                          <Text style={styles.topServiceName} numberOfLines={1}>{s.serviceName}</Text>
                          <Text style={styles.topServiceMeta}>{s.usageCount} ({s.percentage}%)</Text>
                        </View>
                        <View style={styles.progressTrack}>
                          <View style={[styles.progressFill, { width: `${s.percentage}%` }]} />
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </Panel>
            </View>

            <View style={styles.sideColumn}>
              <Panel
                title="Today's Schedule"
                action={
                  <Pressable onPress={() => navigation.navigate("DayBoard")}>
                    <Text style={styles.panelLink}>View Full Day Board →</Text>
                  </Pressable>
                }
              >
                {!dayBoard || dayBoard.events.length === 0 ? (
                  <Text style={styles.empty}>Nothing scheduled for today.</Text>
                ) : (
                  <View style={{ gap: 12 }}>
                    {dayBoard.events.map((e) => (
                      <View key={e.eventId} style={styles.scheduleRow}>
                        <Text style={styles.scheduleTime}>{e.startTime ? e.startTime.slice(0, 5) : "—"}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.scheduleTitle} numberOfLines={1}>{e.eventTypeName ?? "Event"} — {e.customerName}</Text>
                          <Text style={styles.scheduleSubtitle} numberOfLines={1}>{e.venue ?? "No venue set"}</Text>
                        </View>
                        <View style={styles.statusPill}>
                          <Text style={styles.statusPillText}>{e.eventStatus}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </Panel>

              <Panel
                title="Recent Enquiries"
                action={
                  <Pressable onPress={() => navigation.navigate("Leads")}>
                    <Text style={styles.panelLink}>View All →</Text>
                  </Pressable>
                }
              >
                {!recentLeads || recentLeads.items.length === 0 ? (
                  <Text style={styles.empty}>No enquiries yet.</Text>
                ) : (
                  <View style={{ gap: 12 }}>
                    {recentLeads.items.map((lead) => (
                      <View key={lead.leadId} style={styles.leadRow}>
                        <View style={styles.leadAvatar}>
                          <Text style={styles.leadAvatarText}>{lead.fullName.charAt(0).toUpperCase()}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.leadName} numberOfLines={1}>{lead.fullName}</Text>
                          <Text style={styles.leadSubtitle} numberOfLines={1}>{lead.eventTypeName ?? "General enquiry"}</Text>
                        </View>
                        <Text style={styles.leadTime}>{timeAgo(lead.createdAt)}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </Panel>
            </View>
          </View>

          <View style={styles.tipBanner}>
            <Ionicons name="star" size={16} color="#7fc0e6" />
            <Text style={styles.tipText}><Text style={styles.tipLabel}>Tip of the day: </Text>{tip}</Text>
          </View>
        </>
      )}
    </ScrollView>
  );
}

function dayOfYear(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  return Math.floor((now.getTime() - start.getTime()) / 86400000);
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0d1826" },
  content: { padding: 28, maxWidth: 1400, width: "100%", alignSelf: "center" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18, gap: 16 },
  greeting: { fontSize: 24, fontWeight: "700", color: "#e8edf3" },
  greetingName: { color: "#7fc0e6" },
  subtitle: { fontSize: 13, color: "#6f83a0", marginTop: 3 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  rangeChip: {
    flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: "#23405c",
    borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: "#132540",
  },
  rangeChipText: { color: "#a7b7cb", fontSize: 12, fontWeight: "600" },
  iconButton: {
    width: 36, height: 36, borderRadius: 8, borderWidth: 1, borderColor: "#23405c", backgroundColor: "#132540",
    alignItems: "center", justifyContent: "center",
  },
  badge: {
    position: "absolute", top: -5, right: -5, backgroundColor: "#ff7a72", borderRadius: 100,
    minWidth: 16, height: 16, paddingHorizontal: 3, alignItems: "center", justifyContent: "center",
  },
  badgeText: { color: "#0d1826", fontSize: 9, fontWeight: "700" },
  nativeNavRow: { marginBottom: 14 },
  nativeNavRowContent: { gap: 8, paddingRight: 8 },
  nativeNavButton: { borderWidth: 1, borderColor: "#23405c", borderRadius: 8, paddingVertical: 9, paddingHorizontal: 14, backgroundColor: "#132540" },
  nativeNavButtonText: { color: "#a7b7cb", fontSize: 12, fontWeight: "600" },
  presetRow: { marginBottom: 18 },
  presetRowContent: { gap: 8, paddingRight: 8 },
  customRangeRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 18, flexWrap: "wrap" },
  presetChip: { borderWidth: 1, borderColor: "#23405c", borderRadius: 100, paddingVertical: 7, paddingHorizontal: 14, backgroundColor: "#132540" },
  presetChipSelected: { borderColor: "#7fc0e6", backgroundColor: "rgba(127, 192, 230, 0.14)" },
  presetChipText: { color: "#a7b7cb", fontSize: 12, fontWeight: "600" },
  presetChipTextSelected: { color: "#7fc0e6" },
  error: { color: "#ff7a72", marginTop: 40, textAlign: "center" },
  empty: { color: "#6f83a0", fontSize: 13, paddingVertical: 8 },

  statRow: { flexDirection: "row", flexWrap: "wrap", gap: 14, marginBottom: 18 },
  statCard: {
    flexGrow: 1, minWidth: 200, backgroundColor: "#132540", borderRadius: 12, borderWidth: 1, borderColor: "#23405c", padding: 18,
  },
  statIcon: { width: 34, height: 34, borderRadius: 9, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  statValue: { fontSize: 24, fontWeight: "700", color: "#e8edf3", fontVariant: ["tabular-nums"] },
  statLabel: { fontSize: 12, color: "#a7b7cb", marginTop: 2 },
  deltaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8 },
  delta: { fontSize: 12, fontWeight: "700" },
  deltaLabel: { fontSize: 11, color: "#6f83a0" },
  deltaNeutral: { fontSize: 11, color: "#6f83a0", marginTop: 8 },

  columns: { flexDirection: "row", flexWrap: "wrap", gap: 16, alignItems: "flex-start" },
  mainColumn: { flexGrow: 2, flexBasis: 420, gap: 16 },
  sideColumn: { flexGrow: 1, flexBasis: 300, gap: 16 },

  panel: { backgroundColor: "#132540", borderRadius: 12, borderWidth: 1, borderColor: "#23405c", padding: 18 },
  panelHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  panelTitle: { fontSize: 15, fontWeight: "700", color: "#e8edf3" },
  panelLink: { fontSize: 12, color: "#7fc0e6", fontWeight: "600" },

  overviewStats: { flexDirection: "row", flexWrap: "wrap", gap: 16, marginTop: 16, borderTopWidth: 1, borderTopColor: "#1b2c42", paddingTop: 16 },
  overviewStat: { minWidth: 90 },
  overviewStatLabel: { fontSize: 11, color: "#6f83a0" },
  overviewStatValue: { fontSize: 16, fontWeight: "700", color: "#e8edf3", marginTop: 2 },

  financeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  financeTile: { flexGrow: 1, minWidth: 130, backgroundColor: "#0f1e30", borderRadius: 8, padding: 12 },
  financeLabel: { fontSize: 11, color: "#6f83a0" },
  financeValue: { fontSize: 15, fontWeight: "700", color: "#e8edf3", marginTop: 3, fontVariant: ["tabular-nums"] },

  topServiceRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  topServiceName: { color: "#e8edf3", fontSize: 13, fontWeight: "600", flex: 1, marginRight: 8 },
  topServiceMeta: { color: "#a7b7cb", fontSize: 12 },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: "#0f1e30", overflow: "hidden" },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: "#7fc0e6" },

  scheduleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  scheduleTime: { color: "#7fc0e6", fontSize: 12, fontWeight: "700", width: 44 },
  scheduleTitle: { color: "#e8edf3", fontSize: 13, fontWeight: "600" },
  scheduleSubtitle: { color: "#6f83a0", fontSize: 11, marginTop: 1 },
  statusPill: { borderWidth: 1, borderColor: "#23405c", borderRadius: 100, paddingVertical: 3, paddingHorizontal: 8 },
  statusPillText: { color: "#7fc0e6", fontSize: 10, fontWeight: "700" },

  leadRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  leadAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: "#23405c", alignItems: "center", justifyContent: "center" },
  leadAvatarText: { color: "#e8edf3", fontWeight: "700", fontSize: 12 },
  leadName: { color: "#e8edf3", fontSize: 13, fontWeight: "600" },
  leadSubtitle: { color: "#6f83a0", fontSize: 11, marginTop: 1 },
  leadTime: { color: "#6f83a0", fontSize: 11 },

  tipBanner: {
    flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#132540", borderWidth: 1,
    borderColor: "#23405c", borderRadius: 12, padding: 16, marginTop: 16,
  },
  tipText: { color: "#a7b7cb", fontSize: 13, flex: 1 },
  tipLabel: { color: "#e8edf3", fontWeight: "700" },
});
