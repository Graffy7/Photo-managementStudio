import { useCallback, useMemo, useState, type ReactNode } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, Platform } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "../auth/authStore";
import { studioDashboardApi } from "../api/studioDashboardApi";
import { notificationsApi } from "../api/notificationsApi";
import { dayBoardApi } from "../api/dayBoardApi";
import { leadsApi } from "../api/leadsApi";
import { eventsApi } from "../api/eventsApi";
import { LineChart } from "../components/LineChart";
import { DonutChart } from "../components/DonutChart";
import { MiniDatePicker } from "../components/MiniDatePicker";
import { DATE_RANGE_PRESET_LABELS, type DateRangePreset } from "../types/studioDashboard";
import { useRefetchOnFocus } from "../hooks/useRefetchOnFocus";
import { ROUTE_MODULES, useModules } from "../hooks/useModules";
import { StatusPill, eventStatusTone } from "../components/StatusPill";
import { Button } from "../ui/Button";
import { Skeleton } from "../ui/Skeleton";
import { useBreakpoint } from "../ui/useBreakpoint";
import { colors, radius, space, touch, type } from "../ui/theme";

// The full DATE_RANGE_PRESETS list is shared with Reports, which still shows every preset —
// the Dashboard's chip row only surfaces the longer-range ones plus a manual custom range.
const DASHBOARD_PRESETS: DateRangePreset[] = ["ThisMonth", "PreviousMonth", "ThisYear", "PreviousYear", "Custom"];

const NATIVE_NAV_ROUTES = [
  "Calendar", "Leads", "Customers", "Events", "PhotoSelection", "Workers", "Services", "Quotations",
  "Payments", "Expenses", "Reports", "DayBoard", "Notifications", "Settings",
] as const;

const NATIVE_NAV_LABELS: Partial<Record<(typeof NATIVE_NAV_ROUTES)[number], string>> = {
  DayBoard: "Day Board",
  PhotoSelection: "Photo Delivery",
};

