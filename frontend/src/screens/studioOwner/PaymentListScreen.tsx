import { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { SubscriptionLock } from "../../components/SubscriptionLock";
import { paymentsApi } from "../../api/paymentsApi";
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUSES, type Payment, type PaymentStatus } from "../../types/payment";
import { StatusPill, type Tone } from "../../components/StatusPill";
import { SearchInput } from "../../components/SearchInput";
import { useRefetchOnFocus } from "../../hooks/useRefetchOnFocus";
import { Screen } from "../../ui/Screen";
import { PageHeader } from "../../ui/PageHeader";
import { FilterChips } from "../../ui/FilterChips";
import { EmptyState } from "../../ui/EmptyState";
import { Button } from "../../ui/Button";
import { DataList, CellMoney, CellSub, CellTitle, type Column, type SortState } from "../../ui/DataList";
import { colors, space, type } from "../../ui/theme";

const PAGE_SIZE = 20;

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
}

function formatCurrency(value: number): string {
  return `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function statusTone(status: PaymentStatus): Tone {
  if (status === "Completed") return "good";
  if (status === "Cancelled") return "bad";
  if (status === "Pending") return "warn";
  return "neutral";
}

// A payment can be individually "Completed" while its event still has a balance owed —
// show "Pending" in that case so the list reflects the event's true collection state.
function displayStatus(item: Payment): PaymentStatus {
  if (item.paymentStatus === "Completed" && item.eventId !== null && (item.eventBalance ?? 0) > 0) {
    return "Pending";
  }
  return item.paymentStatus;
}

function eventLine(p: Payment): string | null {
  if (p.eventId === null) return null;
  const balance = p.eventBalance ?? 0;
  return `Event total ${formatCurrency(p.eventBudget ?? 0)} · ${balance > 0 ? `${formatCurrency(balance)} still due` : "fully paid"}`;
}

export function PaymentListScreen({ onCreate, onEdit }: { onCreate: () => void; onEdit: (payment: Payment) => void }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<PaymentStatus | null>(null);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortState | null>(null);

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["payments", search, status, page, sort?.by, sort?.desc],
    queryFn: () => paymentsApi.search({
      search: search || undefined,
      paymentStatus: status ?? undefined,
      page,
      pageSize: PAGE_SIZE,
      sortBy: sort?.by,
      sortDesc: sort?.desc,
    }),
    placeholderData: keepPreviousData,
  });
  useRefetchOnFocus(refetch);

  const columns: Column<Payment>[] = [
    { key: "date", label: "Date", width: 130, sortKey: "date", render: (p) => (<><CellTitle>{formatDate(p.paymentDate)}</CellTitle><CellSub>{PAYMENT_METHOD_LABELS[p.paymentMethod]}</CellSub></>) },
    { key: "customer", label: "Customer", flex: 2, sortKey: "customer", render: (p) => (<><CellTitle>{p.customerName}</CellTitle><CellSub>{p.customerMobileNumber}</CellSub></>) },
    { key: "event", label: "Event", flex: 2, render: (p) => <CellSub>{eventLine(p) ?? "Not linked to an event"}</CellSub> },
    { key: "ref", label: "Reference", flex: 1, render: (p) => <CellSub>{p.referenceNumber ?? "—"}</CellSub> },
    { key: "status", label: "Status", width: 120, render: (p) => <StatusPill label={displayStatus(p)} tone={statusTone(displayStatus(p))} /> },
    { key: "amount", label: "Amount", width: 130, align: "right", sortKey: "amount", render: (p) => <CellMoney>{formatCurrency(p.amount)}</CellMoney> },
  ];

  const setFilter = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(1); };
  const filtered = !!search || status !== null;

  return (
    <Screen>
      <PageHeader
        title="Payments"
        subtitle={data ? `${data.totalCount} payment${data.totalCount === 1 ? "" : "s"}` : null}
        actions={<SubscriptionLock><Button label="Record payment" icon="add" variant="primary" onPress={onCreate} /></SubscriptionLock>}
      />
      <SearchInput style={{ marginBottom: space.md }} value={search} onChangeText={setFilter(setSearch)} placeholder="Search by customer or reference number" />
      <View style={{ marginBottom: space.lg }}>
        <FilterChips
          options={[{ value: null, label: "All" }, ...PAYMENT_STATUSES.map((s) => ({ value: s, label: s }))]}
          value={status}
          onChange={setFilter(setStatus)}
        />
      </View>

      <DataList
        items={data?.items}
        keyOf={(p) => p.paymentId}
        columns={columns}
        onRowPress={onEdit}
        loading={isPending}
        error={isError ? "Couldn't load payments. Check your connection and try again." : null}
        onRetry={() => refetch()}
        sort={sort}
        onSortChange={(s) => { setSort(s); setPage(1); }}
        page={page}
        pageSize={PAGE_SIZE}
        totalCount={data?.totalCount ?? 0}
        onPageChange={setPage}
        empty={filtered ? (
          <EmptyState icon="search-outline" title="No payments match" text="Try another search or status."
            action={<Button label="Clear filters" onPress={() => { setSearch(""); setStatus(null); setPage(1); }} />} />
        ) : (
          <EmptyState icon="cash-outline" title="No payments yet" text="Record a payment when a customer pays an advance or a balance."
            action={<Button label="Record payment" icon="add" variant="primary" onPress={onCreate} />} />
        )}
        renderCard={(p) => (
          <>
            <View style={styles.cardTop}>
              <Text style={styles.cardDate}>{formatDate(p.paymentDate)} · {PAYMENT_METHOD_LABELS[p.paymentMethod]}</Text>
              <StatusPill label={displayStatus(p)} tone={statusTone(displayStatus(p))} />
            </View>
            <View style={styles.cardTop}>
              <Text style={styles.cardTitle} numberOfLines={1}>{p.customerName}</Text>
              <Text style={styles.amount}>{formatCurrency(p.amount)}</Text>
            </View>
            {eventLine(p) && <Text style={styles.cardSub} numberOfLines={1}>{eventLine(p)}</Text>}
            {p.referenceNumber && <Text style={styles.cardMeta} numberOfLines={1}>Ref: {p.referenceNumber}</Text>}
          </>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.sm },
  cardDate: { ...type.small, fontWeight: "600", color: colors.link },
  cardTitle: { ...type.heading, color: colors.text, flex: 1 },
  amount: { ...type.heading, color: colors.text, fontVariant: ["tabular-nums"] },
  cardSub: { ...type.small, color: colors.textMuted },
  cardMeta: { ...type.caption, color: colors.textFaint },
});
