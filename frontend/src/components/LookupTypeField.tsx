import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { extractErrorMessage } from "../api/errorMessage";
import type { CreateLookupRequest, Lookup } from "../types/lookup";

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
      {deleteMode && pendingDelete && (
        <View style={styles.confirmRow}>
          <Text style={styles.confirmText}>Delete "{pendingDelete.name}"?</Text>
          <View style={styles.confirmActions}>
            <Pressable onPress={() => { setPendingDelete(null); setError(null); }} disabled={remove.isPending}>
              <Text style={styles.cancelInline}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.confirmButton} onPress={() => remove.mutate(pendingDelete.id)} disabled={remove.isPending}>
              {remove.isPending ? <ActivityIndicator color="#E58B91" size="small" /> : <Text style={styles.confirmButtonText}>Confirm Delete</Text>}
            </Pressable>
          </View>
        </View>
      )}

      {adding && (
        <View style={styles.addRow}>
          <TextInput
            style={styles.input}
            value={newName}
            onChangeText={setNewName}
            placeholder={`${noun[0].toUpperCase()}${noun.slice(1)} name`}
            placeholderTextColor="#A1A5B3"
            autoFocus
            onSubmitEditing={confirmNew}
          />
          <Pressable style={styles.okButton} onPress={confirmNew} disabled={create.isPending}>
            {create.isPending ? <ActivityIndicator color="#191B22" /> : <Text style={styles.okText}>OK</Text>}
          </Pressable>
        </View>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  labelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 14, marginBottom: 6 },
  label: { fontSize: 13, color: "#A1A5B3" },
  deleteLink: { color: "#E58B91", fontSize: 12, fontWeight: "600" },
  doneLink: { color: "#B5A5FF", fontSize: 12, fontWeight: "700" },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderColor: "#4B4F63", borderRadius: 100, paddingVertical: 7, paddingHorizontal: 14, backgroundColor: "#292C36" },
  chipSelected: { borderColor: "#B5A5FF", backgroundColor: "rgba(181,165,255,0.14)" },
  chipText: { color: "#A1A5B3", fontSize: 12, fontWeight: "600" },
  chipTextSelected: { color: "#B5A5FF" },
  addChipText: { color: "#B5A5FF", fontSize: 12, fontWeight: "700" },
  chipDelete: { borderColor: "#5a3a3d", backgroundColor: "rgba(229,139,145,0.06)" },
  chipDeletePending: { borderColor: "#E58B91", backgroundColor: "rgba(229,139,145,0.18)" },
  chipDeleteText: { color: "#E58B91", fontSize: 12, fontWeight: "600" },

  deleteHint: { color: "#A1A5B3", fontSize: 13, marginTop: 8 },
  confirmRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10, gap: 10 },
  confirmText: { color: "#E58B91", fontSize: 13, fontWeight: "600", flexShrink: 1 },
  confirmActions: { flexDirection: "row", alignItems: "center", gap: 14 },
  cancelInline: { color: "#A1A5B3", fontSize: 12, fontWeight: "600" },
  confirmButton: { borderWidth: 1, borderColor: "#E58B91", backgroundColor: "rgba(229,139,145,0.14)", borderRadius: 8, paddingVertical: 7, paddingHorizontal: 12 },
  confirmButtonText: { color: "#E58B91", fontSize: 12, fontWeight: "700" },

  addRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  input: {
    flex: 1, borderWidth: 1, borderColor: "#4B4F63", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 15, color: "#E6E7EC", backgroundColor: "#292C36",
  },
  okButton: { backgroundColor: "#B5A5FF", borderRadius: 8, paddingHorizontal: 20, justifyContent: "center", alignItems: "center" },
  okText: { color: "#191B22", fontWeight: "700", fontSize: 14 },
  error: { color: "#E58B91", marginTop: 8, fontSize: 13 },
});