function formatCurrency(value: number): string {
  const amount = Math.abs(value).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return `${value < 0 ? "-" : ""}₹${amount}`;
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

function StatTile({ icon, label, value, hint, onPress }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string | number | null;
  hint?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={`${label}: ${value ?? "loading"}`}
    >
      <View style={styles.tileTop}>
        <Ionicons name={icon} size={18} color={colors.textMuted} />
        <Text style={styles.tileLabel} numberOfLines={1}>{label}</Text>
      </View>
      {value === null ? <Skeleton width="60%" height={26} style={{ marginTop: 6 }} /> : (
        <Text style={styles.tileValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      )}
      <Text style={styles.tileHint} numberOfLines={1}>{hint ?? " "}</Text>
    </Pressable>
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

function RowsSkeleton({ rows }: { rows: number }) {
  return (
    <View style={{ gap: space.md }}>
      {Array.from({ length: rows }).map((_, i) => <Skeleton key={i} height={44} />)}
    </View>
  );
}

export function HomeScreen() {
  const navigation = useNavigation<any>();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { isPhone, isDesktop } = useBreakpoint();

  const [preset, setPreset] = useState<DateRangePreset>("ThisMonth");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const customRangeReady = customStart.length > 0 && customEnd.length > 0;
  // Modules the platform admin switched off are neither fetched nor shown.
  const isOn = useModules();
  const dashboardOn = isOn("DASHBOARD");

  const { data: unreadCount, refetch: refetchUnreadCount } = useQuery({
    queryKey: ["notifications-unread-count"],
    queryFn: notificationsApi.getUnreadCount,
    enabled: isOn("NOTIFICATIONS"),
  });

  // The key figures always describe this month; the overview further down follows the period chips.
  const { data: month, refetch: refetchMonth } = useQuery({
    queryKey: ["studio-dashboard-summary", "ThisMonth", "", ""],
    queryFn: () => studioDashboardApi.getSummary("ThisMonth"),
    enabled: dashboardOn,
  });

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["studio-dashboard-summary", preset, customStart, customEnd],
    queryFn: () => studioDashboardApi.getSummary(preset, customStart, customEnd),
    enabled: dashboardOn && (preset !== "Custom" || customRangeReady),
  });

  const { data: dayBoard, isPending: dayBoardPending, refetch: refetchDayBoard } = useQuery({
    queryKey: ["day-board", today],
    queryFn: () => dayBoardApi.getDayBoard(today),
    enabled: dashboardOn && isOn("DAY_BOARD"),
  });

  // The studio's own calendar day, not UTC's - just after midnight they differ.
  const localToday = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  const { data: upcoming, isPending: upcomingPending, refetch: refetchUpcoming } = useQuery({
    queryKey: ["events-upcoming", localToday],
    queryFn: () => eventsApi.search({ upcomingFrom: localToday, page: 1, pageSize: 5 }),
    enabled: dashboardOn && isOn("EVENTS"),
  });

  const { data: recentLeads, isPending: leadsPending, refetch: refetchRecentLeads } = useQuery({
    queryKey: ["leads-recent"],
    queryFn: () => leadsApi.search({ page: 1, pageSize: 4 }),
    enabled: dashboardOn && isOn("LEADS"),
  });

  const refetchAll = useCallback(() => {
    refetchUnreadCount();
    refetchMonth();
    refetch();
    refetchDayBoard();
    refetchUpcoming();
    refetchRecentLeads();
  }, [refetchUnreadCount, refetchMonth, refetch, refetchDayBoard, refetchUpcoming, refetchRecentLeads]);
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

  // Layout: tiles 2 per row on phones, 4 on wider screens; lists side by side from desktop width.
  const pad = isPhone ? space.lg : space.xl;
  const tileColumns = isPhone ? 2 : 4;
  const todayLabel = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });

  const tiles = [
    isOn("EVENTS") && { key: "upcoming", icon: "calendar-outline" as const, label: "Upcoming events", value: upcoming ? upcoming.totalCount : null, hint: "from today", route: "Events" },
    isOn("PAYMENTS") && { key: "pending", icon: "wallet-outline" as const, label: "Pending payments", value: month ? formatCurrency(month.outstandingBalance) : null, hint: "still to collect", route: "Payments" },
    isOn("LEADS") && { key: "leads", icon: "person-add-outline" as const, label: "New enquiries", value: month ? month.totalLeads : null, hint: "this month", route: "Leads" },
    isOn("CUSTOMERS") && { key: "customers", icon: "people-outline" as const, label: "Customers", value: month ? month.totalCustomers : null, hint: "this month", route: "Customers" },
  ].filter(Boolean) as { key: string; icon: keyof typeof Ionicons.glyphMap; label: string; value: string | number | null; hint: string; route: string }[];

  const todayPanel = isOn("DAY_BOARD") && (
    <Panel
      title={dayBoard && dayBoard.events.length > 0 ? `Today · ${dayBoard.events.length} event${dayBoard.events.length === 1 ? "" : "s"}` : "Today"}
      action={<Button label="Day board" variant="link" onPress={() => navigation.navigate("DayBoard")} />}
    >
      {dayBoardPending ? <RowsSkeleton rows={2} /> : !dayBoard || dayBoard.events.length === 0 ? (
        <View style={styles.emptyRow}>
          <Ionicons name="sunny-outline" size={20} color={colors.textFaint} />
          <Text style={styles.empty}>No events today.</Text>
          {isOn("EVENTS") && <Button label="New event" icon="add" variant="link" onPress={() => navigation.navigate("Events", { create: true })} />}
        </View>
      ) : (
        <View style={styles.rows}>
          {dayBoard.events.map((e) => (
            <Pressable key={e.eventId} style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              onPress={() => navigation.navigate("Events", { eventId: e.eventId })} accessibilityRole="button">
              <Text style={styles.time}>{e.startTime ? e.startTime.slice(0, 5) : "All day"}</Text>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.rowTitle} numberOfLines={1}>{e.customerName}</Text>
                <Text style={styles.rowSub} numberOfLines={1}>{e.eventTypeName ?? "Event"}{e.venue ? ` · ${e.venue}` : ""}</Text>
              </View>
              <StatusPill label={e.eventStatus} tone={eventStatusTone(e.eventStatus)} />
            </Pressable>
          ))}
        </View>
      )}
    </Panel>
  );

  const upcomingPanel = isOn("EVENTS") && (
    <Panel title="Upcoming events" action={<Button label="All events" variant="link" onPress={() => navigation.navigate("Events")} />}>
      {upcomingPending ? <RowsSkeleton rows={3} /> : !upcoming || upcoming.items.length === 0 ? (
        <View style={styles.emptyRow}>
          <Text style={styles.empty}>No upcoming events.</Text>
          <Button label="New event" icon="add" variant="link" onPress={() => navigation.navigate("Events", { create: true })} />
        </View>
      ) : (
        <View style={styles.rows}>
          {upcoming.items.map((e) => {
            const date = new Date(e.eventDate);
            return (
              <Pressable
                key={e.eventId}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                onPress={() => navigation.navigate("Events", { eventId: e.eventId })}
                accessibilityRole="button"
                accessibilityLabel={`${e.eventTypeName ?? "Event"} for ${e.customerName} on ${date.toDateString()}`}
              >
                <View style={styles.dateBadge}>
                  <Text style={styles.dateDay}>{date.getDate()}</Text>
                  <Text style={styles.dateMonth}>{date.toLocaleDateString("en-IN", { month: "short" })}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.rowTitle} numberOfLines={1}>{e.customerName}</Text>
                  <Text style={styles.rowSub} numberOfLines={1}>
                    {e.eventTypeName ?? "Event"} · {daysAway(e.eventDate, localToday)}{e.startTime ? ` · ${e.startTime.slice(0, 5)}` : ""}
                  </Text>
                </View>
                {!isPhone && <StatusPill label={e.eventStatus} tone={eventStatusTone(e.eventStatus)} />}
              </Pressable>
            );
          })}
        </View>
      )}
    </Panel>
  );

  const leadsPanel = isOn("LEADS") && (
    <Panel title="New enquiries" action={<Button label="All enquiries" variant="link" onPress={() => navigation.navigate("Leads")} />}>
      {leadsPending ? <RowsSkeleton rows={3} /> : !recentLeads || recentLeads.items.length === 0 ? (
        <Text style={styles.empty}>No enquiries yet.</Text>
      ) : (
        <View style={styles.rows}>
          {recentLeads.items.map((lead) => (
            <Pressable key={lead.leadId} style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              onPress={() => navigation.navigate("Leads")} accessibilityRole="button">
              <View style={styles.avatar}><Text style={styles.avatarText}>{lead.fullName.charAt(0).toUpperCase()}</Text></View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.rowTitle} numberOfLines={1}>{lead.fullName}</Text>
                <Text style={styles.rowSub} numberOfLines={1}>{lead.eventTypeName ?? "General enquiry"}</Text>
              </View>
              <Text style={styles.rowMeta}>{timeAgo(lead.createdAt)}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </Panel>
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { padding: pad }]}>
      <View style={styles.header}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.greeting} numberOfLines={1}>{greeting()}, {user?.fullName?.split(" ")[0] ?? "there"}</Text>
          <Text style={styles.subtitle}>{todayLabel}</Text>
        </View>
        {/* On phones and tablets the bell lives in the top bar. */}
        {isDesktop && isOn("NOTIFICATIONS") && (
          <Pressable style={styles.bell} onPress={() => navigation.navigate("Notifications")} accessibilityRole="button" accessibilityLabel="Notifications">
            <Ionicons name="notifications-outline" size={20} color={colors.textMuted} />
            {!!unreadCount && (
              <View style={styles.badge}><Text style={styles.badgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text></View>
            )}
          </Pressable>
        )}
      </View>

      {Platform.OS !== "web" && (
        // Native has no web shell, so it keeps this in-page row as its way to reach every module.
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: space.lg }} contentContainerStyle={{ gap: space.sm }}>
          {NATIVE_NAV_ROUTES.filter((route) => isOn(ROUTE_MODULES[route] ?? "")).map((route) => (
            <Button key={route} label={NATIVE_NAV_LABELS[route] ?? route} onPress={() => navigation.navigate(route)} />
          ))}
          <Button label="Sign out" variant="danger" onPress={() => logout()} />
        </ScrollView>
      )}

      {!dashboardOn ? (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Welcome back</Text>
          <Text style={styles.empty}>Choose where to start from the menu.</Text>
        </View>
      ) : (
        <View style={{ gap: space.lg }}>
          {todayPanel}

          {tiles.length > 0 && (
            // Fixed rows of equal-width tiles (empty slots keep the last row's tiles the same size).
            <View style={{ gap: space.md }}>
              {Array.from({ length: Math.ceil(tiles.length / tileColumns) }).map((_, r) => (
                <View key={r} style={styles.tileRow}>
                  {Array.from({ length: tileColumns }).map((__, c) => {
                    const t = tiles[r * tileColumns + c];
                    return (
                      <View key={c} style={styles.tileSlot}>
                        {t && <StatTile icon={t.icon} label={t.label} value={t.value} hint={t.hint} onPress={() => navigation.navigate(t.route)} />}
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>
          )}

          {/* ---- Business overview: money and trends for a chosen period ---------------------- */}
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Business overview</Text>
            {data && <Text style={styles.sectionSub}>{formatDateRange(data.rangeStart, data.rangeEnd)}</Text>}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {DASHBOARD_PRESETS.map((p) => {
              const on = preset === p;
              return (
                <Pressable key={p} style={[styles.chip, on && styles.chipOn]} onPress={() => setPreset(p)} accessibilityRole="button" accessibilityState={{ selected: on }}>
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{DATE_RANGE_PRESET_LABELS[p]}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          {preset === "Custom" && (
            <View style={styles.customRange}>
              <MiniDatePicker label="From" value={customStart} onChange={setCustomStart} />
              <MiniDatePicker label="To" value={customEnd} onChange={setCustomEnd} />
            </View>
          )}

          {preset === "Custom" && !customRangeReady ? (
            <Text style={styles.empty}>Choose both dates to see this period.</Text>
          ) : isPending ? (
            <Skeleton height={300} rounded={radius.card} />
          ) : isError || !data ? (
            <View style={styles.panel}>
              <Text style={styles.error}>Couldn't load the overview. Check your connection and try again.</Text>
              <Button label="Try again" onPress={() => refetch()} style={{ alignSelf: "flex-start" }} />
            </View>
          ) : (
            <View style={[styles.columns, isDesktop && styles.columnsWide]}>
              <View style={[{ gap: space.lg }, isDesktop && { flex: 2, minWidth: 0 }]}>
                {isOn("PAYMENTS") && (
                  <Panel title="Revenue">
                    <LineChart points={revenuePoints} formatValue={formatCurrencyShort} />
                    <View style={styles.figures}>
                      <Figure label="Collected" value={formatCurrency(data.collectedRevenue)} tone={colors.success} />
                      {isOn("EXPENSES") && <Figure label="Expenses" value={formatCurrency(data.totalExpenses)} />}
                      {isOn("EXPENSES") && <Figure label="Profit" value={formatCurrency(data.cashProfit)} tone={data.cashProfit >= 0 ? colors.success : colors.danger} />}
                      {isOn("QUOTATIONS") && <Figure label="Quoted" value={formatCurrency(data.quotationValue)} />}
                      <Figure label="Still to collect" value={formatCurrency(data.outstandingBalance)} tone={data.outstandingBalance > 0 ? colors.warning : undefined} />
                    </View>
                  </Panel>
                )}
              </View>
              <View style={[{ gap: space.lg }, isDesktop && { flex: 1, minWidth: 0 }]}>
                {isOn("EVENTS") && (
                  <Panel title="Events">
                    <DonutChart
                      centerLabel="Total"
                      centerValue={data.totalEvents}
                      segments={[
                        { label: "Upcoming", value: data.upcomingEvents, color: colors.info },
                        { label: "Completed", value: data.completedEvents, color: colors.success },
                        { label: "Cancelled", value: data.cancelledEvents, color: colors.danger },
                      ]}
                    />
                  </Panel>
                )}
                {isOn("QUOTATIONS") && (
                  <Panel title="Top services">
                    {data.topServices.length === 0 ? (
                      <Text style={styles.empty}>No quotations in this period.</Text>
                    ) : (
                      <View style={{ gap: space.md }}>
                        {data.topServices.map((s) => (
                          <View key={s.serviceName}>
                            <View style={styles.serviceRow}>
                              <Text style={styles.serviceName} numberOfLines={1}>{s.serviceName}</Text>
                              <Text style={styles.rowMeta}>{s.usageCount} ({s.percentage}%)</Text>
                            </View>
                            <View style={styles.track}><View style={[styles.fill, { width: `${s.percentage}%` }]} /></View>
                          </View>
                        ))}
                      </View>
                    )}
                  </Panel>
                )}
              </View>
            </View>
          )}

          {/* ---- Under the graphs: what's coming up and who has asked ------------------------- */}
          <View style={[styles.columns, isDesktop && styles.columnsWide]}>
            {upcomingPanel && <View style={isDesktop ? styles.col : undefined}>{upcomingPanel}</View>}
            {leadsPanel && <View style={isDesktop ? styles.col : undefined}>{leadsPanel}</View>}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

function Figure({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <View style={styles.figure}>
      <Text style={styles.figureLabel}>{label}</Text>
      <Text style={[styles.figureValue, tone ? { color: tone } : null]}>{value}</Text>
    </View>
  );
}

// "Today", "Tomorrow", "In 5 days" - both dates are plain calendar days (yyyy-mm-dd...).
function daysAway(eventDate: string, today: string): string {
  const days = Math.round((Date.parse(eventDate.slice(0, 10)) - Date.parse(today)) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
}

const MAX_WIDTH = 1280;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  content: { maxWidth: MAX_WIDTH, width: "100%", alignSelf: "center", paddingBottom: space.xxl },
  pressed: { backgroundColor: colors.cardRaised },
  header: { flexDirection: "row", alignItems: "center", gap: space.md, marginBottom: space.lg },
  greeting: { ...type.title, color: colors.text },
  subtitle: { ...type.small, color: colors.textMuted, marginTop: 2 },
  bell: {
    width: touch, height: touch, borderRadius: radius.control, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card,
    alignItems: "center", justifyContent: "center",
  },
  badge: {
    position: "absolute", top: 4, right: 4, backgroundColor: colors.danger, borderRadius: radius.pill,
    minWidth: 18, height: 18, paddingHorizontal: 4, alignItems: "center", justifyContent: "center",
  },
  badgeText: { color: colors.page, fontSize: 10, fontWeight: "700" },

  tileRow: { flexDirection: "row", gap: space.md },
  tileSlot: { flex: 1, minWidth: 0 },
  tile: {
    height: 104, backgroundColor: colors.card, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border,
    padding: space.md, justifyContent: "space-between",
  },
  tileTop: { flexDirection: "row", alignItems: "center", gap: 6 },
  tileLabel: { ...type.small, color: colors.textMuted, flex: 1 },
  tileValue: { fontSize: 24, fontWeight: "700", color: colors.text, fontVariant: ["tabular-nums"] },
  tileHint: { ...type.caption, color: colors.textFaint },

  columns: { gap: space.lg },
  columnsWide: { flexDirection: "row", alignItems: "flex-start" },
  col: { flex: 1, minWidth: 0 },

  panel: { backgroundColor: colors.card, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, padding: space.lg },
  panelHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: space.sm, minHeight: 32 },
  panelTitle: { ...type.heading, color: colors.text, flex: 1 },
  rows: { gap: 2, marginHorizontal: -space.sm },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 56, paddingHorizontal: space.sm, borderRadius: radius.control },
  rowTitle: { ...type.body, fontWeight: "600", color: colors.text },
  rowSub: { ...type.small, color: colors.textMuted },
  rowMeta: { ...type.caption, color: colors.textFaint },
  time: { ...type.small, fontWeight: "700", color: colors.link, width: 52 },
  dateBadge: { width: 44, alignItems: "center", paddingVertical: 4, borderRadius: radius.control, backgroundColor: colors.infoSoft },
  dateDay: { fontSize: 16, fontWeight: "700", color: colors.text, lineHeight: 19 },
  dateMonth: { fontSize: 11, fontWeight: "600", color: colors.info, textTransform: "uppercase" },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.cardRaised, alignItems: "center", justifyContent: "center" },
  avatarText: { color: colors.text, fontWeight: "700" },
  emptyRow: { flexDirection: "row", alignItems: "center", gap: space.sm, flexWrap: "wrap", minHeight: 44 },
  empty: { ...type.body, color: colors.textMuted },
  error: { ...type.body, color: colors.danger, marginBottom: space.md },

  sectionHead: { flexDirection: "row", alignItems: "baseline", gap: space.md, flexWrap: "wrap", marginTop: space.lg },
  sectionTitle: { ...type.heading, fontSize: 19, color: colors.text },
  sectionSub: { ...type.small, color: colors.textMuted },
  chips: { gap: space.sm },
  chip: { minHeight: 36, justifyContent: "center", borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.pill, paddingHorizontal: 14, backgroundColor: colors.card },
  chipOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  chipText: { ...type.small, color: colors.textMuted, fontWeight: "600" },
  chipTextOn: { color: colors.primary },
  customRange: { flexDirection: "row", flexWrap: "wrap", gap: space.md },

  figures: { flexDirection: "row", flexWrap: "wrap", gap: space.lg, marginTop: space.lg, paddingTop: space.lg, borderTopWidth: 1, borderTopColor: colors.border },
  figure: { minWidth: 110 },
  figureLabel: { ...type.caption, color: colors.textMuted },
  figureValue: { ...type.body, fontWeight: "700", color: colors.text, fontVariant: ["tabular-nums"] },
  serviceRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6, gap: space.sm },
  serviceName: { ...type.small, fontWeight: "600", color: colors.text, flex: 1 },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.bar, overflow: "hidden" },
  fill: { height: 6, borderRadius: 3, backgroundColor: colors.link },
});
