import { useState } from "react";
import { View, Text, StyleSheet, Platform, ScrollView } from "react-native";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { reportsApi } from "../../api/reportsApi";
import { extractErrorMessage } from "../../api/errorMessage";
import type { EventProfit } from "../../types/profitReport";
import type { AnalyticsBucket, ReportPreset, ReportRange } from "../../types/analytics";
import { useRefetchOnFocus } from "../../hooks/useRefetchOnFocus";
import { MiniDatePicker } from "../../components/MiniDatePicker";
import { GroupedBarChart } from "../../components/GroupedBarChart";
import { DonutChart } from "../../components/DonutChart";
import { downloadAndSharePdf } from "../../utils/downloadPdf";
import { Screen } from "../../ui/Screen";
import { PageHeader } from "../../ui/PageHeader";
import { FilterChips } from "../../ui/FilterChips";
import { EmptyState } from "../../ui/EmptyState";
import { Button } from "../../ui/Button";
import { Skeleton } from "../../ui/Skeleton";
import { useBreakpoint } from "../../ui/useBreakpoint";
import { colors, radius, space, type } from "../../ui/theme";

const PRESETS: { value: ReportPreset; label: string }[] = [
  { value: "Last7Days", label: "Last 7 days" },
  { value: "Last1Month", label: "Last 1 month" },
  { value: "Last3Months", label: "Last 3 months" },
  { value: "Last6Months", label: "Last 6 months" },
  { value: "Last1Year", label: "Last 1 year" },
  { value: "Custom", label: "Custom range" },
];

const STATUS_COLORS: Record<string, string> = {
  Upcoming: "#f2bd5c",
  Ongoing: "#7fc0e6",
  Confirmed: "#a78bfa",
  Completed: "#4cc493",
  Cancelled: "#ff7a72",
};

function formatCurrency(value: number): string {
  const amount = `₹${Math.abs(value).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  return value < 0 ? `−${amount}` : amount;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
}

const count = (n: number) => n.toLocaleString("en-IN");

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Short labels under the bars: "22", with the month on the first bar and on the 1st ("1 Oct");
// months as "Oct", with the year on the first bar and on January ("Jan '26").
function axisLabelFor(grouping: "Day" | "Month") {
  return (b: AnalyticsBucket, i: number) => {
    const [y, m, d] = b.start.slice(0, 10).split("-").map(Number);
    if (grouping === "Day") return i === 0 || d === 1 ? `${d} ${MONTHS[m - 1]}` : String(d);
    return i === 0 || m === 1 ? `${MONTHS[m - 1]} '${String(y).slice(2)}` : MONTHS[m - 1];
  };
}

function profitTone(value: number): string {
  return value > 0 ? colors.success : value < 0 ? colors.danger : colors.text;
}

function StatTile({ label, value, hint, tone }: { label: string; value: string; hint: string; tone?: string }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={[styles.tileValue, tone ? { color: tone } : null]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={styles.tileHint}>{hint}</Text>
    </View>
  );
}

