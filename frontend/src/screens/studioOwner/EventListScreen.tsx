import { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { SubscriptionLock } from "../../components/SubscriptionLock";
import { eventsApi } from "../../api/eventsApi";
import { extractErrorMessage } from "../../api/errorMessage";
import { EVENT_STATUSES, EVENT_STATUS_LABELS, type EventStatus, type StudioEvent } from "../../types/event";
import { StatusPill, eventStatusTone } from "../../components/StatusPill";
import { EventQuoteModal } from "../../components/EventQuoteModal";
import { MiniDatePicker } from "../../components/MiniDatePicker";
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
  return `₹${Math.abs(value).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// More collected than the event is worth reads as "Overpaid", not a bare minus.
function balanceText(e: StudioEvent): { label: string; value: string; tone: string } {
  if (e.balance < 0) return { label: "Overpaid", value: formatCurrency(e.balance), tone: colors.warning };
  if (e.balance === 0) return { label: "Paid", value: formatCurrency(0), tone: colors.success };
  return { label: "Balance", value: formatCurrency(e.balance), tone: colors.warning };
}

function teamText(e: StudioEvent): string {
  const names = e.assignedWorkers.map((w) => w.workerName);
  return names.length === 0 ? "No team yet" : names.length <= 2 ? names.join(", ") : `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
}

function deliveryText(e: StudioEvent): string | null {
  if (e.eventStatus !== "Completed" || e.deliveryItems.length === 0) return null;
  const done = e.deliveryItems.filter((d) => d.isDelivered).length;
  return done === e.deliveryItems.length ? "Everything delivered" : `Delivered ${done} of ${e.deliveryItems.length}`;
}

