import { View, Text, StyleSheet, ScrollView } from "react-native";
import type { AnalyticsBucket, AnalyticsReport } from "../../types/analytics";
import { useBreakpoint } from "../../ui/useBreakpoint";
import { colors, radius, space, type } from "../../ui/theme";

const rupees = (v: number) => `${v < 0 ? "−" : ""}₹${Math.abs(Math.round(v)).toLocaleString("en-IN")}`;
const count = (n: number) => n.toLocaleString("en-IN");
const date = (v: string) => new Date(v).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

const PERIOD_COLUMNS: { key: keyof AnalyticsBucket; label: string; money?: boolean }[] = [
  { key: "newBookings", label: "Bookings" },
  { key: "events", label: "Events" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
  { key: "eventValue", label: "Event value", money: true },
  { key: "moneyReceived", label: "Received", money: true },
  { key: "outstanding", label: "Customers owe", money: true },
];

function Table({ head, rows, total, minWidth }: { head: string[]; rows: (string | number)[][]; total?: (string | number)[]; minWidth: number }) {
  const cell = (v: string | number, i: number, bold?: boolean) => (
    <Text key={i} style={[i === 0 ? styles.first : styles.num, bold && styles.bold]} numberOfLines={1}>{v}</Text>
  );
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ minWidth: "100%" }}>
      <View style={{ minWidth, flex: 1 }}>
        <View style={[styles.row, styles.headRow]}>{head.map((h, i) => <Text key={h} style={[i === 0 ? styles.first : styles.num, styles.head]}>{h}</Text>)}</View>
        {rows.map((r, k) => <View key={k} style={styles.row}>{r.map((v, i) => cell(v, i))}</View>)}
        {total && <View style={[styles.row, styles.totalRow]}>{total.map((v, i) => cell(v, i, true))}</View>}
      </View>
    </ScrollView>
  );
}

// The figures behind the charts, as tables - kept off the main overview.
export function ReportDetails({ data }: { data: AnalyticsReport }) {
  const { isPhone } = useBreakpoint();
  const s = data.summary;
  const p = data.profit;
  return (
    <View style={{ gap: space.lg }}>
      <Text style={styles.note}>Bookings count by booking date, events by event date, money by payment date.</Text>

      <View style={styles.card}>
        <Text style={styles.title}>By {data.grouping === "Day" ? "day" : "month"}</Text>
        <Table
          minWidth={760}
          head={[data.grouping === "Day" ? "Date" : "Month", ...PERIOD_COLUMNS.map((c) => c.label)]}
          rows={data.buckets.map((b) => [b.label, ...PERIOD_COLUMNS.map((c) => (c.money ? rupees(b[c.key] as number) : count(b[c.key] as number)))])}
          total={["Total", ...PERIOD_COLUMNS.map((c) => {
            const v = s[c.key as keyof typeof s] as number;
            return c.money ? rupees(v) : count(v);
          })]}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Event types</Text>
        <Table
          minWidth={isPhone ? 560 : 0}
          head={["Type", "Events", "Completed", "Cancelled", "Value", "Received"]}
          rows={data.eventTypes.map((t) => [t.name, count(t.events), count(t.completed), count(t.cancelled), rupees(t.eventValue), rupees(t.received)])}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Events</Text>
        {p.events.length === 0 ? (
          <Text style={styles.note}>No events dated in this period.</Text>
        ) : (
          <Table
            minWidth={760}
            head={["Event", "Event total", "Expenses", "Received", "Customer owes"]}
            rows={p.events.map((e) => [`${date(e.eventDate)} · ${e.customerName}`, rupees(e.eventTotal), rupees(e.expenses), rupees(e.collectedRevenue), rupees(e.outstandingBalance)])}
            total={[`${count(p.events.length)} events`, rupees(p.eventsTotalAmount), rupees(p.eventsExpenses), rupees(p.events.reduce((n, e) => n + e.collectedRevenue, 0)), rupees(p.eventsOutstandingBalance)]}
          />
        )}
      </View>

      {p.expensesByCategory.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.title}>Expenses by category</Text>
          <Table
            minWidth={0}
            head={["Category", "Amount"]}
            rows={p.expensesByCategory.map((c) => [c.categoryName, rupees(c.totalAmount)])}
            total={["Total", rupees(p.expensesByCategory.reduce((n, c) => n + c.totalAmount, 0))]}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  note: { ...type.small, color: colors.textMuted },
  card: { backgroundColor: colors.card, borderRadius: radius.card, padding: space.lg, gap: space.sm },
  title: { ...type.heading, color: colors.text },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 38, borderTopWidth: 1, borderTopColor: colors.border },
  headRow: { minHeight: 30, borderTopWidth: 0 },
  totalRow: { borderTopWidth: 2, borderTopColor: colors.borderStrong },
  head: { ...type.caption, fontWeight: "700", color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.4 },
  first: { flex: 2.2, minWidth: 0, ...type.small, color: colors.text },
  num: { flex: 1, minWidth: 80, textAlign: "right", ...type.small, color: colors.text, fontVariant: ["tabular-nums"] },
  bold: { fontWeight: "700" },
});
