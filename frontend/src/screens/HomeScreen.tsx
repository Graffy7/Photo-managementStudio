import { useCallback, useId, useMemo, useState, type ReactNode } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator, ScrollView, Platform, useWindowDimensions } from "react-native";
import { transition } from "../ui/theme";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Defs, LinearGradient as SvgGradient, Path, Stop, Ellipse, RadialGradient } from "react-native-svg";
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
import { hoverGlow } from "../ui/webHover";
import { askSignOut } from "../ui/SignOutConfirm";

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

// The dashboard's own navy + electric-blue look. The rest of the app keeps the shared theme
// (ui/theme.ts); these colours apply to this screen only.
const D = {
  page: "#070F24",
  card: "#0C1733",
  cardEdge: "rgba(96,140,255,0.16)",
  inset: "#0A1430",
  text: "#F2F5FF",
  muted: "#A4AFCF",
  faint: "#6F7BA0",
  grid: "rgba(120,150,230,0.14)",
  blue: "#2F7BFF",
  blueBright: "#4C93FF",
  green: "#22C58B",
  red: "#FF4D6A",
  orange: "#FF9F1C",
  purple: "#8B6CFF",
};

const CHART_PALETTE = {
  grid: D.grid,
  surface: D.card,
  text: D.text,
  textMuted: D.muted,
  tooltipBg: "rgba(12,23,51,0.97)",
  tooltipBorder: "rgba(76,147,255,0.45)",
  badgeBg: "rgba(47,123,255,0.16)",
  badgeBorder: "rgba(76,147,255,0.35)",
};

const STATUS_COLORS: Record<string, string> = {
  Upcoming: D.orange,
  Ongoing: D.blue,
  Completed: D.green,
  Cancelled: D.red,
};

function Delta({ percent, preset }: { percent: number | null; preset: DateRangePreset }) {
  if (percent === null) {
    return <Text style={styles.deltaNeutral}>No comparison yet</Text>;
  }
  const isUp = percent >= 0;
  const tone = isUp ? D.green : D.red;
  return (
    <View style={styles.deltaRow}>
      <Ionicons name={isUp ? "arrow-up" : "arrow-down"} size={13} color={tone} />
      <Text style={[styles.delta, { color: tone }]}>{Math.abs(percent)}%</Text>
      <Text style={styles.deltaLabel}>{comparisonLabel(preset)}</Text>
    </View>
  );
}

