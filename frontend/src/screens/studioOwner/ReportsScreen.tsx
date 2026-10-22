import { useState } from "react";
import { View, Text, Image, Pressable, StyleSheet, Platform, ActivityIndicator } from "react-native";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { reportsApi } from "../../api/reportsApi";
import { settingsApi } from "../../api/settingsApi";
import { photoUrl } from "../../api/photoSelectionApi";
import { extractErrorMessage } from "../../api/errorMessage";
import { useAuthStore } from "../../auth/authStore";
import type { AnalyticsBucket, ReportPreset, ReportRange } from "../../types/analytics";
import { useRefetchOnFocus } from "../../hooks/useRefetchOnFocus";
import { MiniDatePicker } from "../../components/MiniDatePicker";
import { GroupedBarChart } from "../../components/GroupedBarChart";
import { DonutChart } from "../../components/DonutChart";
import { LineChart } from "../../components/LineChart";
import { BusyDaysHeatmap } from "../../components/BusyDaysHeatmap";
import { downloadAndSharePdf } from "../../utils/downloadPdf";
import { Screen } from "../../ui/Screen";
import { FilterChips } from "../../ui/FilterChips";
import { EmptyState } from "../../ui/EmptyState";
import { Button } from "../../ui/Button";
import { Skeleton } from "../../ui/Skeleton";
import { useBreakpoint } from "../../ui/useBreakpoint";
import { colors, radius, space, type } from "../../ui/theme";
import { ReportDetails } from "./ReportDetails";

const PRESETS: { value: ReportPreset; label: string }[] = [
  { value: "Last7Days", label: "7 Days" },
  { value: "Last1Month", label: "1 Month" },
  { value: "Last3Months", label: "3 Months" },
  { value: "Last6Months", label: "6 Months" },
  { value: "Last1Year", label: "1 Year" },
  { value: "Custom", label: "Custom" },
];

// One colour per meaning across the page: blue bookings, green money, orange still to pay, red cancelled.
const C = { blue: "#4da3ff", green: "#4cc493", orange: "#f5a524", red: "#ff6b6b", sky: "#7fc0e6" };
const TYPE_COLORS = ["#4da3ff", "#a78bfa", "#4cc493", "#f5a524", "#ff6b6b", "#5ad8e6", "#f58ac8", "#9fb3c8"];

const rupees = (v: number) => `₹${Math.round(v).toLocaleString("en-IN")}`;
const count = (n: number) => n.toLocaleString("en-IN");
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
}

// Short labels under the charts: "22" (with the month on the first bar and the 1st), "Oct" (with the
// year on the first month and January).
function axisLabelFor(grouping: "Day" | "Month") {
  return (b: AnalyticsBucket, i: number) => {
    const [y, m, d] = b.start.slice(0, 10).split("-").map(Number);
    if (grouping === "Day") return i === 0 || d === 1 ? `${d} ${MONTHS[m - 1]}` : String(d);
    return i === 0 || m === 1 ? `${MONTHS[m - 1]} '${String(y).slice(2)}` : MONTHS[m - 1];
  };
}

