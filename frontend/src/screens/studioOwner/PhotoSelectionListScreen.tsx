import { useMemo, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { photoSelectionApi } from "../../api/photoSelectionApi";
import { StatusPill } from "../../components/StatusPill";
import { SearchInput } from "../../components/SearchInput";
import { useRefetchOnFocus } from "../../hooks/useRefetchOnFocus";
import { Screen } from "../../ui/Screen";
import { PageHeader } from "../../ui/PageHeader";
import { FilterChips } from "../../ui/FilterChips";
import { EmptyState } from "../../ui/EmptyState";
import { Button } from "../../ui/Button";
import { DataList, CellSub, CellTitle, type Column } from "../../ui/DataList";
import { colors, space, type } from "../../ui/theme";
import type { CompletedEventGallery, GalleryState } from "../../types/photoSelection";

export const STATE_LABELS: Record<GalleryState, string> = {
  NoPhotos: "No photos yet",
  NeedToSend: "Need to send",
  Pending: "Link sent",
  Submitted: "Submitted",
  Locked: "Locked",
  Expired: "Expired",
};

export function stateTone(state: GalleryState): "good" | "bad" | "warn" | "neutral" | "info" {
  if (state === "Submitted") return "good";
  if (state === "Expired") return "bad";
  if (state === "NeedToSend") return "warn";
  if (state === "Pending") return "info";
  return "neutral";
}

// What the owner should do next for an event, in their words.
export function nextStep(state: GalleryState): string {
  switch (state) {
    case "NoPhotos": return "Add the photos";
    case "NeedToSend": return "Send the link";
    case "Pending": return "Waiting for the customer";
    case "Submitted": return "Deliver the selected photos";
    case "Locked": return "Selection confirmed";
    case "Expired": return "Send a new link";
  }
}

type Filter = GalleryState | "All";
const FILTERS: { value: Filter; label: string }[] = [
  { value: "All", label: "All" },
  { value: "NoPhotos", label: "No photos yet" },
  { value: "NeedToSend", label: "Need to send" },
  { value: "Pending", label: "Link sent" },
  { value: "Submitted", label: "Submitted" },
  { value: "Locked", label: "Locked" },
  { value: "Expired", label: "Expired" },
];

const PAGE_SIZE = 20;

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
}

function daysLeft(value: string | null): number | null {
  if (!value) return null;
  return Math.ceil((new Date(value.endsWith("Z") ? value : `${value}Z`).getTime() - Date.now()) / 86_400_000);
}

// "Link: 3 days left" while the customer can still choose; afterwards, when the previews go.
function countdown(item: CompletedEventGallery): string | null {
  const plural = (n: number) => `${n} day${n === 1 ? "" : "s"}`;
  const link = daysLeft(item.expiresAt);
  if (link !== null && link > 0) return `Link: ${plural(link)} left`;
  const previews = daysLeft(item.previewsDeleteAt);
  if (previews !== null) return previews > 0 ? `Previews deleted in ${plural(previews)}` : "Previews deleted today";
  return null;
}

function progressText(item: CompletedEventGallery): string {
  return item.photoCount > 0 ? `${item.selectedCount} of ${item.photoCount} selected` : "No photos";
}