function Card({ title, note, children, style }: { title: string; note?: string; children: React.ReactNode; style?: object }) {
  return (
    <View style={[styles.card, style]}>
      <View style={{ gap: 2 }}>
        <Text style={styles.cardTitle}>{title}</Text>
        {note ? <Text style={styles.cardNote}>{note}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function EventRow({ event, wide }: { event: EventProfit; wide: boolean }) {
  if (wide) {
    return (
      <View style={styles.row}>
        <View style={styles.colEvent}>
          <Text style={styles.rowTitle} numberOfLines={1}>{event.customerName}</Text>
          <Text style={styles.rowSub} numberOfLines={1}>{formatDate(event.eventDate)}{event.venue ? ` · ${event.venue}` : ""}</Text>
        </View>
        <Text style={styles.colMoney}>{formatCurrency(event.eventTotal)}</Text>
        <View style={styles.colMoneyBox}>
          <Text style={styles.moneyText}>{formatCurrency(event.expenses)}</Text>
          {event.pendingExpenses > 0 ? <Text style={styles.moneyNote}>{formatCurrency(event.pendingExpenses)} to pay</Text> : null}
        </View>
        <Text style={[styles.colMoney, styles.colProfit, { color: profitTone(event.netProfit) }]}>{formatCurrency(event.netProfit)}</Text>
        <Text style={styles.colMoney}>{formatCurrency(event.collectedRevenue)}</Text>
        <Text style={[styles.colMoney, event.outstandingBalance > 0 ? { color: colors.warning } : null]}>{formatCurrency(event.outstandingBalance)}</Text>
      </View>
    );
  }
  return (
    <View style={styles.eventCard}>
      <Text style={styles.rowTitle} numberOfLines={1}>{event.customerName}</Text>
      <Text style={styles.rowSub} numberOfLines={1}>{formatDate(event.eventDate)}{event.venue ? ` · ${event.venue}` : ""}</Text>
      <View style={styles.eventFigures}>
        <Figure label="Event total" value={formatCurrency(event.eventTotal)} />
        <Figure label="Expenses" value={formatCurrency(event.expenses)} />
        <Figure label={event.netProfit < 0 ? "Loss" : "Profit"} value={formatCurrency(Math.abs(event.netProfit))} tone={profitTone(event.netProfit)} />
      </View>
      <View style={styles.eventFigures}>
        <Figure label="Received" value={formatCurrency(event.collectedRevenue)} />
        <Figure label="Customer owes" value={formatCurrency(event.outstandingBalance)} tone={event.outstandingBalance > 0 ? colors.warning : undefined} />
        <Figure label="Expenses to pay" value={formatCurrency(event.pendingExpenses)} tone={event.pendingExpenses > 0 ? colors.warning : undefined} />
      </View>
    </View>
  );
}

function Figure({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text style={styles.figureLabel}>{label}</Text>
      <Text style={[styles.figureValue, tone ? { color: tone } : null]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    </View>
  );
}

// The day/month table: one row per period of the range (zero rows included), then the totals.
const TABLE_COLUMNS: { key: keyof AnalyticsBucket; label: string; money?: boolean }[] = [
  { key: "newBookings", label: "New bookings" },
  { key: "events", label: "Events" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
  { key: "pending", label: "Pending" },
  { key: "eventValue", label: "Event value", money: true },
  { key: "moneyReceived", label: "Received", money: true },
  { key: "expenses", label: "Expenses", money: true },
  { key: "profit", label: "Profit", money: true },
];

export function ReportsScreen() {
  const { isPhone, isDesktop } = useBreakpoint();
  // `range` is what the report shows; the custom dates are a draft until Apply is pressed.
  const [range, setRange] = useState<ReportRange>({ preset: "Last1Month" });
  const [choosingCustom, setChoosingCustom] = useState(false);
  const [draftStart, setDraftStart] = useState("");
  const [draftEnd, setDraftEnd] = useState("");
  const [customError, setCustomError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // One request feeds every card, chart, table and list, so they always change together. The
  // range is the query key: a newer range cancels the older request instead of racing it.
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
    if (!draftStart || !draftEnd) {
      setCustomError("Choose both a start date and an end date.");
      return;
    }
    if (draftStart > draftEnd) {
      setCustomError("The start date can't be after the end date.");
      return;
    }
    setCustomError(null);
    setRange({ preset: "Custom", customStart: draftStart, customEnd: draftEnd });
  };

  const exportPdf = async () => {
    setExporting(true);
    setExportError(null);
    try {
      const bytes = await reportsApi.exportAnalytics(range);
      const name = data ? `studio-report-${data.rangeStart.slice(0, 10)}-to-${data.rangeLastDay.slice(0, 10)}.pdf` : "studio-report.pdf";
      await downloadAndSharePdf(bytes, name);
    } catch (err) {
      setExportError(extractErrorMessage(err, "Couldn't export the report."));
    } finally {
      setExporting(false);
    }
  };

  const unit = data?.grouping === "Day" ? "day" : "month";
  const subtitle = data
    ? `${formatDate(data.rangeStart)} – ${formatDate(data.rangeLastDay)} · by ${unit}`
    : "Bookings, events and money for the period you choose.";
  const updating = isFetching && isPlaceholderData;
  const activeChip: ReportPreset = choosingCustom ? "Custom" : range.preset;

  return (
    <Screen>
      <PageHeader
        title="Reports"
        subtitle={subtitle}
        actions={<Button label="Export PDF" icon="document-text-outline" onPress={exportPdf} loading={exporting} disabled={!data || updating} />}
      />

      <View style={{ marginBottom: space.md }}>
        <FilterChips<ReportPreset> options={PRESETS} value={activeChip} onChange={choosePreset} />
      </View>

      {choosingCustom && (
        <View style={styles.customBox}>
          <View style={styles.customRangeRow}>
            <MiniDatePicker label="Start date" value={draftStart} onChange={(v) => { setDraftStart(v); setCustomError(null); }} />
            <Ionicons name="arrow-forward" size={16} color={colors.textMuted} style={{ marginTop: 22 }} />
            <MiniDatePicker label="End date" value={draftEnd} onChange={(v) => { setDraftEnd(v); setCustomError(null); }} />
            <View style={{ marginTop: 18 }}>
              <Button label="Apply" variant="primary" onPress={applyCustom} />
            </View>
          </View>
          {customError ? <Text style={styles.error}>{customError}</Text> : <Text style={styles.cardNote}>Both dates are included.</Text>}
        </View>
      )}
      {exportError ? <Text style={[styles.error, { marginBottom: space.md }]}>{exportError}</Text> : null}

      {isPending ? (
        <View style={styles.grid}>
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} height={104} rounded={radius.card} />)}
        </View>
      ) : isError || !data ? (
        <EmptyState icon="cloud-offline-outline" title="Couldn't load the report" text={extractErrorMessage(error, "Check your connection and try again.")}
          action={<Button label="Try again" onPress={() => refetch()} />} />
      ) : (
        <View style={[{ gap: space.lg }, updating && styles.updating]}>
          {updating && <Text style={styles.updatingText}>Updating…</Text>}

          <View style={{ gap: space.md }}>
            <View style={[styles.grid, isPhone && styles.gridPhone]}>
              <StatTile label="New bookings" value={count(data.summary.newBookings)} hint="Events booked in this period" />
              <StatTile label="Events" value={count(data.summary.events)} hint="Events dated in this period" />
              <StatTile label="Completed" value={count(data.summary.completed)} hint="Already done" tone={colors.success} />
              <StatTile label="Cancelled" value={count(data.summary.cancelled)} hint="Called off" tone={data.summary.cancelled > 0 ? colors.danger : undefined} />
              <StatTile label="Pending" value={count(data.summary.pending)} hint="Still to happen" tone={data.summary.pending > 0 ? colors.warning : undefined} />
            </View>
            <View style={[styles.grid, isPhone && styles.gridPhone]}>
              <StatTile label="Event value" value={formatCurrency(data.summary.eventValue)} hint="Agreed totals, cancelled left out" />
              <StatTile label="Money received" value={formatCurrency(data.summary.moneyReceived)} hint="Payments received" tone={colors.success} />
              <StatTile label="Expenses" value={formatCurrency(data.summary.expenses)} hint="Money spent" tone={data.summary.expenses > 0 ? colors.danger : undefined} />
              <StatTile label="Profit" value={formatCurrency(data.summary.profit)} hint="Received minus expenses" tone={profitTone(data.summary.profit)} />
              <StatTile label="Customers owe" value={formatCurrency(data.summary.customersOwe)} hint="Unpaid on these events" tone={data.summary.customersOwe > 0 ? colors.warning : undefined} />
            </View>
          </View>

          <View style={[styles.sections, isDesktop && styles.sectionsWide]}>
            <Card title={`Events by ${unit}`} note="New bookings by booking date; completed and pending by event date." style={isDesktop ? { flex: 1 } : undefined}>
              <GroupedBarChart<AnalyticsBucket>
                data={data.buckets}
                series={[
                  { key: "newBookings", label: "New bookings", color: "#7fc0e6" },
                  { key: "completed", label: "Completed", color: "#4cc493" },
                  { key: "pending", label: "Pending", color: "#f2bd5c" },
                ]}
                value={(b, k) => b[k as keyof AnalyticsBucket] as number}
                format={count}
                axisLabel={axisLabelFor(data.grouping)}
              />
            </Card>
            <Card title={`Cancellations by ${unit}`} note="Cancelled events, by event date." style={isDesktop ? { flex: 1 } : undefined}>
              <GroupedBarChart<AnalyticsBucket>
                data={data.buckets}
                series={[{ key: "cancelled", label: "Cancelled", color: "#ff7a72" }]}
                value={(b) => b.cancelled}
                format={count}
                axisLabel={axisLabelFor(data.grouping)}
              />
            </Card>
          </View>

          <Card title={`Money by ${unit}`} note="Payments received and expenses, by their own dates.">
            <GroupedBarChart<AnalyticsBucket>
              data={data.buckets}
              series={[
                { key: "moneyReceived", label: "Received", color: "#4cc493" },
                { key: "expenses", label: "Expenses", color: "#ff7a72" },
              ]}
              value={(b, k) => b[k as keyof AnalyticsBucket] as number}
              format={formatCurrency}
              extra={(b) => `Profit: ${formatCurrency(b.profit)}`}
              axisLabel={axisLabelFor(data.grouping)}
              height={220}
            />
          </Card>

          <View style={[styles.sections, isDesktop && styles.sectionsWide]}>
            <Card title="Status of events" note="Events dated in this period." style={isDesktop ? { flex: 2 } : undefined}>
              {data.summary.events === 0 ? (
                <Text style={styles.empty}>No events dated in this period.</Text>
              ) : (
                <DonutChart
                  showShare={false}
                  centerLabel="Events"
                  centerValue={data.summary.events}
                  segments={data.statuses.map((s) => ({ label: s.status, value: s.count, color: STATUS_COLORS[s.status] ?? colors.textMuted }))}
                />
              )}
            </Card>
            <Card title="Event types" note="Events dated in this period, by type." style={isDesktop ? { flex: 3 } : undefined}>
              {data.eventTypes.length === 0 ? (
                <Text style={styles.empty}>No events dated in this period.</Text>
              ) : (
                <View>
                  <View style={[styles.row, styles.headRow]}>
                    <Text style={[styles.headText, styles.colEvent]}>Type</Text>
                    <Text style={[styles.headText, styles.colNum]}>Events</Text>
                    {!isPhone && <Text style={[styles.headText, styles.colNum]}>Done</Text>}
                    {!isPhone && <Text style={[styles.headText, styles.colNum]}>Cancelled</Text>}
                    <Text style={[styles.headText, styles.colMoney]}>Value</Text>
                    {!isPhone && <Text style={[styles.headText, styles.colMoney]}>Received</Text>}
                  </View>
                  {data.eventTypes.map((t) => (
                    <View key={t.name} style={styles.row}>
                      <Text style={[styles.rowTitle, styles.colEvent]} numberOfLines={1}>{t.name}</Text>
                      <Text style={styles.colNum}>{count(t.events)}</Text>
                      {!isPhone && <Text style={styles.colNum}>{count(t.completed)}</Text>}
                      {!isPhone && <Text style={[styles.colNum, t.cancelled > 0 ? { color: colors.danger } : null]}>{count(t.cancelled)}</Text>}
                      <Text style={styles.colMoney}>{formatCurrency(t.eventValue)}</Text>
                      {!isPhone && <Text style={styles.colMoney}>{formatCurrency(t.received)}</Text>}
                    </View>
                  ))}
                </View>
              )}
            </Card>
          </View>

          <Card title="Business insights">
            <View style={{ gap: space.sm }}>
              {data.insights.map((line) => (
                <View key={line} style={styles.insight}>
                  <Ionicons name="bulb-outline" size={16} color={colors.primary} style={{ marginTop: 2 }} />
                  <Text style={styles.insightText}>{line}</Text>
                </View>
              ))}
            </View>
          </Card>

          <Card title={`By ${unit}`} note="Every period of the range, including ones with nothing recorded.">
            <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ minWidth: "100%" }}>
              <View style={{ minWidth: 980, flex: 1 }}>
                <View style={[styles.row, styles.headRow]}>
                  <Text style={[styles.headText, styles.colPeriod]}>{unit === "day" ? "Date" : "Month"}</Text>
                  {TABLE_COLUMNS.map((c) => (
                    <Text key={c.key} style={[styles.headText, c.money ? styles.colMoney : styles.colNum]}>{c.label}</Text>
                  ))}
                </View>
                {data.buckets.map((b) => (
                  <View key={b.start} style={[styles.row, styles.tableRow]}>
                    <Text style={[styles.rowTitle, styles.colPeriod]}>{b.label}</Text>
                    {TABLE_COLUMNS.map((c) => {
                      const v = b[c.key] as number;
                      return (
                        <Text key={c.key} style={[c.money ? styles.colMoney : styles.colNum, v === 0 && styles.zero,
                          c.key === "profit" && v !== 0 ? { color: profitTone(v) } : null]}>
                          {c.money ? formatCurrency(v) : count(v)}
                        </Text>
                      );
                    })}
                  </View>
                ))}
                <View style={[styles.row, styles.totalRow]}>
                  <Text style={[styles.rowTitle, styles.colPeriod]}>Total</Text>
                  {TABLE_COLUMNS.map((c) => {
                    const v = data.summary[c.key as keyof typeof data.summary] as number;
                    return (
                      <Text key={c.key} style={[c.money ? styles.colMoney : styles.colNum, styles.colProfit]}>
                        {c.money ? formatCurrency(v) : count(v)}
                      </Text>
                    );
                  })}
                </View>
              </View>
            </ScrollView>
          </Card>

          <View style={[styles.sections, isDesktop && styles.sectionsWide]}>
            <Card
              title="Profit by event"
              note={`The event's agreed total minus its expenses, whether or not the customer has paid yet.${data.profit.events.length > 0 ? ` These ${data.profit.events.length} events: ${formatCurrency(data.profit.eventsTotalAmount)} agreed, ${formatCurrency(data.profit.eventsExpenses)} expenses, ${formatCurrency(data.profit.eventsNetProfit)} profit.` : ""}`}
              style={isDesktop ? { flex: 3 } : undefined}
            >
              {data.profit.events.length === 0 ? (
                <Text style={styles.empty}>No events dated in this period.</Text>
              ) : isPhone ? (
                <View style={{ gap: space.sm }}>
                  {data.profit.events.map((e) => <EventRow key={e.eventId} event={e} wide={false} />)}
                </View>
              ) : (
                <View>
                  <View style={[styles.row, styles.headRow]}>
                    <Text style={[styles.headText, styles.colEvent]}>Event</Text>
                    <Text style={[styles.headText, styles.colMoney]}>Event total</Text>
                    <Text style={[styles.headText, styles.colMoney]}>Expenses</Text>
                    <Text style={[styles.headText, styles.colMoney]}>Profit</Text>
                    <Text style={[styles.headText, styles.colMoney]}>Received</Text>
                    <Text style={[styles.headText, styles.colMoney]}>Customer owes</Text>
                  </View>
                  {data.profit.events.map((e) => <EventRow key={e.eventId} event={e} wide />)}
                </View>
              )}
            </Card>

            <Card title="Expenses by category" style={isDesktop ? { flex: 2 } : undefined}>
              {data.profit.expensesByCategory.length === 0 ? (
                <Text style={styles.empty}>No expenses recorded in this period.</Text>
              ) : (
                <View style={{ gap: space.md }}>
                  {data.profit.expensesByCategory.map((c) => {
                    const max = Math.max(1, ...data.profit.expensesByCategory.map((x) => x.totalAmount));
                    return (
                      <View key={c.categoryName} style={{ gap: 6 }}>
                        <View style={styles.categoryHeader}>
                          <Text style={styles.categoryName} numberOfLines={1}>{c.categoryName}</Text>
                          <Text style={styles.categoryAmount}>{formatCurrency(c.totalAmount)}</Text>
                        </View>
                        <View style={styles.categoryBarTrack}>
                          <View style={[styles.categoryBarFill, { width: `${(c.totalAmount / max) * 100}%` }]} />
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </Card>
          </View>
        </View>
      )}
    </Screen>
  );
}

const webGrid = (min: number) =>
  (Platform.OS === "web"
    ? { display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`, gap: space.md }
    : { flexDirection: "row", flexWrap: "wrap", gap: space.md }) as object;

const styles = StyleSheet.create({
  customBox: { gap: space.xs, marginBottom: space.lg },
  customRangeRow: { flexDirection: "row", alignItems: "flex-start", gap: space.md, flexWrap: "wrap" },
  error: { ...type.small, color: colors.danger },
  updating: { opacity: 0.55 },
  updatingText: { ...type.small, color: colors.textMuted },
  grid: webGrid(180),
  gridPhone: webGrid(140),
  tile: {
    flexGrow: 1, minWidth: 140, backgroundColor: colors.card, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border,
    padding: space.lg, gap: 2,
  },
  tileLabel: { ...type.small, fontWeight: "600", color: colors.textMuted },
  tileValue: { fontSize: 24, lineHeight: 32, fontWeight: "700", color: colors.text, fontVariant: ["tabular-nums"] },
  tileHint: { ...type.caption, color: colors.textFaint },

  sections: { gap: space.lg },
  sectionsWide: { flexDirection: "row", alignItems: "stretch" },
  card: { backgroundColor: colors.card, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, padding: space.lg, gap: space.md, minWidth: 0 },
  cardTitle: { ...type.heading, color: colors.text },
  cardNote: { ...type.small, color: colors.textMuted },
  empty: { ...type.body, color: colors.textMuted },

  insight: { flexDirection: "row", gap: space.sm, alignItems: "flex-start" },
  insightText: { ...type.body, color: colors.text, flex: 1 },

  row: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 48, paddingVertical: space.sm, borderTopWidth: 1, borderTopColor: colors.border },
  tableRow: { minHeight: 40, paddingVertical: 6 },
  totalRow: { borderTopWidth: 2, borderTopColor: colors.borderStrong },
  headRow: { minHeight: 32, paddingVertical: 0, borderTopWidth: 0 },
  headText: { ...type.caption, fontWeight: "700", color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.4 },
  colEvent: { flex: 2, minWidth: 0 },
  colPeriod: { width: 110 },
  colNum: { flex: 1, minWidth: 76, textAlign: "right", ...type.small, color: colors.text, fontVariant: ["tabular-nums"] },
  colMoney: { flex: 1.3, minWidth: 90, textAlign: "right", ...type.small, color: colors.text, fontVariant: ["tabular-nums"] },
  colProfit: { fontWeight: "700" },
  zero: { color: colors.textFaint },
  colMoneyBox: { flex: 1.3, minWidth: 0, alignItems: "flex-end" },
  moneyText: { ...type.small, color: colors.text, fontVariant: ["tabular-nums"] },
  moneyNote: { ...type.caption, color: colors.textMuted, fontVariant: ["tabular-nums"] },
  rowTitle: { ...type.small, fontWeight: "600", color: colors.text },
  rowSub: { ...type.caption, color: colors.textMuted },
  eventCard: { backgroundColor: colors.cardRaised, borderRadius: radius.control, padding: space.md, gap: 2 },
  eventFigures: { flexDirection: "row", gap: space.md, marginTop: space.sm },
  figureLabel: { ...type.caption, color: colors.textMuted },
  figureValue: { ...type.body, fontWeight: "700", color: colors.text, fontVariant: ["tabular-nums"] },

  categoryHeader: { flexDirection: "row", justifyContent: "space-between", gap: space.md },
  categoryName: { ...type.body, fontWeight: "600", color: colors.text, flex: 1 },
  categoryAmount: { ...type.body, color: colors.text, fontVariant: ["tabular-nums"] },
  categoryBarTrack: { height: 8, borderRadius: 4, backgroundColor: colors.cardRaised, overflow: "hidden" },
  categoryBarFill: { height: 8, borderRadius: 4, backgroundColor: colors.primary },
});
