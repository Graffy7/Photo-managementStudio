import { useState } from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { reportsApi } from "../../api/reportsApi";
import { DATE_RANGE_PRESET_LABELS, type DateRangePreset } from "../../types/studioDashboard";
import type { EventProfit } from "../../types/profitReport";
import { useRefetchOnFocus } from "../../hooks/useRefetchOnFocus";
import { MiniDatePicker } from "../../components/MiniDatePicker";
import { Screen } from "../../ui/Screen";
import { PageHeader } from "../../ui/PageHeader";
import { FilterChips } from "../../ui/FilterChips";
import { EmptyState } from "../../ui/EmptyState";
import { Button } from "../../ui/Button";
import { Skeleton } from "../../ui/Skeleton";
import { useBreakpoint } from "../../ui/useBreakpoint";
import { colors, radius, space, type } from "../../ui/theme";

const REPORT_PRESETS: DateRangePreset[] = ["Today", "ThisWeek", "ThisMonth", "PreviousYear", "Custom"];

function formatCurrency(value: number): string {
  const amount = `₹${Math.abs(value).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  return value < 0 ? `−${amount}` : amount;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
}

function profitTone(value: number): string {
  return value > 0 ? colors.success : value < 0 ? colors.danger : colors.text;
}

// One figure: what it is, the amount, and a plain-words line on how it is worked out.
function StatTile({ label, value, hint, tone }: { label: string; value: string; hint: string; tone?: string }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={[styles.tileValue, tone ? { color: tone } : null]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={styles.tileHint}>{hint}</Text>
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
        <View style={styles.colMoneyBox}>
          <Text style={[styles.moneyText, styles.colProfit, { color: profitTone(event.netProfit) }]}>{formatCurrency(event.netProfit)}</Text>
          {event.profitMarginPercent !== null ? <Text style={styles.moneyNote}>{event.profitMarginPercent}%</Text> : null}
        </View>
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
        <Figure label={event.netProfit < 0 ? "Loss" : "Profit"} value={`${formatCurrency(Math.abs(event.netProfit))}${event.profitMarginPercent !== null ? ` (${event.profitMarginPercent}%)` : ""}`} tone={profitTone(event.netProfit)} />
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

export function ReportsScreen() {
  const { isPhone, isDesktop } = useBreakpoint();
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
  const range = data ? `${formatDate(data.rangeStart)} – ${formatDate(data.rangeEnd)}` : null;

  return (
    <Screen>
      <PageHeader title="Reports" subtitle={range ?? "Money in, money out and profit for the period you choose."} />

      <View style={{ marginBottom: space.lg }}>
        <FilterChips<DateRangePreset>
          options={REPORT_PRESETS.map((p) => ({ value: p, label: DATE_RANGE_PRESET_LABELS[p] }))}
          value={preset}
          onChange={setPreset}
        />
      </View>

      {preset === "Custom" && (
        <View style={styles.customRangeRow}>
          <MiniDatePicker label="From" value={customStart} onChange={setCustomStart} />
          <Ionicons name="arrow-forward" size={16} color={colors.textMuted} style={{ marginTop: 22 }} />
          <MiniDatePicker label="To" value={customEnd} onChange={setCustomEnd} />
        </View>
      )}

      {preset === "Custom" && !customRangeReady ? (
        <EmptyState icon="calendar-outline" title="Choose the dates" text="Pick a From date and a To date above to see the report for that period." />
      ) : isPending ? (
        <View style={styles.grid}>
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} height={104} rounded={radius.card} />)}
        </View>
      ) : isError || !data ? (
        <EmptyState icon="cloud-offline-outline" title="Couldn't load the report" text="Check your connection and try again."
          action={<Button label="Try again" onPress={() => refetch()} />} />
      ) : (
        <>
          <View style={[styles.grid, isPhone && styles.gridPhone]}>
            <StatTile label="Money received" value={formatCurrency(data.totalCollectedRevenue)} hint="Payments collected from customers" tone={colors.success} />
            <StatTile label="Expenses" value={formatCurrency(data.totalExpenses)} hint="Money the studio spent" tone={data.totalExpenses > 0 ? colors.danger : undefined} />
            <StatTile label="Profit" value={formatCurrency(data.totalCashProfit)} hint="Money received minus expenses" tone={profitTone(data.totalCashProfit)} />
            <StatTile label="Quotation value" value={formatCurrency(data.totalQuotationValue)} hint="Total of quotations in this period" />
            <StatTile label="Expected profit" value={formatCurrency(data.totalExpectedProfit)} hint="Quotation value minus expenses" tone={profitTone(data.totalExpectedProfit)} />
          </View>

          <View style={[styles.sections, isDesktop && styles.sectionsWide]}>
            <View style={[styles.card, isDesktop && { flex: 3 }]}>
              <Text style={styles.cardTitle}>Profit by event</Text>
              <Text style={styles.cardNote}>
                Profit here is the event's agreed total minus its expenses, whether or not the customer has paid yet.
                {data.events.length > 0 ? ` These ${data.events.length} events: ${formatCurrency(data.eventsTotalAmount)} agreed, ${formatCurrency(data.eventsExpenses)} expenses, ${formatCurrency(data.eventsNetProfit)} profit.` : ""}
              </Text>
              {data.events.length === 0 ? (
                <Text style={styles.empty}>No events with payments or expenses in this period.</Text>
              ) : isPhone ? (
                <View style={{ gap: space.sm }}>
                  {data.events.map((e) => <EventRow key={e.eventId} event={e} wide={false} />)}
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
                  {data.events.map((e) => <EventRow key={e.eventId} event={e} wide />)}
                </View>
              )}
            </View>

            <View style={[styles.card, isDesktop && { flex: 2 }]}>
              <Text style={styles.cardTitle}>Expenses by category</Text>
              {data.expensesByCategory.length === 0 ? (
                <Text style={styles.empty}>No expenses recorded in this period.</Text>
              ) : (
                <View style={{ gap: space.md }}>
                  {data.expensesByCategory.map((c) => (
                    <View key={c.categoryName} style={{ gap: 6 }}>
                      <View style={styles.categoryHeader}>
                        <Text style={styles.categoryName} numberOfLines={1}>{c.categoryName}</Text>
                        <Text style={styles.categoryAmount}>{formatCurrency(c.totalAmount)}</Text>
                      </View>
                      <View style={styles.categoryBarTrack}>
                        <View style={[styles.categoryBarFill, { width: `${(c.totalAmount / maxCategoryAmount) * 100}%` }]} />
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        </>
      )}
    </Screen>
  );
}

const webGrid = (min: number) =>
  (Platform.OS === "web"
    ? { display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`, gap: space.md }
    : { flexDirection: "row", flexWrap: "wrap", gap: space.md }) as object;

