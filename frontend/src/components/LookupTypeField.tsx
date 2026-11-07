import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { extractErrorMessage } from "../api/errorMessage";
import type { CreateLookupRequest, Lookup } from "../types/lookup";
import { ConfirmDialog } from "../ui/ConfirmDialog";

interface LookupApi {
  getAll: () => Promise<Lookup[]>;
  create: (request: CreateLookupRequest) => Promise<Lookup>;
  remove: (id: number) => Promise<unknown>;
}

// A single-select chip row for a studio-managed lookup (event type, worker type, ...) that lets
// the owner add a new value inline (text box + OK) or delete a mistyped one (confirmed; the
// server refuses if it's already in use). Shared so every module offers the same behaviour.
export function LookupTypeField({
  label,
  noun,
  queryKey,
  api,
  selectedId,
  onSelect,
}: {
  label: string;
  noun: string;
  queryKey: readonly unknown[];
  api: LookupApi;
  selectedId: number | null;
  onSelect: (id: number | null) => void;
}) {
  const queryClient = useQueryClient();
  const { data: types } = useQuery({ queryKey, queryFn: api.getAll });

  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [deleteMode, setDeleteMode] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ id: number; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: (name: string) => api.create({ name }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey });
      onSelect(created.id);
      setNewName("");
      setAdding(false);
    },
    onError: (err) => setError(extractErrorMessage(err)),
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.remove(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey });
      if (selectedId === id) onSelect(null);
      setPendingDelete(null);
      setError(null);
    },
    onError: (err) => setError(extractErrorMessage(err)),
  });

  // OK on an empty box just closes it, so there's no separate cancel control.
  const confirmNew = () => {
    const name = newName.trim();
    if (!name) {
      setAdding(false);
      setError(null);
      return;
    }
    create.mutate(name);
  };

  const list = types ?? [];

  return (
    <View>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {list.length > 0 && (
          <Pressable onPress={() => { setDeleteMode((m) => !m); setPendingDelete(null); setError(null); }}>
            <Text style={deleteMode ? styles.doneLink : styles.deleteLink}>{deleteMode ? "Done" : "Delete a type"}</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.chipRow}>
        {!deleteMode && (
          <Pressable style={[styles.chip, selectedId === null && styles.chipSelected]} onPress={() => onSelect(null)}>
            <Text style={[styles.chipText, selectedId === null && styles.chipTextSelected]}>None</Text>
          </Pressable>
        )}
        {list.map((t) =>
          deleteMode ? (
            <Pressable
              key={t.id}
              style={[styles.chip, styles.chipDelete, pendingDelete?.id === t.id && styles.chipDeletePending]}
              onPress={() => { setPendingDelete({ id: t.id, name: t.name }); setError(null); }}
            >
              <Text style={styles.chipDeleteText}>{t.name}  ×</Text>
            </Pressable>
          ) : (
            <Pressable key={t.id} style={[styles.chip, selectedId === t.id && styles.chipSelected]} onPress={() => onSelect(t.id)}>
              <Text style={[styles.chipText, selectedId === t.id && styles.chipTextSelected]}>{t.name}</Text>
            </Pressable>
          )
        )}
        {!adding && !deleteMode && (
          <Pressable style={styles.chip} onPress={() => { setAdding(true); setError(null); }}>
            <Text style={styles.addChipText}>+ Add {noun}</Text>
          </Pressable>
        )}
      </View>

      {deleteMode && !pendingDelete && <Text style={styles.deleteHint}>Tap a type to delete it.</Text>}
      <ConfirmDialog
        visible={deleteMode && !!pendingDelete}
        title={`Delete “${pendingDelete?.name ?? ""}”?`}
        message="It will no longer be offered as a choice. Records already using it keep it."
        confirmLabel="Delete"
        busy={remove.isPending}
        error={pendingDelete ? error : null}
        onCancel={() => { setPendingDelete(null); setError(null); }}
        onConfirm={() => pendingDelete && remove.mutate(pendingDelete.id)}
      />

      {adding && (
        <View style={styles.addRow}>
          <TextInput
            style={styles.input}
            value={newName}
            onChangeText={setNewName}
            placeholder={`${noun[0].toUpperCase()}${noun.slice(1)} name`}
            placeholderTextColor="#A4AFCF"
            autoFocus
            onSubmitEditing={confirmNew}
          />
          <Pressable style={styles.okButton} onPress={confirmNew} disabled={create.isPending}>
            {create.isPending ? <ActivityIndicator color="#070F24" /> : <Text style={styles.okText}>OK</Text>}
          </Pressable>
        </View>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  labelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 14, marginBottom: 6 },
  label: { fontSize: 13, color: "#A4AFCF" },
  deleteLink: { color: "#FF5C75", fontSize: 12, fontWeight: "600" },
  doneLink: { color: "#5B9BFF", fontSize: 12, fontWeight: "700" },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: "#2E4377", borderRadius: 100, paddingVertical: 7, paddingHorizontal: 14, backgroundColor: "#111E3F" },
  chipSelected: { borderColor: "#5B9BFF", backgroundColor: "rgba(91,155,255,0.14)" },
  chipText: { color: "#A4AFCF", fontSize: 12, fontWeight: "600" },
  chipTextSelected: { color: "#5B9BFF" },
  addChipText: { color: "#5B9BFF", fontSize: 12, fontWeight: "700" },
  chipDelete: { borderColor: "rgba(255,92,117,0.4)", backgroundColor: "rgba(255,92,117,0.06)" },
  chipDeletePending: { borderColor: "#FF5C75", backgroundColor: "rgba(255,92,117,0.18)" },
  chipDeleteText: { color: "#FF5C75", fontSize: 12, fontWeight: "600" },

  deleteHint: { color: "#A4AFCF", fontSize: 13, marginTop: 8 },
  confirmRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10, gap: 10 },
  confirmText: { color: "#FF5C75", fontSize: 13, fontWeight: "600", flexShrink: 1 },
  confirmActions: { flexDirection: "row", alignItems: "center", gap: 14 },
  cancelInline: { color: "#A4AFCF", fontSize: 12, fontWeight: "600" },
  confirmButton: { borderWidth: 1, borderColor: "#FF5C75", backgroundColor: "rgba(255,92,117,0.14)", borderRadius: 8, paddingVertical: 7, paddingHorizontal: 12 },
  confirmButtonText: { color: "#FF5C75", fontSize: 12, fontWeight: "700" },

  addRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  input: {
    flex: 1, borderWidth: 1, borderColor: "#2E4377", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 15, color: "#F2F5FF", backgroundColor: "#111E3F",
  },
  okButton: { backgroundColor: "#5B9BFF", borderRadius: 8, paddingHorizontal: 20, justifyContent: "center", alignItems: "center" },
  okText: { color: "#070F24", fontWeight: "700", fontSize: 14 },
  error: { color: "#FF5C75", marginTop: 8, fontSize: 13 },
});
