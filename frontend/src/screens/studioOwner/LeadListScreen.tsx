import { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { SubscriptionLock } from "../../components/SubscriptionLock";
import { leadsApi } from "../../api/leadsApi";
import { lookupApis } from "../../api/lookupsApi";
import type { Lead } from "../../types/lead";
import { StatusPill } from "../../components/StatusPill";
import { extractErrorMessage } from "../../api/errorMessage";
import { MiniDatePicker } from "../../components/MiniDatePicker";
import { SearchInput } from "../../components/SearchInput";
import { useRefetchOnFocus } from "../../hooks/useRefetchOnFocus";
import { Screen } from "../../ui/Screen";
import { PageHeader } from "../../ui/PageHeader";
import { FilterChips } from "../../ui/FilterChips";
import { EmptyState } from "../../ui/EmptyState";
import { Button } from "../../ui/Button";
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

// react-native-web's Alert.alert() is a no-op stub, so confirmations are rendered inline
// in the row itself rather than via Alert (which never shows on the web target).
type PendingAction = { leadId: number; kind: "delete" | "convert" } | null;

export function LeadListScreen({ onCreate, onEdit, onView }: { onCreate: () => void; onEdit: (lead: Lead) => void; onView: (lead: Lead) => void }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [leadStatusId, setLeadStatusId] = useState<number | null>(null);
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortState | null>(null);
  const [pending, setPending] = useState<PendingAction>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: leadStatuses } = useQuery({ queryKey: ["lookups", "leadStatuses"], queryFn: lookupApis.leadStatuses.getAll });

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["leads", search, leadStatusId, createdFrom, createdTo, page, sort?.by, sort?.desc],
    queryFn: () =>
      leadsApi.search({
        search: search || undefined,
        leadStatusId: leadStatusId ?? undefined,
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

  const actions = (l: Lead) => {
    const confirming = pending?.leadId === l.leadId;
    const busy = (convert.isPending && convert.variables === l.leadId) || (remove.isPending && remove.variables === l.leadId);
    if (confirming) {
      const isDelete = pending!.kind === "delete";
      return (
        <View style={styles.confirm}>
          <Text style={[styles.confirmText, !isDelete && { color: colors.text }]}>{isDelete ? "Delete this enquiry?" : "Make this enquiry a customer?"}</Text>
          {actionError && <Text style={styles.error}>{actionError}</Text>}
          <View style={styles.actionRow}>
            <Button label="Cancel" variant="link" onPress={() => { setPending(null); setActionError(null); }} disabled={busy} />
            <Button
              label={isDelete ? "Delete" : "Convert"}
              variant={isDelete ? "danger" : "primary"}
              loading={busy}
              onPress={() => (isDelete ? remove.mutate(l.leadId) : convert.mutate(l.leadId))}
            />
          </View>
        </View>
      );
    }
    return (
      <View style={styles.actionRow}>
        <SubscriptionLock compact>
          <Button label="Edit" variant="link" onPress={() => onEdit(l)} />
        </SubscriptionLock>
        {!l.convertedCustomerId && <Button label="Convert" variant="link" onPress={() => setPending({ leadId: l.leadId, kind: "convert" })} />}
        <Button label="Delete" variant="link" onPress={() => setPending({ leadId: l.leadId, kind: "delete" })} accessibilityLabel={`Delete enquiry from ${l.fullName}`} />
      </View>
    );
  };

  const statusPills = (l: Lead) => (
    <View style={styles.pills}>
      {l.convertedCustomerId ? <StatusPill label="Converted" tone="good" /> : l.leadStatusName ? <StatusPill label={l.leadStatusName} tone="info" /> : null}
      {l.leadSourceName && <StatusPill label={l.leadSourceName} tone="neutral" />}
    </View>
  );

  const columns: Column<Lead>[] = [
    { key: "name", label: "Name", flex: 2, sortKey: "name", render: (l) => (<><CellTitle>{l.fullName}</CellTitle><CellSub>{l.mobileNumber}</CellSub></>) },
    { key: "plan", label: "Looking for", flex: 2, render: (l) => <CellSub>{planLine(l) ?? "—"}</CellSub> },
    { key: "status", label: "Status", flex: 1.5, render: statusPills },
    { key: "created", label: "Received", width: 120, sortKey: "created", render: (l) => <CellSub>{formatDate(l.createdAt)}</CellSub> },
    { key: "actions", label: "", width: 250, align: "right", render: actions },
  ];

  const setFilter = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(1); };
  const filtered = !!search || leadStatusId !== null || !!createdFrom || !!createdTo;

  return (
    <Screen>
      <PageHeader
        title="Enquiries"
        subtitle={data ? `${data.totalCount} enquir${data.totalCount === 1 ? "y" : "ies"}` : null}
        actions={<SubscriptionLock><Button label="New enquiry" icon="add" variant="primary" onPress={onCreate} /></SubscriptionLock>}
      />
      <SearchInput style={{ marginBottom: space.md }} value={search} onChangeText={setFilter(setSearch)} placeholder="Search by name or mobile number" />
      {leadStatuses && leadStatuses.length > 0 && (
        <View style={{ marginBottom: space.md }}>
          <FilterChips
            options={[{ value: null, label: "All" }, ...leadStatuses.map((s) => ({ value: s.id, label: s.name }))] as { value: number | null; label: string }[]}
            value={leadStatusId}
            onChange={setFilter(setLeadStatusId)}
          />
        </View>
      )}
      <View style={styles.dates}>
        <MiniDatePicker label="Received from" value={createdFrom} onChange={setFilter(setCreatedFrom)} />
        <MiniDatePicker label="Received to" value={createdTo} onChange={setFilter(setCreatedTo)} />
        {(createdFrom || createdTo) && (
          <Button label="Clear dates" variant="link" onPress={() => { setCreatedFrom(""); setCreatedTo(""); setPage(1); }} style={{ alignSelf: "flex-end" }} />
        )}
      </View>

      <DataList
        items={data?.items}
        keyOf={(l) => l.leadId}
        columns={columns}
        onRowPress={onView}
        loading={isPending}
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
            action={<Button label="Clear filters" onPress={() => { setSearch(""); setLeadStatusId(null); setCreatedFrom(""); setCreatedTo(""); setPage(1); }} />} />
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
            {planLine(l) && <Text style={styles.cardMeta} numberOfLines={1}>{planLine(l)}</Text>}
            <View style={styles.cardActions}>{actions(l)}</View>
          </>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  dates: { flexDirection: "row", flexWrap: "wrap", gap: space.md, marginBottom: space.lg },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  actionRow: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", flexWrap: "wrap" },
  confirm: { alignItems: "flex-end", gap: 2 },
  confirmText: { ...type.small, fontWeight: "600", color: colors.danger },
  error: { ...type.caption, color: colors.danger },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.sm },
  cardDate: { ...type.small, fontWeight: "600", color: colors.link },
  cardTitle: { ...type.heading, color: colors.text },
  cardSub: { ...type.small, color: colors.textMuted },
  cardMeta: { ...type.caption, color: colors.textFaint },
  cardActions: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: space.xs, paddingTop: space.xs, marginHorizontal: -space.sm },
});