// Completed events and where each one stands with its customer photo selection. Tapping one opens
// (creating, the first time) that event's gallery.
export function PhotoSelectionListScreen({ onOpen }: { onOpen: (eventId: number) => void }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("All");
  const [page, setPage] = useState(1);

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["photo-gallery-events", search],
    queryFn: () => photoSelectionApi.completedEvents({ search: search || undefined, page: 1, pageSize: 100 }),
    placeholderData: keepPreviousData,
  });
  useRefetchOnFocus(refetch);

  const all = data?.items;
  const counts = useMemo(() => {
    const c: Partial<Record<Filter, number>> = { All: all?.length ?? 0 };
    for (const e of all ?? []) c[e.state] = (c[e.state] ?? 0) + 1;
    return c;
  }, [all]);
  const filteredItems = useMemo(() => (all ?? []).filter((e) => filter === "All" || e.state === filter), [all, filter]);
  const pageItems = filteredItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Only states that actually occur get a chip (plus the one currently chosen).
  const chips = FILTERS
    .filter((f) => f.value === "All" || f.value === filter || (counts[f.value] ?? 0) > 0)
    .map((f) => ({ value: f.value, label: all ? `${f.label} (${counts[f.value] ?? 0})` : f.label }));

  const columns: Column<CompletedEventGallery>[] = [
    { key: "customer", label: "Customer", flex: 2, render: (e) => (<><CellTitle>{e.customerName}</CellTitle><CellSub>{[e.eventTypeName, e.venue].filter(Boolean).join(" · ") || "Event"}</CellSub></>) },
    { key: "date", label: "Event date", width: 130, render: (e) => <CellSub>{formatDate(e.eventDate)}</CellSub> },
    { key: "status", label: "Status", width: 140, render: (e) => <StatusPill label={STATE_LABELS[e.state]} tone={stateTone(e.state)} /> },
    { key: "photos", label: "Selection", flex: 1, render: (e) => (<><CellTitle>{progressText(e)}</CellTitle>{countdown(e) ? <CellSub>{countdown(e)}</CellSub> : null}</>) },
    { key: "next", label: "Next step", flex: 1, render: (e) => <Text style={styles.next} numberOfLines={1}>{nextStep(e.state)} ›</Text> },
  ];

  const hasFilter = !!search || filter !== "All";

  return (
    <Screen>
      <PageHeader
        title="Photo delivery"
        subtitle={data ? `${data.totalCount} completed event${data.totalCount === 1 ? "" : "s"}` : null}
      />
      <SearchInput style={{ marginBottom: space.md }} value={search} onChangeText={(v) => { setSearch(v); setPage(1); }} placeholder="Search by customer or venue" />
      <View style={{ marginBottom: space.lg }}>
        <FilterChips<Filter> options={chips} value={filter} onChange={(v) => { setFilter(v); setPage(1); }} />
      </View>

      <DataList
        items={pageItems}
        keyOf={(e) => e.eventId}
        columns={columns}
        onRowPress={(e) => onOpen(e.eventId)}
        loading={isPending}
        error={isError ? "Couldn't load events. Check your connection and try again." : null}
        onRetry={() => refetch()}
        page={page}
        pageSize={PAGE_SIZE}
        totalCount={filteredItems.length}
        onPageChange={setPage}
        empty={hasFilter ? (
          <EmptyState icon="search-outline" title="No events here" text="Try another customer name or status."
            action={<Button label="Show all" onPress={() => { setSearch(""); setFilter("All"); setPage(1); }} />} />
        ) : (
          <EmptyState icon="images-outline" title="No completed events yet"
            text="Photo delivery opens once an event is marked Completed. Then add the photos, send the customer their link, and deliver what they pick." />
        )}
        renderCard={(e) => (
          <>
            <View style={styles.cardTop}>
              <Text style={styles.cardTitle} numberOfLines={1}>{e.customerName}</Text>
              <StatusPill label={STATE_LABELS[e.state]} tone={stateTone(e.state)} />
            </View>
            <Text style={styles.cardSub} numberOfLines={1}>
              {formatDate(e.eventDate)}{e.eventTypeName ? ` · ${e.eventTypeName}` : ""}{e.venue ? ` · ${e.venue}` : ""}
            </Text>
            <View style={styles.cardBottom}>
              <Text style={styles.cardMeta} numberOfLines={1}>{progressText(e)}{countdown(e) ? ` · ${countdown(e)}` : ""}</Text>
              <Text style={styles.next} numberOfLines={1}>{nextStep(e.state)} ›</Text>
            </View>
          </>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.sm },
  cardTitle: { ...type.heading, color: colors.text, flex: 1 },
  cardSub: { ...type.small, color: colors.textMuted },
  cardBottom: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.sm, flexWrap: "wrap",
    borderTopWidth: 1, borderTopColor: colors.border, marginTop: space.xs, paddingTop: space.sm,
  },
  cardMeta: { ...type.caption, color: colors.textFaint, flexShrink: 1 },
  next: { ...type.small, fontWeight: "600", color: colors.link },
});