export function EventListScreen({ onCreate, onEdit, onView }: { onCreate: () => void; onEdit: (event: StudioEvent) => void; onView: (event: StudioEvent) => void }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [eventStatus, setEventStatus] = useState<EventStatus | null>(null);
  const [eventDate, setEventDate] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortState | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [quoteFor, setQuoteFor] = useState<StudioEvent | null>(null);

  // Any change to what's shown starts again from page 1.
  const setFilter = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(1); };

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["events", search, eventStatus, eventDate, page, sort?.by, sort?.desc],
    queryFn: () => eventsApi.search({
      search: search || undefined,
      eventStatus: eventStatus ?? undefined,
      eventDate: eventDate || undefined,
      page,
      pageSize: PAGE_SIZE,
      sortBy: sort?.by,
      sortDesc: sort?.desc,
    }),
    // The current page stays on screen while the next one loads, so nothing jumps.
    placeholderData: keepPreviousData,
  });
  useRefetchOnFocus(refetch);

  const deleteEvent = useMutation({
    mutationFn: (eventId: number) => eventsApi.delete(eventId),
    onSuccess: () => {
      setPendingDeleteId(null);
      setDeleteError(null);
      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-month"] });
    },
    onError: (err) => setDeleteError(extractErrorMessage(err)),
  });

  const actions = (item: StudioEvent) =>
    pendingDeleteId === item.eventId ? (
      <View style={styles.confirm}>
        <Text style={styles.confirmText}>Delete this event?</Text>
        {deleteError && <Text style={styles.error}>{deleteError}</Text>}
        <View style={styles.actionRow}>
          <Button label="Keep" variant="link" onPress={() => { setPendingDeleteId(null); setDeleteError(null); }} disabled={deleteEvent.isPending} />
          <Button label="Delete" variant="danger" onPress={() => deleteEvent.mutate(item.eventId)} loading={deleteEvent.isPending} />
        </View>
      </View>
    ) : (
      <View style={styles.actionRow}>
        <Button label="Quote" icon="document-text-outline" variant="link" onPress={() => setQuoteFor(item)} />
        <SubscriptionLock compact>
          <Button label="Edit" variant="link" onPress={() => onEdit(item)} />
        </SubscriptionLock>
        <Button label="Delete" variant="link" onPress={() => { setPendingDeleteId(item.eventId); setDeleteError(null); }} accessibilityLabel={`Delete event for ${item.customerName}`} />
      </View>
    );

  const columns: Column<StudioEvent>[] = [
    {
      key: "date", label: "Date", width: 130, sortKey: "date",
      render: (e) => (<><CellTitle>{formatDate(e.eventDate)}</CellTitle><CellSub>{e.startTime ? e.startTime.slice(0, 5) : "All day"}</CellSub></>),
    },
    {
      key: "customer", label: "Customer", flex: 2, sortKey: "customer",
      render: (e) => (<><CellTitle>{e.customerName}</CellTitle><CellSub>{e.customerMobileNumber}</CellSub></>),
    },
    {
      key: "event", label: "Event", flex: 2,
      render: (e) => (<><CellTitle>{e.eventTypeName ?? "Event"}</CellTitle><CellSub>{e.venue ?? "No venue"}</CellSub></>),
    },
    {
      key: "status", label: "Status", width: 120, sortKey: "status",
      render: (e) => (
        <View style={{ gap: 4 }}>
          <StatusPill label={EVENT_STATUS_LABELS[e.eventStatus]} tone={eventStatusTone(e.eventStatus)} />
          <CellSub>{deliveryText(e) ?? teamText(e)}</CellSub>
        </View>
      ),
    },
    {
      key: "total", label: "Total", width: 110, align: "right", sortKey: "total",
      render: (e) => <CellMoney>{e.budget !== null ? formatCurrency(e.budget) : "—"}</CellMoney>,
    },
    {
      key: "balance", label: "Balance", width: 110, align: "right",
      render: (e) => {
        if (e.budget === null) return <CellSub>—</CellSub>;
        const b = balanceText(e);
        return (<><CellMoney tone={b.tone}>{b.value}</CellMoney><CellSub>{b.label}</CellSub></>);
      },
    },
    { key: "actions", label: "", width: 230, align: "right", render: actions },
  ];

  const filtered = !!(search || eventDate || eventStatus);

  return (
    <Screen>
      <PageHeader
        title="Events"
        subtitle={data ? `${data.totalCount} event${data.totalCount === 1 ? "" : "s"}` : null}
        actions={
          <SubscriptionLock>
            <Button label="New event" icon="add" variant="primary" onPress={onCreate} />
          </SubscriptionLock>
        }
      />

      <View style={styles.toolbar}>
        <SearchInput style={styles.search} value={search} onChangeText={setFilter(setSearch)} placeholder="Search by customer or venue" />
        {/* Pick a day to see only that day's events. */}
        <MiniDatePicker clearable value={eventDate} onChange={setFilter(setEventDate)} placeholder="Any date" />
      </View>
      <View style={styles.chips}>
        <FilterChips
          options={[{ value: null, label: "All" }, ...EVENT_STATUSES.map((s) => ({ value: s, label: EVENT_STATUS_LABELS[s] }))]}
          value={eventStatus}
          onChange={setFilter(setEventStatus)}
        />
      </View>

      <DataList
        items={data?.items}
        keyOf={(e) => e.eventId}
        columns={columns}
        onRowPress={onView}
        loading={isPending}
        error={isError ? "Couldn't load events. Check your connection and try again." : null}
        onRetry={() => refetch()}
        sort={sort}
        onSortChange={(s) => { setSort(s); setPage(1); }}
        page={page}
        pageSize={PAGE_SIZE}
        totalCount={data?.totalCount ?? 0}
        onPageChange={setPage}
        empty={filtered ? (
          <EmptyState icon="search-outline" title="No events match" text="Try another search, date or status."
            action={<Button label="Clear filters" onPress={() => { setSearch(""); setEventDate(""); setEventStatus(null); setPage(1); }} />} />
        ) : (
          <EmptyState icon="calendar-outline" title="No events yet" text="Create your first event to start planning shoots, payments and delivery."
            action={<Button label="New event" icon="add" variant="primary" onPress={onCreate} />} />
        )}
        renderCard={(e) => {
          const b = e.budget !== null ? balanceText(e) : null;
          return (
            <>
              <View style={styles.cardTop}>
                <Text style={styles.cardDate}>{formatDate(e.eventDate)}{e.startTime ? ` · ${e.startTime.slice(0, 5)}` : ""}</Text>
                <StatusPill label={EVENT_STATUS_LABELS[e.eventStatus]} tone={eventStatusTone(e.eventStatus)} />
              </View>
              <Text style={styles.cardTitle} numberOfLines={1}>{e.customerName}</Text>
              <Text style={styles.cardSub} numberOfLines={1}>{e.eventTypeName ?? "Event"}{e.venue ? ` · ${e.venue}` : ""}</Text>
              {e.budget !== null && b && (
                <Text style={styles.cardSub}>
                  Total <Text style={styles.money}>{formatCurrency(e.budget)}</Text>{"   "}
                  {b.label} <Text style={[styles.money, { color: b.tone }]}>{b.value}</Text>
                </Text>
              )}
              <Text style={styles.cardMeta} numberOfLines={1}>{deliveryText(e) ?? `Team: ${teamText(e)}`}</Text>
              <View style={styles.cardActions}>{actions(e)}</View>
            </>
          );
        }}
      />

      {quoteFor && (
        <EventQuoteModal
          visible
          onClose={() => setQuoteFor(null)}
          eventId={quoteFor.eventId}
          customerId={quoteFor.customerId}
          customerName={quoteFor.customerName}
          eventLabel={`${formatDate(quoteFor.eventDate)}${quoteFor.venue ? ` · ${quoteFor.venue}` : ""}`}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  toolbar: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.sm, marginBottom: space.md },
  search: { flexGrow: 1, flexShrink: 1, flexBasis: 240 },
  chips: { marginBottom: space.lg },
  actionRow: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", flexWrap: "wrap" },
  confirm: { alignItems: "flex-end", gap: 2 },
  confirmText: { ...type.small, fontWeight: "600", color: colors.danger },
  error: { ...type.caption, color: colors.danger },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.sm },
  cardDate: { ...type.small, fontWeight: "600", color: colors.link },
  cardTitle: { ...type.heading, color: colors.text },
  cardSub: { ...type.small, color: colors.textMuted },
  cardMeta: { ...type.caption, color: colors.textFaint },
  money: { fontWeight: "700", color: colors.text },
  cardActions: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: space.xs, paddingTop: space.xs, marginHorizontal: -space.sm },
});
