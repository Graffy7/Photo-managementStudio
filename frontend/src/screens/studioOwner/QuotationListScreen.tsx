import { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { SubscriptionLock } from "../../components/SubscriptionLock";
import { quotationsApi } from "../../api/quotationsApi";
import { QUOTATION_STATUSES, type Quotation, type QuotationStatus } from "../../types/quotation";
import { StatusPill, type Tone } from "../../components/StatusPill";
import { SearchInput } from "../../components/SearchInput";
import { QuotationPdfButton } from "../../components/QuotationPdfButton";
import { useRefetchOnFocus } from "../../hooks/useRefetchOnFocus";
import { Screen } from "../../ui/Screen";
import { PageHeader } from "../../ui/PageHeader";
import { FilterChips } from "../../ui/FilterChips";
import { EmptyState } from "../../ui/EmptyState";
import { Button } from "../../ui/Button";
import { DataList, CellMoney, CellSub, CellTitle, type Column, type SortState } from "../../ui/DataList";
import { colors, radius, space, type } from "../../ui/theme";

const PAGE_SIZE = 20;

// The search filter only needs the two "active" pipeline states — Accepted/Rejected/Expired/
// Cancelled are terminal outcomes you'd rarely filter a search by. "Change status" still offers
// the full QUOTATION_STATUSES list.
const SEARCH_FILTER_STATUSES: QuotationStatus[] = ["Draft", "Sent"];

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
}

