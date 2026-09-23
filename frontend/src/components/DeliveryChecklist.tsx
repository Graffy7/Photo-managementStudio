import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { eventsApi } from "../api/eventsApi";
import { extractErrorMessage } from "../api/errorMessage";
import type { DeliveryItem } from "../types/event";

interface Props {
  eventId: number;
  // The checklist arrives with the event, so the row shows instantly and fetches nothing.
  items: DeliveryItem[];
  // The detail page already heads its card "Delivery status", so it hides this one's own label.
  showLabel?: boolean;
}

// A compact "what have we handed over" strip for a completed event: Album, Video and Photos always,
// plus anything the studio adds. Deliberately small — the customer and event details stay the focus.
export function DeliveryChecklist({ eventId, items, showLabel = true }: Props) {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [pendingDelete, setPendingDelete] = useState<number | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: checklist = items } = useQuery({
    queryKey: ["event-delivery", eventId],
    queryFn: () => eventsApi.delivery(eventId),
    initialData: items,
    staleTime: 30000,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["event-delivery", eventId] });
    queryClient.invalidateQueries({ queryKey: ["events"] });
    queryClient.invalidateQueries({ queryKey: ["customer-events"] });
  };

  const toggle = useMutation({
    mutationFn: (item: DeliveryItem) =>
      eventsApi.setDelivery(eventId, {
        itemId: item.itemId,
        itemKey: item.itemKey ?? undefined,
        isDelivered: !item.isDelivered,
      }),
    onSuccess: refresh,
    onError: (err) => setError(extractErrorMessage(err)),
  });

  const add = useMutation({
    mutationFn: (name: string) => eventsApi.addDeliveryItem(eventId, name),
    onSuccess: () => {
      setNewName("");
      setAdding(false);
      setError(null);
      refresh();
    },
    onError: (err) => setError(extractErrorMessage(err)),
  });

  const remove = useMutation({
    mutationFn: (itemId: number) => eventsApi.deleteDeliveryItem(eventId, itemId),
    onSuccess: () => {
      setPendingDelete(null);
      refresh();
    },
    onError: (err) => setError(extractErrorMessage(err)),
  });

  return (
    <View style={styles.wrapper}>
      {showLabel && <Text style={styles.label}>Delivery</Text>}

      <View style={styles.row}>
        {checklist.map((item) => {
          const key = item.itemKey ?? `custom-${item.itemId}`;
          const showRemove = item.isCustom && (hovered === key || pendingDelete === item.itemId);
          return (
            <View key={key} style={styles.pillWrap}>
              <Pressable
                style={[styles.pill, item.isDelivered && styles.pillDone]}
                onPress={() => toggle.mutate(item)}
                onHoverIn={() => setHovered(key)}
                onHoverOut={() => setHovered((h) => (h === key ? null : h))}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: item.isDelivered }}
                accessibilityLabel={`${item.name} ${item.isDelivered ? "delivered" : "pending"}`}
                // @ts-expect-error - title is a web-only tooltip, harmless on native
                title={item.isDelivered
                  ? `${item.name} delivered${item.deliveredAt ? ` on ${new Date(item.deliveredAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}` : ""}`
                  : `${item.name} not delivered yet — tap to mark delivered`}
              >
                <Ionicons
                  name={item.isDelivered ? "checkmark-circle" : "ellipse-outline"}
                  size={13}
                  color={item.isDelivered ? "#4cc493" : "#6f83a0"}
                />
                <Text style={[styles.pillText, item.isDelivered && styles.pillTextDone]}>{item.name}</Text>
              </Pressable>

              {showRemove && (
                <Pressable
                  style={styles.removeButton}
                  onPress={() => setPendingDelete(item.itemId)}
                  onHoverIn={() => setHovered(key)}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${item.name}`}
                  hitSlop={6}
                >
                  <Ionicons name="close" size={10} color="#a7b7cb" />
                </Pressable>
              )}
            </View>
          );
        })}

        {adding ? (
          <View style={styles.addRow}>
            <TextInput
              style={styles.addInput}
              value={newName}
              onChangeText={setNewName}
              placeholder="e.g. Pendrive"
              placeholderTextColor="#6f83a0"
              autoFocus
              maxLength={100}
              onSubmitEditing={() => newName.trim() && add.mutate(newName.trim())}
            />
            <Pressable
              style={styles.addConfirm}
              onPress={() => newName.trim() && add.mutate(newName.trim())}
              disabled={add.isPending || !newName.trim()}
              accessibilityRole="button"
              accessibilityLabel="Save delivery item"
            >
              {add.isPending
                ? <ActivityIndicator size="small" color="#4cc493" />
                : <Ionicons name="checkmark" size={13} color="#4cc493" />}
            </Pressable>
            <Pressable
              style={styles.addCancel}
              onPress={() => { setAdding(false); setNewName(""); setError(null); }}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Ionicons name="close" size={13} color="#6f83a0" />
            </Pressable>
          </View>
        ) : (
          <Pressable
            style={styles.addTrigger}
            onPress={() => { setAdding(true); setError(null); }}
            accessibilityRole="button"
            accessibilityLabel="Add a delivery item"
          >
            <Text style={styles.addTriggerText}>+ Add</Text>
          </Pressable>
        )}
      </View>

      {pendingDelete !== null && (
        <View style={styles.confirmRow}>
          <Text style={styles.confirmText}>
            Remove “{checklist.find((i) => i.itemId === pendingDelete)?.name}” from this event's delivery list?
          </Text>
          <Pressable onPress={() => setPendingDelete(null)} accessibilityRole="button">
            <Text style={styles.confirmCancel}>No</Text>
          </Pressable>
          <Pressable onPress={() => remove.mutate(pendingDelete)} disabled={remove.isPending} accessibilityRole="button">
            {remove.isPending
              ? <ActivityIndicator size="small" color="#ff7a72" />
              : <Text style={styles.confirmYes}>Yes, remove</Text>}
          </Pressable>
        </View>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 6 },
  label: {
    color: "#6f83a0", fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.4,
  },
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 },

  pillWrap: { position: "relative" },
  pill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    borderWidth: 1, borderColor: "#23405c", borderRadius: 100,
    paddingVertical: 4, paddingHorizontal: 10, backgroundColor: "#0f1e30",
  },
  pillDone: { borderColor: "rgba(76, 196, 147, 0.45)", backgroundColor: "rgba(76, 196, 147, 0.10)" },
  pillText: { color: "#a7b7cb", fontSize: 12, fontWeight: "600" },
  pillTextDone: { color: "#4cc493" },

  // Only appears while the pill is hovered, and sits clear of the tap target so a tick can't delete.
  removeButton: {
    position: "absolute", top: -6, right: -6, width: 16, height: 16, borderRadius: 8,
    alignItems: "center", justifyContent: "center", backgroundColor: "#132540", borderWidth: 1, borderColor: "#23405c",
  },

  addTrigger: { paddingVertical: 4, paddingHorizontal: 8 },
  addTriggerText: { color: "#7fc0e6", fontSize: 12, fontWeight: "600" },
  addRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  addInput: {
    borderWidth: 1, borderColor: "#23405c", borderRadius: 100, paddingVertical: 4, paddingHorizontal: 10,
    color: "#e8edf3", backgroundColor: "#0f1e30", fontSize: 12, minWidth: 130,
    outlineStyle: "none",
  } as any,
  addConfirm: { padding: 4 },
  addCancel: { padding: 4 },

  confirmRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 10, marginTop: 2 },
  confirmText: { color: "#a7b7cb", fontSize: 12, flexShrink: 1 },
  confirmCancel: { color: "#a7b7cb", fontSize: 12, fontWeight: "600" },
  confirmYes: { color: "#ff7a72", fontSize: 12, fontWeight: "700" },

  error: { color: "#ff7a72", fontSize: 11 },
});
