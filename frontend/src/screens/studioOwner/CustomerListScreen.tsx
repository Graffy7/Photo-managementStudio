import { useState } from "react";
import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customersApi } from "../../api/customersApi";
import type { Customer } from "../../types/customer";
import { StatusPill } from "../../components/StatusPill";
import { SearchInput } from "../../components/SearchInput";
import { useRefetchOnFocus } from "../../hooks/useRefetchOnFocus";

export function CustomerListScreen({ onCreate, onEdit, onView }: { onCreate: () => void; onEdit: (customer: Customer) => void; onView: (customer: Customer) => void }) {
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["customers", search],
    queryFn: () => customersApi.search({ search: search || undefined, page: 1, pageSize: 50 }),
  });
  useRefetchOnFocus(refetch);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["customers"] });

  const activate = useMutation({ mutationFn: customersApi.activate, onSuccess: invalidate });
  const deactivate = useMutation({ mutationFn: customersApi.deactivate, onSuccess: invalidate });

  const renderItem = ({ item }: { item: Customer }) => (
    <View style={styles.row}>
      <View style={styles.rowMain}>
        <Text style={styles.customerName}>{item.fullName}</Text>
        <Text style={styles.contact}>{item.mobileNumber}{item.email ? ` · ${item.email}` : ""}</Text>
        {item.address ? <Text style={styles.meta}>{item.address}</Text> : null}
        {item.notes ? <Text style={styles.notes} numberOfLines={2}>{item.notes}</Text> : null}

        <View style={styles.pillRow}>
          <StatusPill label={item.isActive ? "Active" : "Inactive"} tone={item.isActive ? "good" : "neutral"} />
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
          onPress={() => (item.isActive ? deactivate.mutate(item.customerId) : activate.mutate(item.customerId))}
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
          <Text style={styles.title}>Customers</Text>
          <Text style={styles.subtitle}>{data?.totalCount ?? 0} total</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>‹ Home</Text>
          </Pressable>
          <Pressable style={styles.newButton} onPress={onCreate}>
            <Text style={styles.newButtonText}>+ New Customer</Text>
          </Pressable>
        </View>
      </View>

      <SearchInput style={styles.search} value={search} onChangeText={setSearch} placeholder="Search by name or mobile number" />

      {isPending ? (
        <ActivityIndicator color="#ff9a4d" style={{ marginTop: 40 }} />
      ) : isError ? (
        <Text style={styles.error}>Couldn't load customers.</Text>
      ) : (
        <FlatList
          data={data?.items ?? []}
          keyExtractor={(item) => String(item.customerId)}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={<Text style={styles.empty}>No customers yet — add the first one, or convert an enquiry.</Text>}
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
  customerName: { color: "#e8edf3", fontSize: 16, fontWeight: "600" },
  contact: { color: "#a7b7cb", fontSize: 13 },
  meta: { color: "#6f83a0", fontSize: 12 },
  notes: { color: "#6f83a0", fontSize: 11.5, fontStyle: "italic", marginTop: 2, lineHeight: 15 },
  pillRow: { flexDirection: "row", gap: 6, marginTop: 4, flexWrap: "wrap" },
  actions: { flexDirection: "row", gap: 8 },
  actionBtn: { borderWidth: 1, borderColor: "#23405c", borderRadius: 6, paddingVertical: 7, paddingHorizontal: 12 },
  actionText: { color: "#a7b7cb", fontSize: 12, fontWeight: "600" },
  separator: { height: 1, backgroundColor: "#1b2c42" },
  error: { color: "#ff7a72", marginTop: 40, textAlign: "center" },
  empty: { color: "#6f83a0", marginTop: 40, textAlign: "center" },
});
