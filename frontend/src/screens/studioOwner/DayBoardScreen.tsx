import { useState } from "react";
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { dayBoardApi } from "../../api/dayBoardApi";
import { workersApi } from "../../api/workersApi";
import type { DayBoardEvent } from "../../types/dayBoard";
import { StatusPill, eventStatusTone } from "../../components/StatusPill";
import { MiniDatePicker } from "../../components/MiniDatePicker";
import { extractErrorMessage } from "../../api/errorMessage";
import { useRefetchOnFocus } from "../../hooks/useRefetchOnFocus";
import { localDateString } from "../../utils/localDate";
import { Screen } from "../../ui/Screen";
import { PageHeader } from "../../ui/PageHeader";
import { EmptyState } from "../../ui/EmptyState";
import { Button } from "../../ui/Button";
import { Skeleton } from "../../ui/Skeleton";
import { colors, radius, space, touch, type } from "../../ui/theme";

// Today on the studio's calendar (the device's own day, not UTC's).
function todayLocal(): string {
  return localDateString();
}

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatDateLabel(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

function formatCurrency(value: number): string {
  return `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function WorkerPicker({ eventId, assignedWorkerIds, onDone }: { eventId: number; assignedWorkerIds: number[]; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const { data: workers, isPending } = useQuery({
    queryKey: ["workers-active-picker"],
    queryFn: () => workersApi.search({ isActive: true, pageSize: 100 }),
  });

  const assign = useMutation({
    mutationFn: (workerId: number) => dayBoardApi.assignWorker(eventId, workerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["day-board"] });
      onDone();
    },
    onError: (err) => setError(extractErrorMessage(err)),
  });

  const available = (workers?.items ?? []).filter((w) => !assignedWorkerIds.includes(w.workerId));

  return (
    <View style={styles.pickerCard}>
      <Text style={styles.pickerTitle}>Choose a worker to add</Text>
      <View style={styles.chipRow}>
        {available.map((w) => (
          <Pressable key={w.workerId} style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]} onPress={() => assign.mutate(w.workerId)} disabled={assign.isPending} accessibilityRole="button">
            <Ionicons name="add" size={16} color={colors.link} />
            <Text style={styles.chipText}>{w.fullName}</Text>
          </Pressable>
        ))}
        {isPending && <Text style={styles.hint}>Loading workers…</Text>}
        {!isPending && available.length === 0 && <Text style={styles.hint}>All your active workers are already on this event.</Text>}
      </View>
      {error ? <Text style={styles.rowError}>{error}</Text> : null}
      <Button label="Close" variant="link" onPress={onDone} style={styles.pickerClose} />
    </View>
  );
}

function EventCard({ event }: { event: DayBoardEvent }) {
  const queryClient = useQueryClient();
  const [showPicker, setShowPicker] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const unassign = useMutation({
    mutationFn: (workerId: number) => dayBoardApi.unassignWorker(event.eventId, workerId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["day-board"] }),
    onError: (err) => setRemoveError(extractErrorMessage(err)),
  });

  const place = [event.venue, event.venueAddress].filter(Boolean).join(" · ");

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.timeRow}>
          <Ionicons name="time-outline" size={18} color={colors.primary} />
          <Text style={styles.time}>{event.startTime ?? "Time not set"}{event.endTime ? ` – ${event.endTime}` : ""}</Text>
        </View>
        <StatusPill label={event.eventStatus} tone={eventStatusTone(event.eventStatus)} />
      </View>

      <View>
        <Text style={styles.customerName}>{event.customerName}</Text>
        {event.eventTypeName ? <Text style={styles.eventType}>{event.eventTypeName}</Text> : null}
      </View>

      <View style={styles.facts}>
        <View style={styles.fact}>
          <Ionicons name="call-outline" size={16} color={colors.textMuted} />
          <Text style={styles.factText} selectable>{event.customerMobileNumber}</Text>
        </View>
        {place ? (
          <View style={styles.fact}>
            <Ionicons name="location-outline" size={16} color={colors.textMuted} />
            <Text style={styles.factText}>{place}</Text>
          </View>
        ) : null}
        {event.notes ? (
          <View style={styles.fact}>
            <Ionicons name="document-text-outline" size={16} color={colors.textMuted} />
            <Text style={styles.factText}>{event.notes}</Text>
          </View>
        ) : null}
      </View>

      {event.budget !== null && (
        <View style={styles.financeRow}>
          <View style={styles.financeItem}>
            <Text style={styles.financeLabel}>Total</Text>
            <Text style={styles.financeValue}>{formatCurrency(event.budget)}</Text>
          </View>
          <View style={styles.financeItem}>
            <Text style={styles.financeLabel}>Paid</Text>
            <Text style={styles.financeValue}>{formatCurrency(event.amountPaid)}</Text>
          </View>
          <View style={styles.financeItem}>
            <Text style={styles.financeLabel}>{event.balance < 0 ? "Overpaid" : "Balance"}</Text>
            <Text style={[styles.financeValue, { color: event.balance === 0 ? colors.success : colors.warning }]}>
              {formatCurrency(Math.abs(event.balance))}
            </Text>
          </View>
        </View>
      )}

      <View style={styles.crew}>
        <Text style={styles.crewTitle}>Crew{event.workers.length > 0 ? ` (${event.workers.length})` : ""}</Text>
        {event.workers.length === 0 ? (
          <Text style={styles.hint}>No one assigned yet.</Text>
        ) : (
          <View style={styles.chipRow}>
            {event.workers.map((w) => (
              <View key={w.eventWorkerId} style={styles.crewChip}>
                <Text style={styles.crewChipText}>{w.workerName}{w.workerTypeName ? ` · ${w.workerTypeName}` : ""}</Text>
                <Pressable onPress={() => unassign.mutate(w.workerId)} disabled={unassign.isPending} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Remove ${w.workerName}`}>
                  <Ionicons name="close" size={16} color={colors.danger} />
                </Pressable>
              </View>
            ))}
          </View>
        )}
        {removeError ? <Text style={styles.rowError}>{removeError}</Text> : null}

        {showPicker ? (
          <WorkerPicker
            eventId={event.eventId}
            assignedWorkerIds={event.workers.map((w) => w.workerId)}
            onDone={() => setShowPicker(false)}
          />
        ) : (
          <Button label="Assign worker" icon="person-add-outline" onPress={() => setShowPicker(true)} style={styles.assign} />
        )}
      </View>
    </View>
  );
}

