import { useState } from "react";
import { SubscriptionLock } from "../../components/SubscriptionLock";
import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { servicesApi } from "../../api/servicesApi";
import type { StudioService } from "../../types/service";
import { StatusPill } from "../../components/StatusPill";
import { SearchInput } from "../../components/SearchInput";
import { useRefetchOnFocus } from "../../hooks/useRefetchOnFocus";
import { compactList, useCompactLayout } from "../../styles/compactList";

function formatCurrency(value: number): string {
  return `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function ServiceListScreen({ onCreate, onEdit }: { onCreate: () => void; onEdit: (service: StudioService) => void }) {
  const compact = useCompactLayout();
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["services", search],
    queryFn: () => servicesApi.search({ search: search || undefined, page: 1, pageSize: 50 }),
  });
  useRefetchOnFocus(refetch);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["services"] });

  const activate = useMutation({ mutationFn: servicesApi.activate, onSuccess: invalidate });
  const deactivate = useMutation({ mutationFn: servicesApi.deactivate, onSuccess: invalidate });

  const renderItem = ({ item }: { item: StudioService }) => (
    <View style={[styles.row, compact && compactList.row]}>
      <View style={styles.rowMain}>
        <Text style={styles.serviceName}>{item.serviceName}</Text>
        {item.description ? <Text style={styles.description}>{item.description}</Text> : null}
        <Text style={styles.price}>{formatCurrency(item.defaultPrice)}</Text>

        <View style={styles.pillRow}>
          <StatusPill label={item.isActive ? "Active" : "Inactive"} tone={item.isActive ? "good" : "neutral"} />
        </View>
      </View>
      <View style={[styles.actions, compact && compactList.actions]}>
        <SubscriptionLock compact>
          <Pressable style={styles.actionBtn} onPress={() => onEdit(item)}>
            <Text style={styles.actionText}>Edit</Text>
          </Pressable>
        </SubscriptionLock>
        <Pressable
          style={styles.actionBtn}
          onPress={() => (item.isActive ? deactivate.mutate(item.serviceId) : activate.mutate(item.serviceId))}
        >
          <Text style={styles.actionText}>{item.isActive ? "Deactivate" : "Activate"}</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <View style={[styles.screen, compact && compactList.screen]}>
      <View style={[styles.header, compact && compactList.header]}>
        <View>
          <Text style={styles.title}>Services</Text>
          <Text style={styles.subtitle}>{data?.totalCount ?? 0} total</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>‹ Home</Text>
          </Pressable>
          <SubscriptionLock>
            <Pressable style={styles.newButton} onPress={onCreate}>
              <Text style={styles.newButtonText}>+ New Service</Text>
            </Pressable>
          </SubscriptionLock>
        </View>
      </View>

      <SearchInput style={styles.search} value={search} onChangeText={setSearch} placeholder="Search by service name" />

      {isPending ? (
        <ActivityIndicator color="#ff9a4d" style={{ marginTop: 40 }} />
      ) : isError ? (
        <Text style={styles.error}>Couldn't load services.</Text>
      ) : (
        <FlatList
          data={data?.items ?? []}
          keyExtractor={(item) => String(item.serviceId)}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={<Text style={styles.empty}>No services yet — add the first one.</Text>}
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
    color: "#e8edf3", backgroundColor: "#132540", marginBottom: 16, fontSize: 14,
  },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingVertical: 14 },
  rowMain: { flex: 1, gap: 4 },
  serviceName: { color: "#e8edf3", fontSize: 16, fontWeight: "600" },
  description: { color: "#a7b7cb", fontSize: 13 },
  price: { color: "#7fc0e6", fontSize: 13, fontWeight: "600" },
  pillRow: { flexDirection: "row", gap: 6, marginTop: 4, flexWrap: "wrap" },
  actions: { flexDirection: "row", gap: 8 },
  actionBtn: { borderWidth: 1, borderColor: "#23405c", borderRadius: 6, paddingVertical: 7, paddingHorizontal: 12 },
  actionText: { color: "#a7b7cb", fontSize: 12, fontWeight: "600" },
  separator: { height: 1, backgroundColor: "#1b2c42" },
  error: { color: "#ff7a72", marginTop: 40, textAlign: "center" },
  empty: { color: "#6f83a0", marginTop: 40, textAlign: "center" },
});
