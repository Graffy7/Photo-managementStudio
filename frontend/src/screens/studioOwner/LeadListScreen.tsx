import { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { RowAction } from "../../ui/RowAction";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { SubscriptionLock } from "../../components/SubscriptionLock";
import { leadsApi } from "../../api/leadsApi";

import { LEAD_OUTCOMES, LEAD_OUTCOME_LABELS, type Lead, type LeadOutcome } from "../../types/lead";
import { StatusPill, type Tone } from "../../components/StatusPill";
import { extractErrorMessage } from "../../api/errorMessage";
import { MiniDatePicker } from "../../components/MiniDatePicker";
import { PERIODS, periodRange, type Period } from "../../utils/periods";
import { SearchInput } from "../../components/SearchInput";
import { useRefetchOnFocus } from "../../hooks/useRefetchOnFocus";
import { Screen } from "../../ui/Screen";
import { PageHeader } from "../../ui/PageHeader";
import { FilterChips } from "../../ui/FilterChips";
import { EmptyState } from "../../ui/EmptyState";
import { Button } from "../../ui/Button";
import { ConfirmDialog } from "../../ui/ConfirmDialog";
import { DataList, CellSub, CellTitle, type Column, type SortState } from "../../ui/DataList";
import { colors, space, type } from "../../ui/theme";

const PAGE_SIZE = 20;

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
}

