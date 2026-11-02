import { useCallback, useMemo, useState, type ReactNode } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator, ScrollView, Platform, useWindowDimensions } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "../auth/authStore";
import { studioDashboardApi } from "../api/studioDashboardApi";
import { notificationsApi } from "../api/notificationsApi";
import { dayBoardApi } from "../api/dayBoardApi";
import { eventsApi } from "../api/eventsApi";
import { LineChart } from "../components/LineChart";
import { DonutChart } from "../components/DonutChart";
import { MiniDatePicker } from "../components/MiniDatePicker";
import { DATE_RANGE_PRESET_LABELS, type DateRangePreset } from "../types/studioDashboard";
import { useRefetchOnFocus } from "../hooks/useRefetchOnFocus";
import { localDateString } from "../utils/localDate";
import { ROUTE_MODULES, useModules } from "../hooks/useModules";

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
      <Ionicons name={isUp ? "arrow-up" : "arrow-down"} size={11} color={isUp ? "#16a36a" : "#ef4444"} />
      <Text style={[styles.delta, { color: isUp ? "#16a36a" : "#ef4444" }]}>{Math.abs(percent)}%</Text>
      <Text style={styles.deltaLabel}>{comparisonLabel(preset)}</Text>
    </View>
  );
}

function StatCard({
  icon, iconColor, label, value, percent, preset, compact,
}: { icon: keyof typeof Ionicons.glyphMap; iconColor: string; label: string; value: string | number; percent: number | null; preset: DateRangePreset; compact?: boolean }) {
  return (
    <View style={[styles.statCard, compact && styles.statCardCompact]}>
      <View style={[styles.statIcon, { backgroundColor: `${iconColor}22` }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <Text style={[styles.statValue, compact && styles.statValueCompact]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
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
  const width = useWindowDimensions().width;
  const narrow = width < 600;
  // Phones and tablets already have a bell in the top bar.
  const showBell = width >= 1024;
  // Phones and tablets: two stat cards per row, and the panels one under another at full width.
  const stacked = width < 1024;

  const [preset, setPreset] = useState<DateRangePreset>("ThisMonth");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  // The device's own day, not UTC's (which is still "yesterday" before 5:30 am in India).
  const today = useMemo(() => localDateString(), []);
  const tip = useMemo(() => TIPS[dayOfYear() % TIPS.length], []);

  const customRangeReady = customStart.length > 0 && customEnd.length > 0;
  // Modules the platform admin switched off are neither fetched nor shown.
  const isOn = useModules();
  const dashboardOn = isOn("DASHBOARD");

  const { data: unreadCount, refetch: refetchUnreadCount } = useQuery({
    queryKey: ["notifications-unread-count"],
    queryFn: notificationsApi.getUnreadCount,
    enabled: isOn("NOTIFICATIONS"),
  });

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["studio-dashboard-summary", preset, customStart, customEnd],
    queryFn: () => studioDashboardApi.getSummary(preset, customStart, customEnd),
    enabled: dashboardOn && (preset !== "Custom" || customRangeReady),
  });

  const { data: dayBoard, refetch: refetchDayBoard } = useQuery({
    queryKey: ["day-board", today],
    queryFn: () => dayBoardApi.getDayBoard(today),
    enabled: dashboardOn && isOn("DAY_BOARD"),
  });

  // The studio's own calendar day, not UTC's - just after midnight they differ.
  const localToday = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  const { data: upcoming, refetch: refetchUpcoming } = useQuery({
    queryKey: ["events-upcoming", localToday],
    queryFn: () => eventsApi.search({ upcomingFrom: localToday, page: 1, pageSize: 5 }),
    enabled: dashboardOn && isOn("EVENTS"),
  });

  const refetchAll = useCallback(() => {
    refetchUnreadCount();
    refetch();
    refetchDayBoard();
    refetchUpcoming();
  }, [refetchUnreadCount, refetch, refetchDayBoard, refetchUpcoming]);
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
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, narrow && styles.contentNarrow]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.greeting}>
            {greeting()}, <Text style={styles.greetingName}>{user?.fullName?.split(" ")[0] ?? "there"}</Text> 👋
          </Text>
          <Text style={styles.subtitle}>Here's what's happening with your studio today.</Text>
        </View>

        <View style={styles.headerRight}>
          {data && (
            <View style={styles.rangeChip}>
              <Ionicons name="calendar-outline" size={14} color="#6d4aff" />
              <Text style={styles.rangeChipText}>{formatDateRange(data.rangeStart, data.rangeEnd)}</Text>
            </View>
          )}
          {showBell && isOn("NOTIFICATIONS") && <Pressable style={styles.iconButton} onPress={() => navigation.navigate("Notifications")}>
            <Ionicons name="notifications-outline" size={18} color="#5e5f78" />
            {!!unreadCount && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
              </View>
            )}
          </Pressable>}
        </View>
      </View>

      {Platform.OS !== "web" && (
        // Native has no sidebar (that's a web-only layout for now), so it keeps this
        // in-page nav row as its only way to reach every other module.
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.nativeNavRow} contentContainerStyle={styles.nativeNavRowContent}>
          {NATIVE_NAV_ROUTES.filter((route) => isOn(ROUTE_MODULES[route] ?? "")).map((route) => (
            <Pressable key={route} style={styles.nativeNavButton} onPress={() => navigation.navigate(route)}>
              <Text style={styles.nativeNavButtonText}>{NATIVE_NAV_LABELS[route] ?? route}</Text>
            </Pressable>
          ))}
          <Pressable style={styles.nativeNavButton} onPress={() => logout()}>
            <Text style={[styles.nativeNavButtonText, { color: "#ef4444" }]}>Sign out</Text>
          </Pressable>
        </ScrollView>
      )}

      {!dashboardOn ? (
        <View style={styles.welcomeCard}>
          <Ionicons name="grid-outline" size={22} color="#6d4aff" />
          <Text style={styles.welcomeTitle}>Welcome back</Text>
          <Text style={styles.welcomeText}>Choose where to start from the menu.</Text>
        </View>
      ) : (<>
      {/* Wraps onto a second line on narrow screens, so every choice is visible without scrolling. */}
      <View style={[styles.presetRow, styles.presetRowContent, styles.presetWrap]}>
        {DASHBOARD_PRESETS.map((p) => (
          <Pressable key={p} style={[styles.presetChip, narrow && styles.presetChipNarrow, preset === p && styles.presetChipSelected]} onPress={() => setPreset(p)}
            accessibilityRole="button" accessibilityState={{ selected: preset === p }}>
            <Text style={[styles.presetChipText, preset === p && styles.presetChipTextSelected]}>{DATE_RANGE_PRESET_LABELS[p]}</Text>
          </Pressable>
        ))}
      </View>

      {preset === "Custom" && (
        <View style={styles.customRangeRow}>
          <MiniDatePicker label="From" value={customStart} onChange={setCustomStart} />
          <Ionicons name="arrow-forward" size={14} color="#8a8ba3" style={{ marginTop: 20 }} />
          <MiniDatePicker label="To" value={customEnd} onChange={setCustomEnd} />
        </View>
      )}

      {preset === "Custom" && !customRangeReady ? (
        <Text style={styles.empty}>Enter both dates above to load this range.</Text>
      ) : isPending ? (
        <ActivityIndicator color="#6d4aff" style={{ marginTop: 40 }} />
      ) : isError || !data ? (
        <Text style={styles.error}>Couldn't load the dashboard.</Text>
      ) : (
        <>
          <View style={styles.statRow}>
            {isOn("LEADS") && <StatCard icon="person-add-outline" iconColor="#6d4aff" label="Total Enquiries" value={data.totalLeads} percent={data.leadsChangePercent} preset={preset} compact={stacked} />}
            {isOn("CUSTOMERS") && <StatCard icon="people-outline" iconColor="#16a36a" label="Total Customers" value={data.totalCustomers} percent={data.customersChangePercent} preset={preset} compact={stacked} />}
            {isOn("EVENTS") && <StatCard icon="calendar-outline" iconColor="#f59e0b" label={`Events ${periodLabel(preset)}`} value={data.totalEvents} percent={data.eventsChangePercent} preset={preset} compact={stacked} />}
            {isOn("PAYMENTS") && <StatCard icon="cash-outline" iconColor="#6d4aff" label={`Revenue ${periodLabel(preset)}`} value={formatCurrency(data.collectedRevenue)} percent={data.revenueChangePercent} preset={preset} compact={stacked} />}
          </View>

          <View style={[styles.columns, stacked && styles.columnsStacked]}>
            <View style={[styles.mainColumn, stacked && styles.columnStacked]}>
              {isOn("PAYMENTS") && (
<Panel title="Overview">
                <LineChart points={revenuePoints} formatValue={formatCurrencyShort} height={narrow ? 220 : 320} />
                <View style={styles.overviewStats}>
                  <View style={styles.overviewStat}>
                    <Text style={styles.overviewStatLabel}>Revenue</Text>
                    <Text style={[styles.overviewStatValue, { color: "#16a36a" }]}>{formatCurrency(data.collectedRevenue)}</Text>
                  </View>
                  {isOn("EXPENSES") && (
<View style={styles.overviewStat}>
                    <Text style={styles.overviewStatLabel}>Expenses</Text>
                    <Text style={[styles.overviewStatValue, { color: "#ef4444" }]}>{formatCurrency(data.totalExpenses)}</Text>
                  </View>
)}
                  {isOn("EXPENSES") && (
<View style={styles.overviewStat}>
                    <Text style={styles.overviewStatLabel}>Profit</Text>
                    <Text style={[styles.overviewStatValue, { color: "#16a36a" }]}>{formatCurrency(data.cashProfit)}</Text>
                  </View>
)}
                  {isOn("EXPENSES") && (
<View style={styles.overviewStat}>
                    <Text style={styles.overviewStatLabel}>Margin</Text>
                    <Text style={styles.overviewStatValue}>
                      {data.collectedRevenue === 0 ? "—" : `${Math.round((data.cashProfit / data.collectedRevenue) * 100)}%`}
                    </Text>
                  </View>
)}
                </View>
              </Panel>
)}

              {(isOn("QUOTATIONS") || isOn("PAYMENTS") || isOn("EXPENSES")) && (
<Panel title="Financial Summary">
                <View style={styles.financeGrid}>
                  {isOn("QUOTATIONS") && (
<View style={styles.financeTile}>
                    <Text style={styles.financeLabel}>Quotation Value</Text>
                    <Text style={styles.financeValue}>{formatCurrency(data.quotationValue)}</Text>
                  </View>
)}
                  {isOn("PAYMENTS") && (
<View style={styles.financeTile}>
                    <Text style={styles.financeLabel}>Collected Revenue</Text>
                    <Text style={[styles.financeValue, { color: "#16a36a" }]}>{formatCurrency(data.collectedRevenue)}</Text>
                  </View>
)}
                  {isOn("PAYMENTS") && (
<View style={styles.financeTile}>
                    <Text style={styles.financeLabel}>Outstanding</Text>
                    <Text style={[styles.financeValue, { color: data.outstandingBalance > 0 ? "#f59e0b" : "#17172f" }]}>{formatCurrency(data.outstandingBalance)}</Text>
                  </View>
)}
                  {isOn("EXPENSES") && (
<View style={styles.financeTile}>
                    <Text style={styles.financeLabel}>Expenses</Text>
                    <Text style={[styles.financeValue, { color: "#ef4444" }]}>{formatCurrency(data.totalExpenses)}</Text>
                  </View>
)}
                  {isOn("QUOTATIONS") && isOn("EXPENSES") && (
<View style={styles.financeTile}>
                    <Text style={styles.financeLabel}>Expected Profit</Text>
                    <Text style={[styles.financeValue, { color: data.expectedProfit >= 0 ? "#16a36a" : "#ef4444" }]}>{formatCurrency(data.expectedProfit)}</Text>
                  </View>
)}
                  {isOn("PAYMENTS") && isOn("EXPENSES") && (
<View style={styles.financeTile}>
                    <Text style={styles.financeLabel}>Cash Profit</Text>
                    <Text style={[styles.financeValue, { color: data.cashProfit >= 0 ? "#16a36a" : "#ef4444" }]}>{formatCurrency(data.cashProfit)}</Text>
                  </View>
)}
                </View>
              </Panel>
)}
            </View>

            {/* Right column: events at a glance, then today's and upcoming bookings. */}
            <View style={[styles.sideColumn, stacked && styles.columnStacked]}>
              {isOn("EVENTS") && (
<Panel title="Events Summary">
                <DonutChart
                  centerLabel="Total"
                  centerValue={data.totalEvents}
                  segments={[
                    { label: "Upcoming", value: data.upcomingEvents, color: "#f59e0b" },
                    { label: "Ongoing", value: data.ongoingEvents ?? 0, color: "#6d4aff" },
                    { label: "Completed", value: data.completedEvents, color: "#16a36a" },
                    { label: "Cancelled", value: data.cancelledEvents, color: "#ef4444" },
                  ]}
                />
              </Panel>
)}
              {isOn("DAY_BOARD") && (
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
              )}

              {isOn("EVENTS") && (
              <Panel
                title="Upcoming Events"
                action={
                  <Pressable onPress={() => navigation.navigate("Events")}>
                    <Text style={styles.panelLink}>View All →</Text>
                  </Pressable>
                }
              >
                {!upcoming || upcoming.items.length === 0 ? (
                  <Text style={styles.empty}>No upcoming events.</Text>
                ) : (
                  <View style={{ gap: 12 }}>
                    {upcoming.items.map((e) => {
                      const date = new Date(e.eventDate);
                      return (
                        <Pressable
                          key={e.eventId}
                          style={styles.upcomingRow}
                          onPress={() => navigation.navigate("Events", { eventId: e.eventId })}
                          accessibilityRole="button"
                          accessibilityLabel={`${e.eventTypeName ?? "Event"} for ${e.customerName} on ${date.toDateString()}`}
                        >
                          <View style={styles.dateBadge}>
                            <Text style={styles.dateBadgeDay}>{date.getDate()}</Text>
                            <Text style={styles.dateBadgeMonth}>{date.toLocaleDateString("en-IN", { month: "short" })}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.scheduleTitle} numberOfLines={1}>{e.eventTypeName ?? "Event"} — {e.customerName}</Text>
                            <Text style={styles.scheduleSubtitle} numberOfLines={1}>
                              {daysAway(e.eventDate, localToday)}
                              {e.startTime ? ` · ${e.startTime.slice(0, 5)}` : ""}
                              {e.venue ? ` · ${e.venue}` : ""}
                            </Text>
                          </View>
                          <View style={styles.statusPill}>
                            <Text style={styles.statusPillText}>{e.eventStatus}</Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </Panel>
              )}

            </View>
          </View>

          <View style={styles.tipBanner}>
            <Ionicons name="star" size={16} color="#6d4aff" />
            <Text style={styles.tipText}><Text style={styles.tipLabel}>Tip of the day: </Text>{tip}</Text>
          </View>
        </>
      )}
      </>)}
    </ScrollView>
  );
}

// "Today", "Tomorrow", "In 5 days" - both dates are plain calendar days (yyyy-mm-dd...).
function daysAway(eventDate: string, today: string): string {
  const days = Math.round((Date.parse(eventDate.slice(0, 10)) - Date.parse(today)) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
}

function dayOfYear(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  return Math.floor((now.getTime() - start.getTime()) / 86400000);
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#ffffff" },
  content: { padding: 24, maxWidth: 1760, width: "100%", alignSelf: "center" },
  contentNarrow: { padding: 16 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18, gap: 16, flexWrap: "wrap" },
  // On a phone there isn't room for the greeting beside the date and bell, so they wrap below it.
  headerLeft: { flexGrow: 1, flexShrink: 1, flexBasis: 260 },
  greeting: { fontSize: 24, fontWeight: "700", color: "#17172f" },
  greetingName: { color: "#6d4aff" },
  subtitle: { fontSize: 13, color: "#8a8ba3", marginTop: 3 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  rangeChip: {
    flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: "#e7e9f5",
    borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: "#FFFFFF",
  },
  rangeChipText: { color: "#5e5f78", fontSize: 12, fontWeight: "600" },
  iconButton: {
    width: 36, height: 36, borderRadius: 8, borderWidth: 1, borderColor: "#e7e9f5", backgroundColor: "#FFFFFF",
    alignItems: "center", justifyContent: "center",
  },
  badge: {
    position: "absolute", top: -5, right: -5, backgroundColor: "#ef4444", borderRadius: 100,
    minWidth: 16, height: 16, paddingHorizontal: 3, alignItems: "center", justifyContent: "center",
  },
  badgeText: { color: "#ffffff", fontSize: 12, fontWeight: "700" },
  nativeNavRow: { marginBottom: 14 },
  nativeNavRowContent: { gap: 8, paddingRight: 8 },
  nativeNavButton: { borderWidth: 1, borderColor: "#e7e9f5", borderRadius: 8, paddingVertical: 9, paddingHorizontal: 14, backgroundColor: "#FFFFFF" },
  nativeNavButtonText: { color: "#5e5f78", fontSize: 12, fontWeight: "600" },
  presetRow: { marginBottom: 18 },
  presetRowContent: { gap: 8, paddingRight: 8 },
  presetWrap: { flexDirection: "row", flexWrap: "wrap" },
  presetChipNarrow: { flexGrow: 1, alignItems: "center", minHeight: 40, justifyContent: "center" },
  customRangeRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 18, flexWrap: "wrap" },
  presetChip: { borderWidth: 1, borderColor: "#e7e9f5", borderRadius: 100, paddingVertical: 7, paddingHorizontal: 14, backgroundColor: "#FFFFFF" },
  presetChipSelected: { borderColor: "#6d4aff", backgroundColor: "rgba(109,74,255,0.14)" },
  presetChipText: { color: "#5e5f78", fontSize: 12, fontWeight: "600" },
  presetChipTextSelected: { color: "#6d4aff" },
  error: { color: "#ef4444", marginTop: 40, textAlign: "center" },
  empty: { color: "#8a8ba3", fontSize: 13, paddingVertical: 8 },

  statRow: { flexDirection: "row", flexWrap: "wrap", gap: 14, marginBottom: 18 },
  statCard: {
    flexGrow: 1, minWidth: 200, backgroundColor: "#FFFFFF", borderRadius: 12, borderWidth: 1, borderColor: "#e7e9f5", padding: 18,
  },
  // Phones: two cards per row instead of one card filling the screen.
  statCardCompact: { minWidth: 0, flexBasis: "40%", padding: 14 },
  statValueCompact: { fontSize: 22 },
  statIcon: { width: 34, height: 34, borderRadius: 9, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  statValue: { fontSize: 24, fontWeight: "700", color: "#17172f", fontVariant: ["tabular-nums"] },
  statLabel: { fontSize: 12, color: "#5e5f78", marginTop: 2 },
  deltaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8 },
  delta: { fontSize: 12, fontWeight: "700" },
  deltaLabel: { fontSize: 12, color: "#8a8ba3" },
  deltaNeutral: { fontSize: 12, color: "#8a8ba3", marginTop: 8 },

  columns: { flexDirection: "row", flexWrap: "wrap", gap: 16, alignItems: "flex-start" },
  columnsStacked: { flexDirection: "column", flexWrap: "nowrap", alignItems: "stretch" },
  // In a column, flexBasis would become a height: reset it so each panel is as tall as its content.
  columnStacked: { flexBasis: "auto", flexGrow: 0 },
  mainColumn: { flexGrow: 2, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 16 },
  sideColumn: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 16 },

  panel: { backgroundColor: "#FFFFFF", borderRadius: 12, borderWidth: 1, borderColor: "#e7e9f5", padding: 18 },
  panelHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  panelTitle: { fontSize: 15, fontWeight: "700", color: "#17172f" },
  panelLink: { fontSize: 12, color: "#6d4aff", fontWeight: "600" },

  overviewStats: { flexDirection: "row", flexWrap: "wrap", gap: 16, marginTop: 16, borderTopWidth: 1, borderTopColor: "#e7e9f5", paddingTop: 16 },
  overviewStat: { minWidth: 90 },
  overviewStatLabel: { fontSize: 12, color: "#8a8ba3" },
  overviewStatValue: { fontSize: 16, fontWeight: "700", color: "#17172f", marginTop: 2 },

  financeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  financeTile: { flexGrow: 1, flexBasis: "30%", minWidth: 130, backgroundColor: "#ffffff", borderRadius: 8, padding: 12 },
  financeLabel: { fontSize: 12, color: "#8a8ba3" },
  financeValue: { fontSize: 15, fontWeight: "700", color: "#17172f", marginTop: 3, fontVariant: ["tabular-nums"] },


  scheduleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  scheduleTime: { color: "#6d4aff", fontSize: 12, fontWeight: "700", width: 44 },
  scheduleTitle: { color: "#17172f", fontSize: 13, fontWeight: "600" },
  scheduleSubtitle: { color: "#8a8ba3", fontSize: 12, marginTop: 1 },
  upcomingRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  dateBadge: {
    width: 40, alignItems: "center", paddingVertical: 4, borderRadius: 8,
    backgroundColor: "rgba(109,74,255,0.1)", borderWidth: 1, borderColor: "#e7e9f5",
  },
  dateBadgeDay: { color: "#17172f", fontSize: 14, fontWeight: "700", lineHeight: 16 },
  dateBadgeMonth: { color: "#6d4aff", fontSize: 12, fontWeight: "600", textTransform: "uppercase" },
  statusPill: { borderWidth: 1, borderColor: "#e7e9f5", borderRadius: 100, paddingVertical: 3, paddingHorizontal: 8 },
  statusPillText: { color: "#6d4aff", fontSize: 12, fontWeight: "700" },


  welcomeCard: {
    alignItems: "center", gap: 6, paddingVertical: 40, paddingHorizontal: 20, borderRadius: 12,
    borderWidth: 1, borderColor: "#e7e9f5", backgroundColor: "#ffffff",
  },
  welcomeTitle: { color: "#17172f", fontSize: 17, fontWeight: "700" },
  welcomeText: { color: "#8a8ba3", fontSize: 13 },
  tipBanner: {
    flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#FFFFFF", borderWidth: 1,
    borderColor: "#e7e9f5", borderRadius: 12, padding: 16, marginTop: 16,
  },
  tipText: { color: "#5e5f78", fontSize: 13, flex: 1 },
  tipLabel: { color: "#17172f", fontWeight: "700" },
});