// A soft wave in the card's colour along its lower right corner - decoration only, not data.
function CardWave({ color }: { color: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <Svg width="58%" height={62} viewBox="0 0 190 80" preserveAspectRatio="none" style={styles.cardWave} pointerEvents="none">
      <Defs>
        <SvgGradient id={`wave${uid}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity={0.55} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </SvgGradient>
      </Defs>
      <Path d="M0,80 C40,78 58,58 92,56 C126,54 140,62 160,44 C172,34 182,28 190,26 L190,80 Z" fill={`url(#wave${uid})`} />
      <Path d="M0,80 C40,78 58,58 92,56 C126,54 140,62 160,44 C172,34 182,28 190,26" stroke={color} strokeWidth={2} fill="none" strokeOpacity={0.9}
        vectorEffect="non-scaling-stroke" />
    </Svg>
  );
}

// The card's icon tile: glows brighter while the card is hovered.
function StatIcon({ icon, color, active }: { icon: keyof typeof Ionicons.glyphMap; color: string; active: boolean }) {
  return (
    <View style={[styles.statIcon, transition, { backgroundColor: color, boxShadow: active ? `0 8px 26px ${color}AA` : `0 6px 18px ${color}66` }]}>
      <Ionicons name={icon} size={20} color="#FFFFFF" />
    </View>
  );
}

function StatCard({
  icon, color, label, value, percent, preset, compact, onOpen,
}: {
  icon: keyof typeof Ionicons.glyphMap; color: string; label: string; value: string | number;
  percent: number | null; preset: DateRangePreset; compact?: boolean; onOpen: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <Pressable onPress={onOpen} onHoverIn={() => setHovered(true)} onHoverOut={() => setHovered(false)}
      accessibilityRole="button" accessibilityLabel={`${label}: ${value}. Open`}
      style={[styles.statCard, compact && styles.statCardCompact, hovered && styles.statCardHover]}>
      <LinearGradient colors={[`${color}55`, `${color}14`, D.card]} locations={[0, 0.45, 1]} start={{ x: 1, y: 1 }} end={{ x: 0, y: 0 }} style={StyleSheet.absoluteFill} />
      {!compact && <CardWave color={color} />}
      <View style={styles.statTop}>
        <StatIcon icon={icon} color={color} active={hovered} />
        <View style={styles.statOpen}>
          <Ionicons name="chevron-forward" size={16} color={D.text} />
        </View>
      </View>
      <Text style={[styles.statValue, compact && styles.statValueCompact]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      <Delta percent={percent} preset={preset} />
    </Pressable>
  );
}

function Panel({ title, icon, action, children }: { title: string; icon: keyof typeof Ionicons.glyphMap; action?: ReactNode; children: ReactNode }) {
  return (
    <View {...hoverGlow} style={styles.panel}>
      <View style={styles.panelHeader}>
        <View style={styles.panelTitleRow}>
          <LinearGradient colors={[D.blueBright, D.blue]} style={styles.panelIcon}>
            <Ionicons name={icon} size={17} color="#FFFFFF" />
          </LinearGradient>
          <Text style={styles.panelTitle}>{title}</Text>
        </View>
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
  const glowId = useId().replace(/[^a-zA-Z0-9]/g, "");

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
      {/* A wide blue glow sweeping across the top right of the page. */}
      <Svg style={styles.pageGlow} width="100%" height={520} viewBox="0 0 1000 520" preserveAspectRatio="none" pointerEvents="none">
        <Defs>
          <RadialGradient id={`pageGlow${glowId}`} cx="80%" cy="0%" rx="60%" ry="90%">
            <Stop offset="0" stopColor={D.blue} stopOpacity={0.38} />
            <Stop offset="0.5" stopColor={D.blue} stopOpacity={0.1} />
            <Stop offset="1" stopColor={D.blue} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx="800" cy="0" rx="700" ry="520" fill={`url(#pageGlow${glowId})`} />
      </Svg>

      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={[styles.greeting, narrow && styles.greetingNarrow]}>
            {greeting()}, <Text style={styles.greetingName}>{user?.fullName?.split(" ")[0] ?? "there"}</Text> 👋
          </Text>
          <Text style={styles.subtitle}>Here's what's happening with your studio today.</Text>
        </View>

        <View style={styles.headerRight}>
          {data && (
            <View style={styles.rangeChip}>
              <Ionicons name="calendar-outline" size={16} color={D.blueBright} />
              <Text style={styles.rangeChipText}>{formatDateRange(data.rangeStart, data.rangeEnd)}</Text>
            </View>
          )}
          {showBell && isOn("NOTIFICATIONS") && <Pressable style={styles.iconButton} onPress={() => navigation.navigate("Notifications")}
            accessibilityRole="button" accessibilityLabel={unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications"}>
            <Ionicons name="notifications-outline" size={19} color={D.text} />
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
          <Pressable style={styles.nativeNavButton} onPress={askSignOut}>
            <Text style={[styles.nativeNavButtonText, { color: D.red }]}>Sign out</Text>
          </Pressable>
        </ScrollView>
      )}

      {!dashboardOn ? (
        <View style={styles.welcomeCard}>
          <Ionicons name="grid-outline" size={22} color={D.blueBright} />
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
          <Ionicons name="arrow-forward" size={14} color={D.faint} style={{ marginTop: 20 }} />
          <MiniDatePicker label="To" value={customEnd} onChange={setCustomEnd} />
        </View>
      )}

      {preset === "Custom" && !customRangeReady ? (
        <Text style={styles.empty}>Enter both dates above to load this range.</Text>
      ) : isPending ? (
        <ActivityIndicator color={D.blueBright} style={{ marginTop: 40 }} />
      ) : isError || !data ? (
        <Text style={styles.error}>Couldn't load the dashboard.</Text>
      ) : (
        <>
          <View style={styles.statRow}>
            {isOn("LEADS") && <StatCard icon="people-outline" color={D.purple} label="Total Enquiries" value={data.totalLeads} percent={data.leadsChangePercent} preset={preset} compact={stacked} onOpen={() => navigation.navigate("Leads")} />}
            {isOn("CUSTOMERS") && <StatCard icon="people-circle-outline" color={D.green} label="Total Customers" value={data.totalCustomers} percent={data.customersChangePercent} preset={preset} compact={stacked} onOpen={() => navigation.navigate("Customers")} />}
            {isOn("EVENTS") && <StatCard icon="calendar-outline" color={D.orange} label={`Events ${periodLabel(preset)}`} value={data.totalEvents} percent={data.eventsChangePercent} preset={preset} compact={stacked} onOpen={() => navigation.navigate("Events")} />}
            {isOn("PAYMENTS") && <StatCard icon="cash-outline" color={D.blue} label={`Revenue ${periodLabel(preset)}`} value={formatCurrency(data.collectedRevenue)} percent={data.revenueChangePercent} preset={preset} compact={stacked} onOpen={() => navigation.navigate("Payments")} />}
          </View>

          <View style={[styles.columns, stacked && styles.columnsStacked]}>
            <View style={[styles.mainColumn, stacked && styles.columnStacked]}>
              {isOn("PAYMENTS") && (
                <Panel title="Overview" icon="bar-chart">
                  <LineChart points={revenuePoints} formatValue={formatCurrencyShort} height={narrow ? 220 : 320}
                    color={D.blue} accentColor={D.blueBright} showYAxis={!narrow} showDots palette={CHART_PALETTE} />
                  <View style={styles.overviewStats}>
                    <OverviewStat label="Revenue" value={formatCurrency(data.collectedRevenue)} color={D.green} divided={false} />
                    {isOn("EXPENSES") && <OverviewStat divided={!narrow} label="Expenses" value={formatCurrency(data.totalExpenses)} color={D.red} />}
                    {isOn("EXPENSES") && <OverviewStat divided={!narrow} label="Profit" value={formatCurrency(data.cashProfit)} color={data.cashProfit >= 0 ? D.green : D.red} />}
                    {isOn("EXPENSES") && (
                      <OverviewStat divided={!narrow} label="Margin" value={data.collectedRevenue === 0 ? "—" : `${Math.round((data.cashProfit / data.collectedRevenue) * 100)}%`} />
                    )}
                  </View>
                </Panel>
              )}

              {(isOn("QUOTATIONS") || isOn("PAYMENTS") || isOn("EXPENSES")) && (
                <Panel
                  title="Financial Summary"
                  icon="wallet"
                  action={
                    <View style={styles.periodPill}>
                      <Ionicons name="calendar-outline" size={13} color={D.blueBright} />
                      <Text style={styles.periodPillText}>{periodLabel(preset)}</Text>
                    </View>
                  }
                >
                  <View style={styles.financeGrid}>
                    {isOn("QUOTATIONS") && <FinanceTile icon="document-text-outline" label="Quotation Value" value={formatCurrency(data.quotationValue)} />}
                    {isOn("PAYMENTS") && <FinanceTile icon="checkmark-circle-outline" label="Collected Revenue" value={formatCurrency(data.collectedRevenue)} color={D.green} />}
                    {isOn("PAYMENTS") && <FinanceTile icon="hourglass-outline" label="Outstanding" value={formatCurrency(data.outstandingBalance)} color={data.outstandingBalance > 0 ? D.orange : undefined} />}
                    {isOn("EXPENSES") && <FinanceTile icon="receipt-outline" label="Expenses" value={formatCurrency(data.totalExpenses)} color={D.red} />}
                    {isOn("QUOTATIONS") && isOn("EXPENSES") && (
                      <FinanceTile icon="trending-up-outline" label="Expected Profit" value={formatCurrency(data.expectedProfit)} color={data.expectedProfit >= 0 ? D.green : D.red} />
                    )}
                    {isOn("PAYMENTS") && isOn("EXPENSES") && (
                      <FinanceTile icon="cash-outline" label="Cash Profit" value={formatCurrency(data.cashProfit)} color={data.cashProfit >= 0 ? D.green : D.red} />
                    )}
                  </View>
                </Panel>
              )}
            </View>

            {/* Right column: events at a glance, then today's and upcoming bookings. */}
            <View style={[styles.sideColumn, stacked && styles.columnStacked]}>
              {isOn("EVENTS") && (
                <Panel title="Events Summary" icon="calendar-clear">
                  <DonutChart
                    centerLabel="Total"
                    centerValue={data.totalEvents}
                    trackColor="#1A2852"
                    segments={[
                      { label: "Upcoming", value: data.upcomingEvents, color: STATUS_COLORS.Upcoming },
                      { label: "Ongoing", value: data.ongoingEvents ?? 0, color: STATUS_COLORS.Ongoing },
                      { label: "Completed", value: data.completedEvents, color: STATUS_COLORS.Completed },
                      { label: "Cancelled", value: data.cancelledEvents, color: STATUS_COLORS.Cancelled },
                    ]}
                  />
                </Panel>
              )}
              {isOn("DAY_BOARD") && (
                <Panel
                  title="Today's Schedule"
                  icon="today"
                  action={
                    <Pressable onPress={() => navigation.navigate("DayBoard")} accessibilityRole="link">
                      <Text style={styles.panelLink}>View Full Day Board →</Text>
                    </Pressable>
                  }
                >
                  {!dayBoard || dayBoard.events.length === 0 ? (
                    <Text style={styles.empty}>Nothing scheduled for today.</Text>
                  ) : (
                    <View>
                      {dayBoard.events.map((e, i) => (
                        <View key={e.eventId} style={styles.scheduleRow}>
                          {/* Timeline: a dot per booking, joined by a line down to the next one. */}
                          <View style={styles.timeline}>
                            {i < dayBoard.events.length - 1 && <View style={styles.timelineLine} />}
                            <View style={styles.timelineDot} />
                          </View>
                          <Text style={styles.scheduleTime}>{e.startTime ? e.startTime.slice(0, 5) : "—"}</Text>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.scheduleTitle} numberOfLines={1}>{e.eventTypeName ?? "Event"} — {e.customerName}</Text>
                            <Text style={styles.scheduleSubtitle} numberOfLines={1}>{e.venue ?? "No venue set"}</Text>
                          </View>
                          <StatusPill status={e.eventStatus} />
                        </View>
                      ))}
                    </View>
                  )}
                </Panel>
              )}

              {isOn("EVENTS") && (
              <Panel
                title="Upcoming Events"
                icon="time"
                action={
                  <Pressable onPress={() => navigation.navigate("Events")} accessibilityRole="link">
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
                          <StatusPill status={e.eventStatus} />
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
            <Ionicons name="star" size={16} color={D.orange} />
            <Text style={styles.tipText}><Text style={styles.tipLabel}>Tip of the day: </Text>{tip}</Text>
          </View>
        </>
      )}
      </>)}
    </ScrollView>
  );
}

function OverviewStat({ label, value, color, divided }: { label: string; value: string; color?: string; divided: boolean }) {
  return (
    <View style={[styles.overviewStat, divided && styles.overviewStatDivided]}>
      <Text style={styles.overviewStatLabel}>{label}</Text>
      <Text style={[styles.overviewStatValue, color ? { color } : undefined]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function FinanceTile({ icon, label, value, color }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; color?: string }) {
  return (
    <View style={styles.financeTile}>
      <View style={styles.financeLabelRow}>
        <Ionicons name={icon} size={14} color={color ?? D.muted} />
        <Text style={styles.financeLabel}>{label}</Text>
      </View>
      <Text style={[styles.financeValue, color ? { color } : undefined]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function StatusPill({ status }: { status: string }) {
  const color = STATUS_COLORS[status] ?? D.faint;
  return (
    <View style={[styles.statusPill, { backgroundColor: color, boxShadow: `0 2px 10px ${color}55` }]}>
      <Text style={styles.statusPillText}>{status}</Text>
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

function dayOfYear(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  return Math.floor((now.getTime() - start.getTime()) / 86400000);
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: D.page },
  content: { padding: 28, maxWidth: 1760, width: "100%", alignSelf: "center" },
  contentNarrow: { padding: 16 },
  pageGlow: { position: "absolute", top: 0, left: 0, right: 0 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, gap: 16, flexWrap: "wrap" },
  // On a phone there isn't room for the greeting beside the date and bell, so they wrap below it.
  headerLeft: { flexGrow: 1, flexShrink: 1, flexBasis: 260 },
  greeting: { fontSize: 30, fontWeight: "800", color: D.text, letterSpacing: -0.4 },
  greetingNarrow: { fontSize: 24 },
  greetingName: { color: D.blueBright },
  subtitle: { fontSize: 15, color: D.muted, marginTop: 4 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 12 },
  rangeChip: {
    flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: D.cardEdge,
    borderRadius: 100, paddingVertical: 10, paddingHorizontal: 16, backgroundColor: "rgba(12,23,51,0.8)",
  },
  rangeChipText: { color: D.text, fontSize: 13, fontWeight: "600" },
  iconButton: {
    width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: D.cardEdge, backgroundColor: "rgba(12,23,51,0.8)",
    alignItems: "center", justifyContent: "center",
  },
  badge: {
    position: "absolute", top: -4, right: -6, backgroundColor: D.red, borderRadius: 100,
    minWidth: 20, height: 18, paddingHorizontal: 4, alignItems: "center", justifyContent: "center",
  },
  badgeText: { color: "#FFFFFF", fontSize: 11, fontWeight: "800" },
  nativeNavRow: { marginBottom: 14 },
  nativeNavRowContent: { gap: 8, paddingRight: 8 },
  nativeNavButton: { borderWidth: 1, borderColor: D.cardEdge, borderRadius: 100, paddingVertical: 9, paddingHorizontal: 14, backgroundColor: D.card },
  nativeNavButtonText: { color: D.muted, fontSize: 12, fontWeight: "600" },
  presetRow: { marginBottom: 22 },
  presetRowContent: { gap: 10, paddingRight: 8 },
  presetWrap: { flexDirection: "row", flexWrap: "wrap" },
  presetChipNarrow: { flexGrow: 1, alignItems: "center", minHeight: 40, justifyContent: "center" },
  customRangeRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 18, flexWrap: "wrap" },
  presetChip: {
    borderWidth: 1, borderColor: "rgba(164,175,207,0.28)", borderRadius: 100, paddingVertical: 9, paddingHorizontal: 18,
    backgroundColor: "rgba(12,23,51,0.6)",
  },
  presetChipSelected: { borderColor: D.blue, backgroundColor: D.blue, boxShadow: `0 6px 20px ${D.blue}66` },
  presetChipText: { color: D.text, fontSize: 13, fontWeight: "600" },
  presetChipTextSelected: { color: "#FFFFFF" },
  error: { color: D.red, marginTop: 40, textAlign: "center" },
  empty: { color: D.faint, fontSize: 13, paddingVertical: 8 },

  statRow: { flexDirection: "row", flexWrap: "wrap", gap: 18, marginBottom: 20 },
  statCard: {
    flexGrow: 1, flexBasis: 0, minWidth: 230, minHeight: 156, backgroundColor: D.card, borderRadius: 18, borderWidth: 1,
    borderColor: D.cardEdge, padding: 20, overflow: "hidden", boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
  },
  statCardHover: { transform: [{ translateY: -2 }], borderColor: "rgba(120,160,255,0.35)" },
  // Phones: two cards per row instead of one card filling the screen.
  statCardCompact: { minWidth: 0, flexBasis: "40%", minHeight: 0, padding: 14 },
  statValueCompact: { fontSize: 24 },
  cardWave: { position: "absolute", right: 0, bottom: 0 },
  statTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
  statIcon: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  statOpen: {
    width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
  },
  statValue: { fontSize: 32, fontWeight: "800", color: D.text, fontVariant: ["tabular-nums"], letterSpacing: -0.5 },
  statLabel: { fontSize: 15, color: D.text, opacity: 0.9, marginTop: 2 },
  deltaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 10 },
  delta: { fontSize: 14, fontWeight: "800" },
  deltaLabel: { fontSize: 13, color: D.muted },
  deltaNeutral: { fontSize: 13, color: D.muted, marginTop: 10 },

  columns: { flexDirection: "row", flexWrap: "wrap", gap: 20, alignItems: "flex-start" },
  columnsStacked: { flexDirection: "column", flexWrap: "nowrap", alignItems: "stretch" },
  // In a column, flexBasis would become a height: reset it so each panel is as tall as its content.
  columnStacked: { flexBasis: "auto", flexGrow: 0 },
  mainColumn: { flexGrow: 2, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 20 },
  sideColumn: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: 20 },

  panel: {
    backgroundColor: D.card, borderRadius: 18, borderWidth: 1, borderColor: D.cardEdge, padding: 20,
    boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
  },
  panelHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 10 },
  panelTitleRow: { flexDirection: "row", alignItems: "center", gap: 12, flexShrink: 1 },
  panelIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  panelTitle: { fontSize: 18, fontWeight: "800", color: D.text },
  panelLink: { fontSize: 13, color: D.blueBright, fontWeight: "700" },
  periodPill: {
    flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 100, paddingVertical: 7, paddingHorizontal: 14,
    backgroundColor: "rgba(47,123,255,0.14)", borderWidth: 1, borderColor: "rgba(76,147,255,0.3)",
  },
  periodPillText: { color: D.text, fontSize: 13, fontWeight: "600" },

  overviewStats: { flexDirection: "row", flexWrap: "wrap", rowGap: 14, marginTop: 18, borderTopWidth: 1, borderTopColor: D.grid, paddingTop: 18 },
  overviewStat: { flexGrow: 1, flexBasis: 120, paddingHorizontal: 4 },
  overviewStatDivided: { borderLeftWidth: 1, borderLeftColor: D.grid, paddingLeft: 20 },
  overviewStatLabel: { fontSize: 14, color: D.text, opacity: 0.85 },
  overviewStatValue: { fontSize: 22, fontWeight: "800", color: D.text, marginTop: 4, fontVariant: ["tabular-nums"] },

  financeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  financeTile: {
    flexGrow: 1, flexBasis: "30%", minWidth: 150, backgroundColor: D.inset, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: D.cardEdge,
  },
  financeLabelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  financeLabel: { fontSize: 13, color: D.muted },
  financeValue: { fontSize: 18, fontWeight: "800", color: D.text, marginTop: 6, fontVariant: ["tabular-nums"] },

  scheduleRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 9 },
  timeline: { width: 14, alignSelf: "stretch", alignItems: "center", justifyContent: "center" },
  // Runs from this dot's centre down to the next row's dot.
  timelineLine: { position: "absolute", top: "50%", height: "100%", width: 2, backgroundColor: D.blue, opacity: 0.55 },
  timelineDot: {
    width: 12, height: 12, borderRadius: 6, backgroundColor: D.blue, borderWidth: 2, borderColor: "#9CC2FF",
    boxShadow: `0 0 10px ${D.blue}`,
  },
  scheduleTime: { color: D.text, fontSize: 14, fontWeight: "600", width: 46, fontVariant: ["tabular-nums"] },
  scheduleTitle: { color: D.text, fontSize: 14, fontWeight: "700" },
  scheduleSubtitle: { color: D.muted, fontSize: 12, marginTop: 2 },
  upcomingRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  dateBadge: {
    width: 44, alignItems: "center", paddingVertical: 5, borderRadius: 10,
    backgroundColor: "rgba(47,123,255,0.14)", borderWidth: 1, borderColor: "rgba(76,147,255,0.3)",
  },
  dateBadgeDay: { color: D.text, fontSize: 15, fontWeight: "800", lineHeight: 18 },
  dateBadgeMonth: { color: D.blueBright, fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  statusPill: { borderRadius: 100, paddingVertical: 4, paddingHorizontal: 10 },
  statusPillText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },

  welcomeCard: {
    alignItems: "center", gap: 6, paddingVertical: 40, paddingHorizontal: 20, borderRadius: 18,
    borderWidth: 1, borderColor: D.cardEdge, backgroundColor: D.card,
  },
  welcomeTitle: { color: D.text, fontSize: 17, fontWeight: "700" },
  welcomeText: { color: D.muted, fontSize: 13 },
  tipBanner: {
    flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: D.card, borderWidth: 1,
    borderColor: D.cardEdge, borderRadius: 18, padding: 16, marginTop: 20,
  },
  tipText: { color: D.muted, fontSize: 13, flex: 1 },
  tipLabel: { color: D.text, fontWeight: "700" },
});