const styles = StyleSheet.create({
  customRangeRow: { flexDirection: "row", alignItems: "flex-start", gap: space.md, marginBottom: space.lg, flexWrap: "wrap" },
  grid: webGrid(200),
  gridPhone: webGrid(150),
  tile: {
    flexGrow: 1, minWidth: 150, backgroundColor: colors.card, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border,
    padding: space.lg, gap: 2,
  },
  tileLabel: { ...type.small, fontWeight: "600", color: colors.textMuted },
  tileValue: { fontSize: 24, lineHeight: 32, fontWeight: "700", color: colors.text, fontVariant: ["tabular-nums"] },
  tileHint: { ...type.caption, color: colors.textFaint },

  sections: { gap: space.lg, marginTop: space.lg },
  sectionsWide: { flexDirection: "row", alignItems: "flex-start" },
  card: { backgroundColor: colors.card, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, padding: space.lg, gap: space.md, minWidth: 0 },
  cardTitle: { ...type.heading, color: colors.text },
  empty: { ...type.body, color: colors.textMuted },

  row: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 52, paddingVertical: space.sm, borderTopWidth: 1, borderTopColor: colors.border },
  headRow: { minHeight: 32, paddingVertical: 0, borderTopWidth: 0 },
  headText: { ...type.caption, fontWeight: "700", color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.4 },
  colEvent: { flex: 2, minWidth: 0 },
  colMoney: { flex: 1, minWidth: 0, textAlign: "right", ...type.small, color: colors.text, fontVariant: ["tabular-nums"] },
  colProfit: { fontWeight: "700" },
  colMoneyBox: { flex: 1, minWidth: 0, alignItems: "flex-end" },
  moneyText: { ...type.small, color: colors.text, fontVariant: ["tabular-nums"] },
  moneyNote: { ...type.caption, color: colors.textMuted, fontVariant: ["tabular-nums"] },
  cardNote: { ...type.small, color: colors.textMuted, marginTop: -space.sm },
  rowTitle: { ...type.body, fontWeight: "600", color: colors.text },
  rowSub: { ...type.small, color: colors.textMuted },
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