function formatCurrency(value: number): string {
  return `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function statusTone(status: QuotationStatus): Tone {
  if (status === "Accepted") return "good";
  if (status === "Rejected" || status === "Cancelled") return "bad";
  if (status === "Sent" || status === "Expired") return "warn";
  return "neutral";
}

export function QuotationListScreen({ onCreate, onEdit }: { onCreate: () => void; onEdit: (quotation: Quotation) => void }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<QuotationStatus | null>(null);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortState | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [changingStatusId, setChangingStatusId] = useState<number | null>(null);

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["quotations", search, status, page, sort?.by, sort?.desc],
    queryFn: () => quotationsApi.search({
      search: search || undefined,
      status: status ?? undefined,
      page,
      pageSize: PAGE_SIZE,
      sortBy: sort?.by,
      sortDesc: sort?.desc,
    }),
    placeholderData: keepPreviousData,
  });
  useRefetchOnFocus(refetch);

  const setStatusMutation = useMutation({
    mutationFn: ({ id, newStatus }: { id: number; newStatus: QuotationStatus }) => quotationsApi.setStatus(id, newStatus),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotations"] });
      setChangingStatusId(null);
    },
  });

  const statusPicker = (q: Quotation) => changingStatusId === q.quotationId && (
    <View style={styles.statusPicker}>
      {QUOTATION_STATUSES.map((s) => (
        <Pressable
          key={s}
          style={[styles.statusChip, q.status === s && styles.statusChipOn]}
          disabled={setStatusMutation.isPending}
          onPress={() => setStatusMutation.mutate({ id: q.quotationId, newStatus: s })}
          accessibilityRole="button"
          accessibilityState={{ selected: q.status === s }}
        >
          <Text style={[styles.statusChipText, q.status === s && styles.statusChipTextOn]}>{s}</Text>
        </Pressable>
      ))}
    </View>
  );

  const actions = (q: Quotation) => (
    <View style={styles.actionRow}>
      <QuotationPdfButton quotation={q} onError={setDownloadError} />
      <Button
        label={changingStatusId === q.quotationId ? "Close" : "Change status"}
        variant="link"
        onPress={() => setChangingStatusId(changingStatusId === q.quotationId ? null : q.quotationId)}
      />
    </View>
  );

  const columns: Column<Quotation>[] = [
    { key: "date", label: "Date", width: 130, sortKey: "date", render: (q) => (<><CellTitle>{formatDate(q.quotationDate)}</CellTitle><CellSub>{q.quotationNumber}</CellSub></>) },
    { key: "customer", label: "Customer", flex: 2, sortKey: "customer", render: (q) => (<><CellTitle>{q.customerName}</CellTitle><CellSub>{q.customerMobileNumber}</CellSub></>) },
    {
      key: "details", label: "Details", flex: 2,
      render: (q) => (
        <>
          <CellSub>{q.items.length} item{q.items.length === 1 ? "" : "s"}{q.eventVenue ? ` · ${q.eventVenue}` : ""}</CellSub>
          {statusPicker(q)}
        </>
      ),
    },
    { key: "status", label: "Status", width: 120, render: (q) => <StatusPill label={q.status} tone={statusTone(q.status)} /> },
    { key: "total", label: "Total", width: 130, align: "right", sortKey: "total", render: (q) => <CellMoney>{formatCurrency(q.grandTotal)}</CellMoney> },
    { key: "actions", label: "", width: 230, align: "right", render: actions },
  ];

  const setFilter = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(1); };
  const filtered = !!search || status !== null;

  return (
    <Screen>
      <PageHeader
        title="Quotations"
        subtitle={data ? `${data.totalCount} quotation${data.totalCount === 1 ? "" : "s"}` : null}
        actions={<SubscriptionLock><Button label="New quotation" icon="add" variant="primary" onPress={onCreate} /></SubscriptionLock>}
      />
      <SearchInput style={{ marginBottom: space.md }} value={search} onChangeText={setFilter(setSearch)} placeholder="Search by quotation number or customer" />
      <View style={{ marginBottom: space.lg }}>
        <FilterChips
          options={[{ value: null, label: "All" }, ...SEARCH_FILTER_STATUSES.map((s) => ({ value: s, label: s }))]}
          value={status}
          onChange={setFilter(setStatus)}
        />
      </View>
      {downloadError && <Text style={styles.error}>{downloadError}</Text>}

      <DataList
        items={data?.items}
        keyOf={(q) => q.quotationId}
        columns={columns}
        onRowPress={onEdit}
        loading={isPending}
        error={isError ? "Couldn't load quotations. Check your connection and try again." : null}
        onRetry={() => refetch()}
        sort={sort}
        onSortChange={(s) => { setSort(s); setPage(1); }}
        page={page}
        pageSize={PAGE_SIZE}
        totalCount={data?.totalCount ?? 0}
        onPageChange={setPage}
        empty={filtered ? (
          <EmptyState icon="search-outline" title="No quotations match" text="Try another search or status."
            action={<Button label="Clear filters" onPress={() => { setSearch(""); setStatus(null); setPage(1); }} />} />
        ) : (
          <EmptyState icon="document-text-outline" title="No quotations yet" text="Create a quotation to send your prices to a customer as a PDF."
            action={<Button label="New quotation" icon="add" variant="primary" onPress={onCreate} />} />
        )}
        renderCard={(q) => (
          <>
            <View style={styles.cardTop}>
              <Text style={styles.cardDate}>{q.quotationNumber} · {formatDate(q.quotationDate)}</Text>
              <StatusPill label={q.status} tone={statusTone(q.status)} />
            </View>
            <View style={styles.cardTop}>
              <Text style={styles.cardTitle} numberOfLines={1}>{q.customerName}</Text>
              <Text style={styles.amount}>{formatCurrency(q.grandTotal)}</Text>
            </View>
            <Text style={styles.cardSub} numberOfLines={1}>{q.items.length} item{q.items.length === 1 ? "" : "s"}{q.eventVenue ? ` · ${q.eventVenue}` : ""}</Text>
            {statusPicker(q)}
            <View style={styles.cardActions}>{actions(q)}</View>
          </>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  actionRow: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", flexWrap: "wrap", gap: space.xs },
  statusPicker: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: space.sm },
  statusChip: { minHeight: 32, justifyContent: "center", borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.pill, paddingHorizontal: space.md },
  statusChipOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  statusChipText: { ...type.caption, fontWeight: "600", color: colors.textMuted },
  statusChipTextOn: { color: colors.primary },
  error: { ...type.small, color: colors.danger, marginBottom: space.md },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.sm },
  cardDate: { ...type.small, fontWeight: "600", color: colors.link },
  cardTitle: { ...type.heading, color: colors.text, flex: 1 },
  amount: { ...type.heading, color: colors.text, fontVariant: ["tabular-nums"] },
  cardSub: { ...type.small, color: colors.textMuted },
  cardActions: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: space.xs, paddingTop: space.xs },
});
