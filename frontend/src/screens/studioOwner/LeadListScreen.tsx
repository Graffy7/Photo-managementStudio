import { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { SubscriptionLock } from "../../components/SubscriptionLock";
import { leadsApi } from "../../api/leadsApi";
import { lookupApis } from "../../api/lookupsApi";
import type { Lead } from "../../types/lead";
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
import { DataList, CellSub, CellTitle, type Column, type SortState } from "../../ui/DataList";
import { colors, radius, space, type, transition } from "../../ui/theme";

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

// Enquiry statuses are each studio's own list, so the colour follows the usual meaning of the name.
function statusTone(name: string): Tone {
  const n = name.toLowerCase();
  if (n.includes("won") || n.includes("book") || n.includes("confirm")) return "good";
  if (n.includes("lost") || n.includes("cancel") || n.includes("reject")) return "bad";
  if (n.includes("quot") || n.includes("follow")) return "warn";
  if (n.includes("contact") || n.includes("call")) return "blue";
  if (n.includes("new")) return "info";
  return "neutral";
}

type ActionKind = "neutral" | "primary" | "danger";
const ACTION_COLORS: Record<ActionKind, { fg: string; hoverBg: string; hoverBorder: string }> = {
  neutral: { fg: colors.textMuted, hoverBg: "#F5F3FF", hoverBorder: "#D9D2FF" },
  primary: { fg: colors.primary, hoverBg: colors.primarySoft, hoverBorder: "#CFC4FF" },
  danger: { fg: colors.danger, hoverBg: colors.dangerSoft, hoverBorder: colors.dangerBorder },
};

// A compact row action: icon + short label, coloured by what it does (Edit / Convert / Delete).
function RowAction({ icon, label, kind, onPress, accessibilityLabel }: {
  icon: keyof typeof Ionicons.glyphMap; label: string; kind: ActionKind; onPress: () => void; accessibilityLabel?: string;
}) {
  const c = ACTION_COLORS[kind];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={(state) => [styles.rowAction, (state as { hovered?: boolean }).hovered && { backgroundColor: c.hoverBg, borderColor: c.hoverBorder }]}
    >
      <Ionicons name={icon} size={15} color={c.fg} />
      <Text style={[styles.rowActionText, { color: c.fg }]}>{label}</Text>
    </Pressable>
  );
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
  const [period, setPeriod] = useState<Period>("all");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortState | null>(null);
  const [pending, setPending] = useState<PendingAction>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: leadStatuses } = useQuery({ queryKey: ["lookups", "leadStatuses"], queryFn: lookupApis.leadStatuses.getAll });

  const { data, isPending, isError, isPlaceholderData, refetch } = useQuery({
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
          {!!actionError && <Text style={styles.error}>{actionError}</Text>}
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
          <RowAction icon="create-outline" label="Edit" kind="neutral" onPress={() => onEdit(l)} accessibilityLabel={`Edit enquiry from ${l.fullName}`} />
        </SubscriptionLock>
        {!l.convertedCustomerId && (
          <RowAction icon="person-add-outline" label="Convert" kind="primary" onPress={() => setPending({ leadId: l.leadId, kind: "convert" })}
            accessibilityLabel={`Convert ${l.fullName} to a customer`} />
        )}
        <RowAction icon="trash-outline" label="Delete" kind="danger" onPress={() => setPending({ leadId: l.leadId, kind: "delete" })}
          accessibilityLabel={`Delete enquiry from ${l.fullName}`} />
      </View>
    );
  };

  const statusPills = (l: Lead) => (
    <View style={styles.pills}>
      {l.convertedCustomerId ? <StatusPill label="Converted" tone="good" /> : l.leadStatusName ? <StatusPill label={l.leadStatusName} tone={statusTone(l.leadStatusName)} /> : null}
      {!!l.leadSourceName && <StatusPill label={l.leadSourceName} tone="neutral" />}
    </View>
  );

  const columns: Column<Lead>[] = [
    { key: "name", label: "Name", flex: 2, sortKey: "name", render: (l) => (<><CellTitle>{l.fullName}</CellTitle><CellSub>{l.mobileNumber}</CellSub></>) },
    { key: "plan", label: "Looking for", flex: 2, render: (l) => <CellSub>{planLine(l) ?? "—"}</CellSub> },
    { key: "status", label: "Status", flex: 1.5, render: statusPills },
    { key: "created", label: "Received", width: 120, sortKey: "created", render: (l) => <CellSub>{formatDate(l.createdAt)}</CellSub> },
    { key: "actions", label: "Actions", width: 290, align: "right", render: actions },
  ];

  const setFilter = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(1); };
  const filtered = !!search || leadStatusId !== null || !!createdFrom || !!createdTo;

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
  const clearAll = () => { setSearch(""); setLeadStatusId(null); setCreatedFrom(""); setCreatedTo(""); setPeriod("all"); setPage(1); };

  return (
    <Screen>
      <PageHeader
        title="Enquiries"
        subtitle={data ? `${data.totalCount} enquir${data.totalCount === 1 ? "y" : "ies"}` : null}
        actions={<SubscriptionLock><Button label="New enquiry" icon="add" variant="primary" onPress={onCreate} /></SubscriptionLock>}
      />
      <SearchInput style={{ marginBottom: space.md }} value={search} onChangeText={setFilter(setSearch)} placeholder="Search by name or mobile number" />
      <View style={styles.filters}>
        {leadStatuses && leadStatuses.length > 0 && (
          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>Status</Text>
            <View style={styles.filterChips}>
              <FilterChips
                options={[{ value: null, label: "All" }, ...leadStatuses.map((s) => ({ value: s.id, label: s.name }))] as { value: number | null; label: string }[]}
                value={leadStatusId}
                onChange={setFilter(setLeadStatusId)}
              />
            </View>
          </View>
        )}
        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>Received</Text>
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  dates: { flexDirection: "row", flexWrap: "wrap", gap: space.md, marginBottom: space.lg },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  actionRow: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", flexWrap: "wrap", gap: 6 },
  rowAction: {
    flexDirection: "row", alignItems: "center", gap: 5, height: 32, paddingHorizontal: 10, borderRadius: radius.control,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, ...transition,
  },
  rowActionText: { ...type.small, fontWeight: "600" },
  filters: { gap: space.sm, marginBottom: space.lg },
  filterRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  filterLabel: { width: 64, ...type.caption, fontWeight: "700", color: colors.textFaint, textTransform: "uppercase", letterSpacing: 0.6 },
  filterChips: { flex: 1, minWidth: 0 },
  confirm: { alignItems: "flex-end", gap: 2 },
  confirmText: { ...type.small, fontWeight: "600", color: colors.danger },
  error: { ...type.caption, color: colors.danger },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.sm },
  cardDate: { ...type.small, fontWeight: "600", color: colors.link },
  cardTitle: { ...type.heading, color: colors.text },
  cardSub: { ...type.small, color: colors.textMuted },
  cardMeta: { ...type.caption, color: colors.textFaint },
  cardActions: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: space.xs, paddingTop: space.sm },
});
