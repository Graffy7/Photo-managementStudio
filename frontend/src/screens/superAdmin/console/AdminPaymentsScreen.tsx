import { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, useWindowDimensions } from "react-native";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { adminConsoleApi } from "../../../api/adminConsoleApi";
import { SearchInput } from "../../../components/SearchInput";
import { useRefetchOnFocus } from "../../../hooks/useRefetchOnFocus";
import { C, Card, Chips, DateRange, EmptyState, ErrorState, Loading, PageHeader, Pagination, StatCard, dateTime, isoDay, money, s } from "./ui";
import type { LedgerRow } from "../../../types/adminConsole";

const PAGE_SIZE = 20;
const METHOD: Record<string, string> = {
  upi: "UPI", card: "Card", netbanking: "Net banking", wallet: "Wallet", emi: "EMI",
  UPI: "UPI", Card: "Card", BankTransfer: "Bank transfer", Cash: "Cash", Other: "Other",
};

function last12Months() {
  const end = new Date();
  const start = new Date(end.getFullYear(), end.getMonth() - 11, 1);
  return { from: isoDay(start), to: isoDay(end) };
}

// Every subscription payment on the platform: online checkouts (paid, failed, still pending) and
// payments recorded by hand. Kept permanently.
export function AdminPaymentsScreen({ onOpenStudio }: { onOpenStudio: (studioId: number) => void }) {
  const narrow = useWindowDimensions().width < 900;
  const [range, setRange] = useState(last12Months);
  const [status, setStatus] = useState("All");
  const [kind, setKind] = useState("All");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [range, status, kind, search]);

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["admin-payments", range.from, range.to, status, kind, search, page],
    queryFn: () => adminConsoleApi.payments({
      ...range, status: status === "All" ? undefined : status, kind: kind === "All" ? undefined : kind,
      search: search || undefined, page, pageSize: PAGE_SIZE,
    }),
    placeholderData: keepPreviousData,
  });
  useRefetchOnFocus(refetch);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <PageHeader title="Payments" subtitle="Subscription payments from every studio — online and recorded by hand."
        actions={<DateRange from={range.from} to={range.to} onChange={(from, to) => setRange({ from, to })} />} />

      {data && (
        <View style={styles.stats}>
          <StatCard label="Revenue in range" value={money(data.paidTotal)} icon="wallet-outline" tone={C.good} hint={`${data.paidCount} paid`} />
          <StatCard label="Failed" value={String(data.failedCount)} icon="close-circle-outline" tone={data.failedCount ? C.bad : C.accent} hint="Attempts that didn't go through" />
          <StatCard label="Pending" value={String(data.pendingCount)} icon="time-outline" tone={C.warn} hint="Checkout opened, not paid" />
        </View>
      )}

      <Card>
        <View style={styles.filters}>
          <SearchInput style={styles.search} value={search} onChangeText={setSearch} placeholder="Studio, transaction or order ID" />
          <Chips options={["All", "Paid", "Failed", "Pending"].map((k) => ({ key: k, label: k === "All" ? "Any status" : k }))} value={status} onChange={setStatus} />
          <Chips options={["All", "Online", "Manual"].map((k) => ({ key: k, label: k === "All" ? "Online & manual" : k }))} value={kind} onChange={setKind} />
        </View>

        {isPending ? <Loading /> : isError || !data ? <ErrorState text="Couldn't load payments." onRetry={refetch} /> :
          data.items.length === 0 ? <EmptyState icon="receipt-outline" title="No payments match" text="Try a wider date range or clear the filters." /> :
            narrow ? (
              <View style={{ gap: 8 }}>{data.items.map((r, i) => <MobileRow key={i} r={r} onOpen={() => onOpenStudio(r.studioId)} />)}</View>
            ) : (
              <ScrollView horizontal contentContainerStyle={{ minWidth: "100%" }}>
                <View style={{ width: "100%", minWidth: 1000 }}>
                  <View style={[styles.tr, styles.thead]}>
                    {["Date", "Studio", "Plan", "Amount", "Status", "Method", "Transaction / reference", "Source"].map((h, i) => (
                      <Text key={h} style={[styles.th, { flex: W[i] }]}>{h}</Text>
                    ))}
                  </View>
                  {data.items.map((r, i) => (
                    <View key={i} style={styles.tr}>
                      <Text style={[styles.muted, { flex: W[0] }]}>{dateTime(r.date)}</Text>
                      <Pressable style={{ flex: W[1] }} onPress={() => onOpenStudio(r.studioId)} accessibilityRole="link">
                        <Text style={styles.link} numberOfLines={1}>{r.studioName}</Text>
                      </Pressable>
                      <Text style={[styles.cell, { flex: W[2] }]}>{r.planName ?? "—"}{r.months ? ` · ${r.months} mo` : ""}</Text>
                      <Text style={[styles.cell, styles.strong, { flex: W[3] }]}>{money(r.amount)}</Text>
                      <View style={{ flex: W[4] }}><StatusText status={r.status} /></View>
                      <Text style={[styles.cell, { flex: W[5] }]}>{METHOD[r.method ?? ""] ?? r.method ?? "—"}</Text>
                      <View style={{ flex: W[6] }}>
                        <Text style={styles.muted} selectable numberOfLines={1}>{r.transactionId ?? r.orderId ?? "—"}</Text>
                        {!!r.failureReason && <Text style={[s.faint, { color: C.bad }]} numberOfLines={1}>{r.failureReason}</Text>}
                      </View>
                      <Text style={[styles.muted, { flex: W[7] }]}>{r.kind}</Text>
                    </View>
                  ))}
                </View>
              </ScrollView>
            )}
        {data && <Pagination page={page} pageSize={PAGE_SIZE} total={data.totalCount} onPage={setPage} />}
      </Card>
    </ScrollView>
  );
}

