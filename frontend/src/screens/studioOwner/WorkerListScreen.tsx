import { useState } from "react";
import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { workersApi } from "../../api/workersApi";
import { lookupApis } from "../../api/lookupsApi";
import type { Worker } from "../../types/worker";
import { StatusPill } from "../../components/StatusPill";
import { SearchInput } from "../../components/SearchInput";
import { useRefetchOnFocus } from "../../hooks/useRefetchOnFocus";

export function WorkerListScreen({ onCreate, onEdit, onView }: { onCreate: () => void; onEdit: (worker: Worker) => void; onView: (worker: Worker) => void }) {
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [workerTypeId, setWorkerTypeId] = useState<number | null>(null);

  const { data: workerTypes } = useQuery({ queryKey: ["lookups", "workerTypes"], queryFn: lookupApis.workerTypes.getAll });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["workers", search, workerTypeId],
    queryFn: () => workersApi.search({ search: search || undefined, workerTypeId: workerTypeId ?? undefined, page: 1, pageSize: 50 }),
  });
  useRefetchOnFocus(refetch);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["workers"] });

  const activate = useMutation({ mutationFn: workersApi.activate, onSuccess: invalidate });
  const deactivate = useMutation({ mutationFn: workersApi.deactivate, onSuccess: invalidate });

  const renderItem = ({ item }: { item: Worker }) => (
    <View style={styles.row}>
      <View style={styles.rowMain}>
        <Text style={styles.workerName}>{item.fullName}</Text>
        <Text style={styles.contact}>{[item.mobileNumber, item.email].filter(Boolean).join(" · ")}</Text>

        <View style={styles.pillRow}>
          <StatusPill label={item.isActive ? "Active" : "Inactive"} tone={item.isActive ? "good" : "neutral"} />
          {item.workerTypeName && <StatusPill label={item.workerTypeName} tone="neutral" />}
        </View>
      </View>
      <View style={styles.actions}>
        <Pressable style={styles.actionBtn} onPress={() => onView(item)}>
          <Text style={styles.actionText}>View</Text>
        </Pressable>
        <Pressable style={styles.actionBtn} onPress={() => onEdit(item)}>
          <Text style={styles.actionText}>Edit</Text>
        </Pressable>
        <Pressable
          style={styles.actionBtn}
          onPress={() => (item.isActive ? deactivate.mutate(item.workerId) : activate.mutate(item.workerId))}
        >
          <Text style={styles.actionText}>{item.isActive ? "Deactivate" : "Activate"}</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Workers</Text>
          <Text style={styles.subtitle}>{data?.totalCount ?? 0} total</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>‹ Home</Text>
          </Pressable>
          <Pressable style={styles.newButton} onPress={onCreate}>
            <Text style={styles.newButtonText}>+ New Worker</Text>
          </Pressable>
        </View>
      </View>

      <SearchInput style={styles.search} value={search} onChangeText={setSearch} placeholder="Search by name or mobile number" />

      {workerTypes && workerTypes.length > 0 && (
        <View style={styles.filterRow}>
          <Pressable style={[styles.filterChip, workerTypeId === null && styles.filterChipSelected]} onPress={() => setWorkerTypeId(null)}>
            <Text style={[styles.filterChipText, workerTypeId === null && styles.filterChipTextSelected]}>All</Text>
          </Pressable>
          {workerTypes.map((t) => (
            <Pressable key={t.id} style={[styles.filterChip, workerTypeId === t.id && styles.filterChipSelected]} onPress={() => setWorkerTypeId(t.id)}>
              <Text style={[styles.filterChipText, workerTypeId === t.id && styles.filterChipTextSelected]}>{t.name}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {isLoading ? (
        <ActivityIndicator color="#ff9a4d" style={{ marginTop: 40 }} />
      ) : isError ? (
        <Text style={styles.error}>Couldn't load workers.</Text>
      ) : (
        <FlatList
          data={data?.items ?? []}
          keyExtractor={(item) => String(item.workerId)}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={<Text style={styles.empty}>No workers yet — add the first one.</Text>}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0d1826", padding: 24 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 },
  headerActions: { flexDirection: "row", gap: 10 },
  title: { fontSize: 24, fontWeight: "700", color: "#e8edf3" },
  subtitle: { fontSize: 13, color: "#6f83a0", marginTop: 2 },
  newButton: { backgroundColor: "#ff9a4d", borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16 },
  newButtonText: { color: "#0d1826", fontWeight: "700", fontSize: 13 },
  backButton: { backgroundColor: "#132540", borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16, borderWidth: 1, borderColor: "#23405c", justifyContent: "center" },
  backText: { color: "#7fc0e6", fontWeight: "600", fontSize: 13 },
  search: {
    borderWidth: 1, borderColor: "#23405c", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10,
    color: "#e8edf3", backgroundColor: "#132540", marginBottom: 12, fontSize: 14,
  },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  filterChip: { borderWidth: 1, borderColor: "#23405c", borderRadius: 100, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: "#132540" },
  filterChipSelected: { borderColor: "#ff9a4d", backgroundColor: "rgba(255, 154, 77, 0.14)" },
  filterChipText: { color: "#a7b7cb", fontSize: 12, fontWeight: "600" },
  filterChipTextSelected: { color: "#ff9a4d" },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingVertical: 14 },
  rowMain: { flex: 1, gap: 4 },
  workerName: { color: "#e8edf3", fontSize: 16, fontWeight: "600" },
  contact: { color: "#a7b7cb", fontSize: 13 },
  pillRow: { flexDirection: "row", gap: 6, marginTop: 4, flexWrap: "wrap" },
  actions: { flexDirection: "row", gap: 8 },
  actionBtn: { borderWidth: 1, borderColor: "#23405c", borderRadius: 6, paddingVertical: 7, paddingHorizontal: 12 },
  actionText: { color: "#a7b7cb", fontSize: 12, fontWeight: "600" },
  separator: { height: 1, backgroundColor: "#1b2c42" },
  error: { color: "#ff7a72", marginTop: 40, textAlign: "center" },
  empty: { color: "#6f83a0", marginTop: 40, textAlign: "center" },
});