export function DayBoardScreen() {
  const [date, setDate] = useState(todayLocal());
  const isToday = date === todayLocal();

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["day-board", date],
    queryFn: () => dayBoardApi.getDayBoard(date),
  });
  useRefetchOnFocus(refetch);

  const count = data?.events.length ?? 0;
  const balance = data?.events.reduce((sum, e) => sum + Math.max(e.balance, 0), 0) ?? 0;

  return (
    <Screen>
      <PageHeader
        title="Day board"
        subtitle={`${isToday ? "Today · " : ""}${formatDateLabel(date)}`}
      />

      <View style={styles.dateNav}>
        <Pressable style={({ pressed }) => [styles.arrow, pressed && styles.chipPressed]} onPress={() => setDate((d) => shiftDate(d, -1))} accessibilityRole="button" accessibilityLabel="Previous day">
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </Pressable>
        <View style={styles.datePickerSlot}>
          <MiniDatePicker value={date} onChange={(d) => d && setDate(d)} />
        </View>
        <Pressable style={({ pressed }) => [styles.arrow, pressed && styles.chipPressed]} onPress={() => setDate((d) => shiftDate(d, 1))} accessibilityRole="button" accessibilityLabel="Next day">
          <Ionicons name="chevron-forward" size={20} color={colors.text} />
        </Pressable>
        <Button label="Today" onPress={() => setDate(todayLocal())} disabled={isToday} />
      </View>

      {isPending ? (
        <View style={styles.grid}>
          <Skeleton height={260} rounded={radius.card} />
          <Skeleton height={260} rounded={radius.card} />
        </View>
      ) : isError || !data ? (
        <EmptyState icon="cloud-offline-outline" title="Couldn't load this day" text="Check your connection and try again."
          action={<Button label="Try again" onPress={() => refetch()} />} />
      ) : count === 0 ? (
        <EmptyState icon="calendar-clear-outline" title="No events on this day"
          text="Pick another date, or use the arrows to move one day at a time." />
      ) : (
        <>
          <Text style={styles.summary}>
            {count} event{count === 1 ? "" : "s"}{balance > 0 ? ` · ${formatCurrency(balance)} still to collect` : ""}
          </Text>
          <View style={styles.grid}>
            {data.events.map((event) => <EventCard key={event.eventId} event={event} />)}
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  dateNav: { flexDirection: "row", alignItems: "center", gap: space.sm, marginBottom: space.lg, maxWidth: 520 },
  arrow: {
    width: touch, height: touch, borderRadius: radius.control, borderWidth: 1, borderColor: colors.borderStrong,
    backgroundColor: colors.card, alignItems: "center", justifyContent: "center",
  },
  datePickerSlot: { flex: 1, minWidth: 0, justifyContent: "center" },
  summary: { ...type.body, color: colors.textMuted, marginBottom: space.md },
  // As many cards side by side as fit (one on phones, two or three on wider screens).
  grid: (Platform.OS === "web"
    ? { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 360px), 1fr))", gap: space.lg, alignItems: "start" }
    : { gap: space.lg }) as object,

  card: { backgroundColor: colors.card, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, padding: space.lg, gap: space.md },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: space.sm },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1, minWidth: 0 },
  time: { ...type.body, fontWeight: "700", color: colors.primary },
  customerName: { ...type.heading, fontSize: 18, color: colors.text },
  eventType: { ...type.small, color: colors.textMuted, marginTop: 2 },
  facts: { gap: 6 },
  fact: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  factText: { ...type.small, lineHeight: 20, color: colors.text, flex: 1 },

  financeRow: { flexDirection: "row", backgroundColor: colors.cardRaised, borderRadius: radius.control, paddingVertical: space.sm },
  financeItem: { flex: 1, minWidth: 0, paddingHorizontal: space.md, gap: 2 },
  financeLabel: { ...type.caption, color: colors.textMuted },
  financeValue: { ...type.body, fontWeight: "700", color: colors.text, fontVariant: ["tabular-nums"] },

  crew: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: space.md, gap: space.sm },
  crewTitle: { ...type.small, fontWeight: "700", color: colors.text },
  hint: { ...type.small, color: colors.textMuted },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  crewChip: {
    flexDirection: "row", alignItems: "center", gap: space.sm, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.pill,
    minHeight: 36, paddingHorizontal: space.md, backgroundColor: colors.page,
  },
  crewChipText: { ...type.small, fontWeight: "600", color: colors.text },
  rowError: { ...type.small, color: colors.danger },
  assign: { alignSelf: "flex-start", minHeight: 40 },

  pickerCard: { borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.control, padding: space.md, backgroundColor: colors.page, gap: space.sm },
  pickerTitle: { ...type.small, fontWeight: "600", color: colors.textMuted },
  pickerClose: { alignSelf: "flex-start", minHeight: 36, paddingHorizontal: 0 },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.pill,
    minHeight: 36, paddingHorizontal: space.md, backgroundColor: colors.card,
  },
  chipPressed: { backgroundColor: colors.cardRaised },
  chipText: { ...type.small, fontWeight: "600", color: colors.text },
});
