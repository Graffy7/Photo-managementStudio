import { useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { eventsApi } from "../api/eventsApi";
import { workersApi } from "../api/workersApi";
import { extractErrorMessage } from "../api/errorMessage";
import type { AssignedWorker } from "../types/dayBoard";
import { Button } from "../ui/Button";
import { colors, radius, space, type } from "../ui/theme";

function WorkerPicker({ eventId, assignedWorkerIds, onDone }: { eventId: number; assignedWorkerIds: number[]; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const { data: workers, isPending } = useQuery({
    queryKey: ["workers-active-picker"],
    queryFn: () => workersApi.search({ isActive: true, pageSize: 100 }),
  });

  const assign = useMutation({
    mutationFn: (workerId: number) => eventsApi.assignWorker(eventId, workerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-workers", eventId] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
      onDone();
    },
    onError: (err) => setError(extractErrorMessage(err)),
  });

  const available = (workers?.items ?? []).filter((w) => !assignedWorkerIds.includes(w.workerId));

  return (
    <View style={styles.picker}>
      <Text style={styles.pickerTitle}>Choose a worker</Text>
      {isPending ? <ActivityIndicator color={colors.primary} style={{ alignSelf: "flex-start" }} /> : (
        <View style={styles.chips}>
          {available.map((w) => (
            <Pressable key={w.workerId} style={styles.chip} onPress={() => assign.mutate(w.workerId)} disabled={assign.isPending} accessibilityRole="button">
              <Text style={styles.chipText}>{w.fullName}{w.workerTypeName ? ` · ${w.workerTypeName}` : ""}</Text>
            </Pressable>
          ))}
          {available.length === 0 && <Text style={styles.hint}>No other active workers to assign.</Text>}
        </View>
      )}
      {error && <Text style={styles.error}>{error}</Text>}
      <Button label="Cancel" variant="link" onPress={onDone} style={{ alignSelf: "flex-start", marginLeft: -10 }} />
    </View>
  );
}

// Who is working on an event, with add / remove. Lives on the event's page.
export function EventTeam({ eventId, assigned }: { eventId: number; assigned: AssignedWorker[] }) {
  const queryClient = useQueryClient();
  const [showPicker, setShowPicker] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const { data: crew } = useQuery({
    queryKey: ["event-workers", eventId],
    queryFn: () => eventsApi.getAssignedWorkers(eventId),
    initialData: assigned,
    staleTime: 30000,
  });

  const unassign = useMutation({
    mutationFn: (workerId: number) => eventsApi.unassignWorker(eventId, workerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-workers", eventId] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
    onError: (err) => setRemoveError(extractErrorMessage(err)),
  });

  return (
    <View style={{ gap: space.sm }}>
      {!crew || crew.length === 0 ? (
        <Text style={styles.hint}>No team assigned yet.</Text>
      ) : (
        <View style={styles.chips}>
          {crew.map((w) => (
            <View key={w.eventWorkerId} style={styles.member}>
              <Text style={styles.memberText}>{w.workerName}{w.workerTypeName ? ` · ${w.workerTypeName}` : ""}</Text>
              <Pressable
                onPress={() => unassign.mutate(w.workerId)}
                disabled={unassign.isPending}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${w.workerName}`}
                hitSlop={8}
                style={styles.remove}
              >
                <Ionicons name="close" size={16} color={colors.textMuted} />
              </Pressable>
            </View>
          ))}
        </View>
      )}
      {removeError && <Text style={styles.error}>{removeError}</Text>}
      {showPicker ? (
        <WorkerPicker eventId={eventId} assignedWorkerIds={(crew ?? []).map((w) => w.workerId)} onDone={() => setShowPicker(false)} />
      ) : (
        <Button label="Assign worker" icon="add" variant="link" onPress={() => setShowPicker(true)} style={{ alignSelf: "flex-start", marginLeft: -10 }} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  member: {
    flexDirection: "row", alignItems: "center", gap: 4, minHeight: 36, borderWidth: 1, borderColor: colors.borderStrong,
    borderRadius: radius.pill, paddingLeft: space.md, backgroundColor: colors.cardRaised,
  },
  memberText: { ...type.small, fontWeight: "600", color: colors.text },
  remove: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  picker: { gap: space.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.card, padding: space.md, backgroundColor: colors.bar },
  pickerTitle: { ...type.small, fontWeight: "700", color: colors.textMuted },
  chip: { minHeight: 36, justifyContent: "center", borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.pill, paddingHorizontal: 14, backgroundColor: colors.card },
  chipText: { ...type.small, fontWeight: "600", color: colors.text },
  hint: { ...type.small, color: colors.textMuted },
  error: { ...type.small, color: colors.danger },
});