// compact (phones): no icon and a smaller number, so amounts like ₹7,28,250 fit two to a row.
function SummaryCard({ icon, label, value, rule, color, compact }: {
  icon: keyof typeof Ionicons.glyphMap; label: string; value: string; rule: string; color: string; compact?: boolean;
}) {
  return (
    <View style={[styles.card, compact && styles.cardCompact, compact && { borderLeftWidth: 3, borderLeftColor: color }]}>
      {!compact && (
        <View style={[styles.cardIcon, { backgroundColor: `${color}22` }]}>
          <Ionicons name={icon} size={22} color={color} />
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.cardLabel} numberOfLines={1}>{label}</Text>
        <Text style={[styles.cardValue, compact && styles.cardValueCompact]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
        <Text style={styles.cardRule} numberOfLines={1}>{rule}</Text>
      </View>
    </View>
  );
}

function Panel({ title, total, children }: { title: string; total?: string; children: React.ReactNode }) {
  return (
    <View style={styles.panel}>
      <View style={styles.panelHead}>
        <Text style={styles.panelTitle}>{title}</Text>
        {total ? <Text style={styles.panelTotal}>{total}</Text> : null}
      </View>
      {children}
    </View>
  );
}

// Labels under the line chart, spaced the same way as under the bar charts.
function AxisLabels({ buckets, label }: { buckets: AnalyticsBucket[]; label: (b: AnalyticsBucket, i: number) => string }) {
  const every = Math.ceil(buckets.length / 10);
  const groups: { text: string; size: number }[] = [];
  for (let i = 0; i < buckets.length; i += every) groups.push({ text: label(buckets[i], i), size: Math.min(every, buckets.length - i) });
  return (
    <View style={{ flexDirection: "row", paddingHorizontal: 12 }}>
      {groups.map((g, i) => <Text key={i} style={[styles.axis, { flex: g.size }]} numberOfLines={1}>{g.text}</Text>)}
    </View>
  );
}

export function ReportsScreen() {
  const { isPhone, isDesktop } = useBreakpoint();
  const studioName = useAuthStore((s) => s.user?.studioName) ?? "Studio";
  const [range, setRange] = useState<ReportRange>({ preset: "Last1Month" });
  const [choosingCustom, setChoosingCustom] = useState(false);
  const [draftStart, setDraftStart] = useState("");
  const [draftEnd, setDraftEnd] = useState("");
  const [customError, setCustomError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const { data: profile } = useQuery({ queryKey: ["studio-profile"], queryFn: settingsApi.getProfile, retry: false });
  const logo = profile?.logoUrl ? photoUrl(profile.logoUrl) : undefined;

  // One request feeds every card, chart and the details, so they always change together; a newer
  // range cancels the older request instead of racing it.
  const { data, isPending, isError, error, isFetching, isPlaceholderData, refetch } = useQuery({
    queryKey: ["analytics-report", range.preset, range.customStart, range.customEnd],
    queryFn: ({ signal }) => reportsApi.getAnalytics(range, signal),
    placeholderData: keepPreviousData,
  });
  useRefetchOnFocus(refetch);

  const choosePreset = (preset: ReportPreset) => {
    setCustomError(null);
    if (preset === "Custom") {
      setChoosingCustom(true);
      return;
    }
    setChoosingCustom(false);
    setRange({ preset });
  };

  const applyCustom = () => {
    if (!draftStart || !draftEnd) return setCustomError("Choose both dates.");
    if (draftStart > draftEnd) return setCustomError("The start date can't be after the end date.");
    setCustomError(null);
    setRange({ preset: "Custom", customStart: draftStart, customEnd: draftEnd });
  };

  const exportPdf = async (details: boolean) => {
    setExportOpen(false);
    setExporting(true);
    setExportError(null);
    try {
      const bytes = await reportsApi.exportAnalytics(range, details);
      const name = data ? `business-overview-${data.rangeStart.slice(0, 10)}-to-${data.rangeLastDay.slice(0, 10)}.pdf` : "business-overview.pdf";
      await downloadAndSharePdf(bytes, name);
    } catch (err) {
      setExportError(extractErrorMessage(err, "Couldn't export the PDF."));
    } finally {
      setExporting(false);
    }
  };

  const updating = isFetching && isPlaceholderData;
  const axis = axisLabelFor(data?.grouping ?? "Day");
  const s = data?.summary;
  const status = (name: string) => data?.statuses.filter((x) => x.status === name).reduce((n, x) => n + x.count, 0) ?? 0;
  const busiest = data?.eventDays.reduce((a, b) => (b.events > a.events ? b : a), data.eventDays[0]);

  return (
    <Screen>
      <View style={[styles.header, isPhone && styles.headerPhone]}>
        <View style={styles.brand}>
          {logo ? (
            <Image source={{ uri: logo }} style={styles.logo} resizeMode="contain" accessibilityLabel={`${studioName} logo`} />
          ) : (
            <View style={[styles.logo, styles.logoInitial]}><Text style={styles.logoInitialText}>{studioName.charAt(0).toUpperCase()}</Text></View>
          )}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.studioName} numberOfLines={1}>{studioName}</Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              Business Overview{data ? ` · ${formatDate(data.rangeStart)} – ${formatDate(data.rangeLastDay)}` : ""}
            </Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <FilterChips<ReportPreset> options={PRESETS} value={choosingCustom ? "Custom" : range.preset} onChange={choosePreset} />
          <View>
            <Pressable onPress={() => setExportOpen((v) => !v)} style={styles.exportButton} disabled={!data || exporting}
              accessibilityRole="button" accessibilityLabel="Export PDF">
              {exporting ? <ActivityIndicator size="small" color={C.blue} /> : <Ionicons name="download-outline" size={17} color={colors.text} />}
              <Text style={styles.exportText}>PDF</Text>
            </Pressable>
            {exportOpen && (
              <View style={styles.exportMenu}>
                <Pressable style={styles.exportItem} onPress={() => exportPdf(false)}>
                  <Text style={styles.exportItemTitle}>Summary</Text>
                  <Text style={styles.exportItemText}>One page of charts</Text>
                </Pressable>
                <Pressable style={styles.exportItem} onPress={() => exportPdf(true)}>
                  <Text style={styles.exportItemTitle}>Summary + details</Text>
                  <Text style={styles.exportItemText}>Charts, then the tables</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </View>

      {choosingCustom && (
        <View style={styles.customRow}>
          <MiniDatePicker label="From" value={draftStart} onChange={(v) => { setDraftStart(v); setCustomError(null); }} />
          <MiniDatePicker label="To" value={draftEnd} onChange={(v) => { setDraftEnd(v); setCustomError(null); }} />
          <View style={{ marginTop: 18 }}><Button label="Apply" variant="primary" onPress={applyCustom} /></View>
          {customError ? <Text style={[styles.error, { width: "100%" }]}>{customError}</Text> : null}
        </View>
      )}
      {exportError ? <Text style={[styles.error, { marginBottom: space.sm }]}>{exportError}</Text> : null}

      {isPending ? (
        <View style={[styles.grid, isDesktop && styles.gridWide]}>
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={280} rounded={radius.card} />)}
        </View>
      ) : isError || !data || !s ? (
        <EmptyState icon="cloud-offline-outline" title="Couldn't load the overview" text={extractErrorMessage(error, "Check your connection and try again.")}
          action={<Button label="Try again" onPress={() => refetch()} />} />
      ) : showDetails ? (
        <View style={{ gap: space.md }}>
          <Pressable onPress={() => setShowDetails(false)} style={styles.backLink} accessibilityRole="button">
            <Ionicons name="arrow-back" size={16} color={colors.link} />
            <Text style={styles.link}>Back to overview</Text>
          </Pressable>
          <ReportDetails data={data} />
        </View>
      ) : (
        <View style={[{ gap: space.md }, updating && { opacity: 0.55 }]}>
          <View style={[styles.cards, isPhone && styles.cardsPhone]}>
            <SummaryCard icon="calendar" label="Bookings" compact={isPhone} value={count(s.newBookings)} rule="booked in this period" color={C.blue} />
            <SummaryCard icon="checkmark-done" label="Events completed" compact={isPhone} value={count(s.completed)} rule="event date in this period" color={C.green} />
            <SummaryCard icon="cash" label="Money received" compact={isPhone} value={rupees(s.moneyReceived)} rule="payments in this period" color={C.green} />
            <SummaryCard icon="hourglass" label="Customers owe" compact={isPhone} value={rupees(s.outstanding)} rule="unpaid on this period's events" color={C.orange} />
          </View>

          <View style={[styles.grid, isDesktop && styles.gridWide]}>
            <Panel title="Booking trend" total={`${count(s.newBookings)} bookings`}>
              <LineChart
                height={210}
                hideLabels
                color={C.blue}
                accentColor={C.sky}
                formatValue={(v) => `${count(v)} bookings`}
                points={data.buckets.map((b) => ({ label: b.label, value: b.newBookings, detail: { title: b.label, total: `${count(b.newBookings)} bookings` } }))}
              />
              <AxisLabels buckets={data.buckets} label={axis} />
            </Panel>

            <Panel title="Event status" total={`${count(s.events)} events`}>
              <View style={styles.donutBox}>
                <DonutChart
                  showShare={false}
                  size={180}
                  strokeWidth={18}
                  centerLabel="Events"
                  centerValue={s.events}
                  segments={[
                    { label: "Completed", value: s.completed, color: C.green },
                    { label: "Upcoming", value: status("Upcoming") + status("Confirmed"), color: C.blue },
                    { label: "Ongoing (today)", value: status("Ongoing"), color: C.orange },
                    { label: "Cancelled", value: s.cancelled, color: C.red },
                  ]}
                />
              </View>
            </Panel>

            <Panel title="Money received" total={rupees(s.moneyReceived)}>
              <GroupedBarChart<AnalyticsBucket>
                data={data.buckets}
                height={200}
                series={[{ key: "moneyReceived", label: "Received", color: C.green }]}
                value={(b) => b.moneyReceived}
                format={rupees}
                axisLabel={axis}
              />
            </Panel>

            <Panel title="Customer outstanding" total={rupees(s.outstanding)}>
              <GroupedBarChart<AnalyticsBucket>
                data={data.buckets}
                height={200}
                series={[{ key: "outstanding", label: "Unpaid", color: C.orange }]}
                value={(b) => b.outstanding}
                format={rupees}
                axisLabel={axis}
              />
            </Panel>

            <Panel title="Event types" total={`${count(s.events)} events`}>
              <View style={styles.donutBox}>
                {data.eventTypes.length === 0 ? (
                  <Text style={styles.zero}>No events</Text>
                ) : (
                  <DonutChart
                    showShare={false}
                    size={180}
                    strokeWidth={18}
                    centerLabel="Events"
                    centerValue={s.events}
                    segments={data.eventTypes.slice(0, 6).map((t, i) => ({ label: t.name, value: t.events, color: TYPE_COLORS[i] }))
                      .concat(data.eventTypes.length > 6
                        ? [{ label: "Other", value: data.eventTypes.slice(6).reduce((n, t) => n + t.events, 0), color: TYPE_COLORS[7] }]
                        : [])}
                  />
                )}
              </View>
            </Panel>

            <Panel title="Busy days" total={busiest && busiest.events > 0 ? `busiest: ${count(busiest.events)} events` : "no events"}>
              <BusyDaysHeatmap days={data.eventDays} />
            </Panel>
          </View>

          <Pressable onPress={() => setShowDetails(true)} style={styles.detailsLink} accessibilityRole="button">
            <Text style={styles.link}>View details</Text>
            <Ionicons name="arrow-forward" size={16} color={colors.link} />
          </Pressable>
        </View>
      )}
    </Screen>
  );
}

const glow = Platform.OS === "web" ? ({ boxShadow: "0 0 0 1px rgba(77,163,255,0.10), 0 10px 30px rgba(30,110,220,0.10)" } as object) : {};
const webGrid = (min: number) =>
  (Platform.OS === "web"
    ? { display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`, gap: space.md }
    : { flexDirection: "row", flexWrap: "wrap", gap: space.md }) as object;

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md, marginBottom: space.md, flexWrap: "wrap", zIndex: 5 },
  headerPhone: { flexDirection: "column", alignItems: "stretch" },
  brand: { flexDirection: "row", alignItems: "center", gap: space.md, flexShrink: 1, minWidth: 240 },
  logo: { width: 44, height: 44, borderRadius: radius.control, backgroundColor: colors.cardRaised },
  logoInitial: { alignItems: "center", justifyContent: "center", backgroundColor: colors.primarySoft },
  logoInitialText: { fontSize: 20, fontWeight: "800", color: colors.primary },
  studioName: { fontSize: 20, lineHeight: 26, fontWeight: "800", color: colors.text },
  subtitle: { ...type.small, color: colors.textMuted },
  headerRight: { flexDirection: "row", alignItems: "center", gap: space.sm, flexWrap: "wrap", zIndex: 5 },
  exportButton: {
    flexDirection: "row", alignItems: "center", gap: 6, height: 36, paddingHorizontal: space.md, borderRadius: 18,
    backgroundColor: colors.card, ...glow,
  },
  exportText: { ...type.small, fontWeight: "700", color: colors.text },
  exportMenu: {
    position: "absolute", top: 42, right: 0, width: 210, backgroundColor: colors.cardRaised, borderRadius: radius.control,
    paddingVertical: 4, zIndex: 20, ...(Platform.OS === "web" ? ({ boxShadow: "0 12px 32px rgba(0,0,0,0.45)" } as object) : {}),
  },
  exportItem: { paddingVertical: 8, paddingHorizontal: space.md },
  exportItemTitle: { ...type.small, fontWeight: "700", color: colors.text },
  exportItemText: { ...type.caption, color: colors.textMuted },
  customRow: { flexDirection: "row", alignItems: "flex-start", gap: space.md, flexWrap: "wrap", marginBottom: space.md },
  error: { ...type.small, color: colors.danger },

  cards: webGrid(220),
  cardsPhone: webGrid(150),
  card: {
    flexDirection: "row", alignItems: "center", gap: space.md, backgroundColor: colors.card, borderRadius: radius.card,
    paddingVertical: space.md, paddingHorizontal: space.lg, minWidth: 0, ...glow,
  },
  cardCompact: { paddingHorizontal: space.md, paddingVertical: space.sm },
  cardValueCompact: { fontSize: 21, lineHeight: 28 },
  cardIcon: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  cardLabel: { ...type.small, fontWeight: "600", color: colors.textMuted },
  cardValue: { fontSize: 28, lineHeight: 34, fontWeight: "800", color: colors.text, fontVariant: ["tabular-nums"] },
  cardRule: { ...type.caption, color: colors.textFaint },

  grid: { gap: space.md },
  gridWide: (Platform.OS === "web"
    ? { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: space.md }
    : { flexDirection: "row", flexWrap: "wrap" }) as object,
  panel: { backgroundColor: colors.card, borderRadius: radius.card, padding: space.lg, gap: space.sm, minWidth: 0, ...glow },
  panelHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: space.md },
  panelTitle: { ...type.body, fontWeight: "700", color: colors.text },
  panelTotal: { ...type.small, fontWeight: "700", color: colors.textMuted, fontVariant: ["tabular-nums"] },
  axis: { ...type.caption, fontSize: 11, color: colors.textMuted, paddingLeft: 2 },
  donutBox: { minHeight: 236, justifyContent: "center" },
  zero: { ...type.body, color: colors.textMuted, textAlign: "center" },

  detailsLink: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "center", paddingVertical: space.sm },
  backLink: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start" },
  link: { ...type.small, fontWeight: "700", color: colors.link },
});
