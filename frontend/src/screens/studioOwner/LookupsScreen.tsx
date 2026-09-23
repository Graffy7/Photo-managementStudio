import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, ScrollView } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { lookupApis, LookupKind } from "../../api/lookupsApi";
import { extractErrorMessage } from "../../api/errorMessage";
import { StatusPill } from "../../components/StatusPill";

const TABS: { key: LookupKind; label: string }[] = [
  { key: "eventTypes", label: "Event Types" },
  { key: "leadSources", label: "Enquiry Sources" },
  { key: "leadStatuses", label: "Enquiry Statuses" },
  { key: "workerTypes", label: "Worker Types" },
];

export function LookupsScreen() {
  const navigation = useNavigation<any>();
  const [tab, setTab] = useState<LookupKind>("eventTypes");
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const api = lookupApis[tab];

  const { data, isPending } = useQuery({ queryKey: ["lookups", tab], queryFn: api.getAll });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["lookups", tab] });

  const create = useMutation({
    mutationFn: () => api.create({ name: newName }),
    onSuccess: () => {
      setNewName("");
      setError(null);
      invalidate();
    },
    onError: (err) => setError(extractErrorMessage(err)),
  });

  const toggleActive = useMutation({
    mutationFn: (item: { id: number; name: string; isActive: boolean; displayOrder: number }) =>
      api.update(item.id, { name: item.name, isActive: !item.isActive, displayOrder: item.displayOrder }),
    onSuccess: invalidate,
  });

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
        <Text style={styles.backText}>‹ Settings</Text>
      </Pressable>
      <Text style={styles.title}>Dropdown lists</Text>
      <Text style={styles.subtitle}>The values your team picks from when creating an enquiry or event.</Text>

      <View style={styles.tabRow}>
        {TABS.map((t) => (
          <Pressable
            key={t.key}
            style={[styles.tab, tab === t.key && styles.tabActive]}
            onPress={() => { setTab(t.key); setError(null); }}
          >
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.addRow}>
        <TextInput
          style={styles.input}
          value={newName}
          onChangeText={setNewName}
          placeholder={`Add a new ${TABS.find((t) => t.key === tab)!.label.toLowerCase().replace(/s$/, "")}`}
          placeholderTextColor="#6f83a0"
        />
        <Pressable style={styles.addButton} onPress={() => newName.trim() && create.mutate()} disabled={create.isPending}>
          {create.isPending ? <ActivityIndicator color="#0d1826" /> : <Text style={styles.addButtonText}>Add</Text>}
        </Pressable>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {isPending ? (
        <ActivityIndicator color="#ff9a4d" style={{ marginTop: 30 }} />
      ) : (
        <View style={styles.list}>
          {(data ?? []).map((item) => (
            <View key={item.id} style={styles.row}>
              <Text style={styles.rowName}>{item.name}</Text>
              <View style={styles.rowRight}>
                <StatusPill label={item.isActive ? "Active" : "Inactive"} tone={item.isActive ? "good" : "neutral"} />
                <Pressable style={styles.toggleButton} onPress={() => toggleActive.mutate(item)}>
                  <Text style={styles.toggleButtonText}>{item.isActive ? "Disable" : "Enable"}</Text>
                </Pressable>
              </View>
            </View>
          ))}
          {(data ?? []).length === 0 && <Text style={styles.empty}>Nothing here yet — add one above.</Text>}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0d1826" },
  content: { padding: 24, maxWidth: 560, width: "100%", alignSelf: "center" },
  backButton: { marginBottom: 14 },
  backText: { color: "#7fc0e6", fontSize: 13, fontWeight: "600" },
  title: { fontSize: 24, fontWeight: "700", color: "#e8edf3" },
  subtitle: { fontSize: 13, color: "#6f83a0", marginTop: 4, marginBottom: 20 },
  tabRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 18 },
  tab: { borderWidth: 1, borderColor: "#23405c", borderRadius: 100, paddingVertical: 7, paddingHorizontal: 14, backgroundColor: "#132540" },
  tabActive: { backgroundColor: "rgba(255, 154, 77, 0.14)", borderColor: "#ff9a4d" },
  tabText: { color: "#a7b7cb", fontSize: 12, fontWeight: "600" },
  tabTextActive: { color: "#ff9a4d" },
  addRow: { flexDirection: "row", gap: 10, marginBottom: 6 },
  input: {
    flex: 1, borderWidth: 1, borderColor: "#23405c", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14, color: "#e8edf3", backgroundColor: "#132540",
  },
  addButton: { backgroundColor: "#ff9a4d", borderRadius: 8, paddingHorizontal: 20, justifyContent: "center" },
  addButtonText: { color: "#0d1826", fontWeight: "700", fontSize: 13 },
  error: { color: "#ff7a72", fontSize: 12, marginTop: 8 },
  list: {
    marginTop: 20, borderWidth: 1, borderColor: "#23405c", borderRadius: 10, backgroundColor: "#132540", overflow: "hidden",
  },
  row: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: "#1b2c42",
  },
  rowName: { color: "#e8edf3", fontSize: 14, fontWeight: "600" },
  rowRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  toggleButton: { borderWidth: 1, borderColor: "#23405c", borderRadius: 6, paddingVertical: 5, paddingHorizontal: 10 },
  toggleButtonText: { color: "#a7b7cb", fontSize: 12, fontWeight: "600" },
  empty: { color: "#6f83a0", fontSize: 13, textAlign: "center", padding: 20 },
});