function formatCurrency(value: number): string {
  return `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function planLine(l: Lead): string | null {
  const parts = [l.eventTypeName, l.expectedEventDate ? formatDate(l.expectedEventDate) : null, l.expectedBudget ? formatCurrency(l.expectedBudget) : null].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

// Status is the enquiry's outcome, worked out by the server (see LeadOutcome).
export const OUTCOME_TONES: Record<LeadOutcome, Tone> = {
  Converted: "good",
  NotConverted: "warn",
  EventOver: "bad",
};

// react-native-web's Alert.alert() is a no-op stub, so confirmations are rendered inline
// in the row itself rather than via Alert (which never shows on the web target).
type PendingAction = { leadId: number; kind: "delete" | "convert" } | null;

export function LeadListScreen({ onCreate, onEdit, onView }: { onCreate: () => void; onEdit: (lead: Lead) => void; onView: (lead: Lead) => void }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [outcome, setOutcome] = useState<LeadOutcome | null>(null);
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [period, setPeriod] = useState<Period>("all");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortState | null>(null);
  const [pending, setPending] = useState<PendingAction>(null);
  const [actionError, setActionError] = useState<string | null>(null);


  const { data, isPending, isError, isPlaceholderData, refetch } = useQuery({
    queryKey: ["leads", search, outcome, createdFrom, createdTo, page, sort?.by, sort?.desc],
    queryFn: () =>
      leadsApi.search({
        search: search || undefined,
        outcome: outcome ?? undefined,
        createdFrom: createdFrom || undefined,
        createdTo: createdTo || undefined,
        page,
        pageSize: PAGE_SIZE,
        sortBy: sort?.by,
        sortDesc: sort?.desc,
      }),
    placeholderData: keepPreviousData,
  });
  useRefetchOnFocus(refetch);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["leads"] });
  const done = () => { setPending(null); setActionError(null); invalidate(); };
  const convert = useMutation({ mutationFn: leadsApi.convert, onSuccess: done, onError: (err) => setActionError(extractErrorMessage(err)) });
  const remove = useMutation({ mutationFn: leadsApi.remove, onSuccess: done, onError: (err) => setActionError(extractErrorMessage(err)) });

  const pendingLead = pending ? data?.items.find((l) => l.leadId === pending.leadId) : undefined;
  const pendingIsDelete = pending?.kind === "delete";
  const confirmDialog = (
    <ConfirmDialog
      visible={!!pending}
      tone={pendingIsDelete ? "danger" : "primary"}
      icon={pendingIsDelete ? "trash-outline" : "person-add-outline"}
      title={pendingIsDelete ? "Delete enquiry?" : "Make this enquiry a customer?"}
      message={pendingIsDelete
        ? `The enquiry from ${pendingLead?.fullName ?? "this person"} will be removed. This can't be undone.`
        : `${pendingLead?.fullName ?? "This person"} will be added to your customers.`}
      confirmLabel={pendingIsDelete ? "Delete" : "Convert"}
      busy={convert.isPending || remove.isPending}
      error={actionError}
      onCancel={() => { setPending(null); setActionError(null); }}
      onConfirm={() => pending && (pendingIsDelete ? remove.mutate(pending.leadId) : convert.mutate(pending.leadId))}
    />
  );

  const actions = (l: Lead) => {
    return (
      <View style={styles.actionRow}>
        <SubscriptionLock compact>
          <RowAction iconOnly icon="create-outline" label="Edit" kind="neutral" onPress={() => onEdit(l)} accessibilityLabel={`Edit enquiry from ${l.fullName}`} />
        </SubscriptionLock>
        {!l.convertedCustomerId && (
          <RowAction iconOnly icon="person-add-outline" label="Convert" kind="primary" onPress={() => setPending({ leadId: l.leadId, kind: "convert" })}
            accessibilityLabel={`Convert ${l.fullName} to a customer`} />
        )}
        <RowAction iconOnly icon="trash-outline" label="Delete" kind="danger" onPress={() => setPending({ leadId: l.leadId, kind: "delete" })}
          accessibilityLabel={`Delete enquiry from ${l.fullName}`} />
      </View>
    );
  };

  const statusPills = (l: Lead) => (
    <View style={styles.pills}>
      <StatusPill label={LEAD_OUTCOME_LABELS[l.outcome]} tone={OUTCOME_TONES[l.outcome]} />
      {!!l.leadSourceName && <StatusPill label={l.leadSourceName} tone="neutral" />}
    </View>
  );

  const columns: Column<Lead>[] = [
    { key: "name", label: "Name", flex: 2, sortKey: "name", render: (l) => (<><CellTitle>{l.fullName}</CellTitle><CellSub>{l.mobileNumber}</CellSub></>) },
    { key: "plan", label: "Looking for", flex: 2, render: (l) => <CellSub>{planLine(l) ?? "—"}</CellSub> },
    { key: "status", label: "Status", flex: 1.5, render: statusPills },
    { key: "created", label: "Received", width: 120, sortKey: "created", render: (l) => <CellSub>{formatDate(l.createdAt)}</CellSub> },
    { key: "actions", label: "", width: 126, align: "right", render: actions },
  ];

  const setFilter = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(1); };
  const filtered = !!search || outcome !== null || !!createdFrom || !!createdTo;

  const choosePeriod = (p: Period) => {
    setPeriod(p);
    // Custom keeps whatever dates are already picked; the other choices fill them in.
    if (p !== "custom") {
      const r = periodRange(p);
      setCreatedFrom(r.from);
      setCreatedTo(r.to);
    }
    setPage(1);
  };
  const clearAll = () => { setSearch(""); setOutcome(null); setCreatedFrom(""); setCreatedTo(""); setPeriod("all"); setPage(1); };

  return (
    <Screen>
      <PageHeader
        title="Enquiries"
        subtitle={data ? `${data.totalCount} enquir${data.totalCount === 1 ? "y" : "ies"}` : null}
        actions={<SubscriptionLock><Button label="New enquiry" icon="add" variant="primary" onPress={onCreate} /></SubscriptionLock>}
      />
      <SearchInput style={{ marginBottom: space.md }} value={search} onChangeText={setFilter(setSearch)} placeholder="Search by name or mobile number" />
      <View style={styles.filters}>
        <View style={styles.filterRow}>
          <View style={styles.filterLabelRow}>
            <Ionicons name="funnel-outline" size={14} color={colors.primary} />
            <Text style={styles.filterLabel}>Status</Text>
          </View>
          <View style={styles.filterChips}>
            <FilterChips
              options={[{ value: null, label: "All" }, ...LEAD_OUTCOMES.map((o) => ({ value: o, label: LEAD_OUTCOME_LABELS[o] }))] as { value: LeadOutcome | null; label: string }[]}
              value={outcome}
              onChange={setFilter(setOutcome)}
            />
          </View>
        </View>
        <View style={styles.filterRow}>
          <View style={styles.filterLabelRow}>
            <Ionicons name="calendar-outline" size={14} color={colors.primary} />
            <Text style={styles.filterLabel}>Received</Text>
          </View>
          <View style={styles.filterChips}>
            <FilterChips<Period> options={PERIODS} value={period} onChange={choosePeriod} />
          </View>
        </View>
      </View>
      {period === "custom" && (
        <View style={styles.dates}>
          <MiniDatePicker label="Received from" value={createdFrom} onChange={setFilter(setCreatedFrom)} />
          <MiniDatePicker label="Received to" value={createdTo} onChange={setFilter(setCreatedTo)} />
          {!!(createdFrom || createdTo) && (
            <Button label="Clear dates" variant="link" onPress={() => { setCreatedFrom(""); setCreatedTo(""); setPage(1); }} style={{ alignSelf: "flex-end" }} />
          )}
        </View>
      )}

      <DataList
        items={data?.items}
        keyOf={(l) => l.leadId}
        columns={columns}
        onRowPress={onView}
        loading={isPending}
        fetching={isPlaceholderData}
        noun="enquiries"
        error={isError ? "Couldn't load enquiries. Check your connection and try again." : null}
        onRetry={() => refetch()}
        sort={sort}
        onSortChange={(s) => { setSort(s); setPage(1); }}
        page={page}
        pageSize={PAGE_SIZE}
        totalCount={data?.totalCount ?? 0}
        onPageChange={setPage}
        empty={filtered ? (
          <EmptyState icon="search-outline" title="No enquiries match" text="Try another search, status or date range."
            action={<Button label="Clear filters" onPress={clearAll} />} />
        ) : (
          <EmptyState icon="person-add-outline" title="No enquiries yet" text="Add an enquiry when someone asks about a shoot. Convert it into a customer once they book."
            action={<Button label="New enquiry" icon="add" variant="primary" onPress={onCreate} />} />
        )}
        renderCard={(l) => (
          <>
            <View style={styles.cardTop}>
              <Text style={styles.cardDate}>Received {formatDate(l.createdAt)}</Text>
              {statusPills(l)}
            </View>
            <Text style={styles.cardTitle} numberOfLines={1}>{l.fullName}</Text>
            <Text style={styles.cardSub} numberOfLines={1}>{l.mobileNumber}{l.email ? ` · ${l.email}` : ""}</Text>
            {!!planLine(l) && <Text style={styles.cardMeta} numberOfLines={1}>{planLine(l)}</Text>}
            <View style={styles.cardActions}>{actions(l)}</View>
          </>
        )}
      />
      {confirmDialog}
    </Screen>
  );
}

const styles = StyleSheet.create({
  dates: { flexDirection: "row", flexWrap: "wrap", gap: space.md, marginBottom: space.lg },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  actionRow: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", flexWrap: "wrap", gap: 6 },
  // Status and Received side by side on one line; they wrap under each other on narrow screens.
  filters: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: space.lg, rowGap: space.sm, marginBottom: space.lg },
  filterRow: { flexDirection: "row", alignItems: "center", gap: space.sm, flexShrink: 1, minWidth: 0, maxWidth: "100%" },
  filterLabelRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  // Bright blue and bold so the filter names stand apart from the table text below.
  filterLabel: { ...type.small, fontWeight: "800", color: colors.primary },
  filterChips: { flexShrink: 1, minWidth: 0 },
  error: { ...type.caption, color: colors.danger },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.sm },
  cardDate: { ...type.small, fontWeight: "600", color: colors.link },
  cardTitle: { ...type.heading, color: colors.text },
  cardSub: { ...type.small, color: colors.textMuted },
  cardMeta: { ...type.caption, color: colors.textFaint },
  cardActions: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: space.xs, paddingTop: space.sm },
});