const W = [1.3, 1.5, 1.1, 0.8, 0.7, 0.8, 1.8, 0.6];

function StatusText({ status }: { status: LedgerRow["status"] }) {
  const color = status === "Paid" ? C.good : status === "Failed" ? C.bad : C.warn;
  return (
    <View style={[s.badge, { borderColor: `${color}55`, backgroundColor: `${color}14` }]}>
      <Text style={[s.badgeText, { color }]}>{status}</Text>
    </View>
  );
}

function MobileRow({ r, onOpen }: { r: LedgerRow; onOpen: () => void }) {
  return (
    <Pressable style={styles.mRow} onPress={onOpen}>
      <View style={styles.mTop}>
        <Text style={styles.strongText}>{money(r.amount)}</Text>
        <StatusText status={r.status} />
      </View>
      <Text style={styles.cell}>{r.studioName}</Text>
      <Text style={s.faint}>{dateTime(r.date)} · {r.planName ?? "—"} · {METHOD[r.method ?? ""] ?? r.method ?? "—"} · {r.kind}</Text>
      {!!(r.transactionId ?? r.orderId) && <Text style={s.faint} selectable>{r.transactionId ?? r.orderId}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.page },
  content: { padding: 24, gap: 16, maxWidth: 1400, width: "100%", alignSelf: "center" },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  filters: { gap: 10 },
  search: { maxWidth: 380 },
  tr: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  thead: { paddingVertical: 8 },
  th: { color: C.faint, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  cell: { color: C.text, fontSize: 13 },
  strong: { fontWeight: "700", fontVariant: ["tabular-nums"] },
  strongText: { color: C.text, fontSize: 14, fontWeight: "700" },
  muted: { color: C.muted, fontSize: 12 },
  link: { color: C.accent, fontSize: 13, fontWeight: "600" },
  mRow: { borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 12, gap: 3, backgroundColor: C.raised },
  mTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
});
