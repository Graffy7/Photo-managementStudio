import { useState } from "react";
import { View, Text, TextInput, FlatList, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { leadsApi } from "../../api/leadsApi";
import { lookupApis } from "../../api/lookupsApi";
import type { Lead } from "../../types/lead";
import { StatusPill } from "../../components/StatusPill";
import { extractErrorMessage } from "../../api/errorMessage";
import { MiniDatePicker } from "../../components/MiniDatePicker";
import { useRefetchOnFocus } from "../../hooks/useRefetchOnFocus";

function formatDate(value: string | null): string {
  if (!value) return null as unknown as string;
  return new Date(value).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
}

function formatCurrency(value: number): string {
  return `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// react-native-web's Alert.alert() is a no-op stub, so confirmations are rendered inline
// in the row itself rather than via Alert (which never shows on the web target).
type PendingAction = { leadId: number; kind: "delete" | "convert" } | null;

export function LeadListScreen({ onCreate, onEdit, onView }: { onCreate: () => void; onEdit: (lead: Lead) => void; onView: (lead: Lead) => void }) {
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [leadStatusId, setLeadStatusId] = useState<number | null>(null);
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [pending, setPending] = useState<PendingAction>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: leadStatuses } = useQuery({ queryKey: ["lookups", "leadStatuses"], queryFn: lookupApis.leadStatuses.getAll });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["leads", search, leadStatusId, createdFrom, createdTo],
    queryFn: () =>
      leadsApi.search({
        search: search || undefined,
        leadStatusId: leadStatusId ?? undefined,
        createdFrom: createdFrom || undefined,
        createdTo: createdTo || undefined,
        page: 1,
        pageSize: 50,
      }),
  });
  useRefetchOnFocus(refetch);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["leads"] });

  const convert = useMutation({
    mutationFn: leadsApi.convert,
    onSuccess: () => {
      setPending(null);
      setActionError(null);
      invalidate();
    },
    onError: (err) => setActionError(extractErrorMessage(err)),
  });

  const remove = useMutation({
    mutationFn: leadsApi.remove,
    onSuccess: () => {
      setPending(null);
      setActionError(null);
      invalidate();
    },
    onError: (err) => setActionError(extractErrorMessage(err)),
  });

  const cancelPending = () => {
    setPending(null);
    setActionError(null);
  };

  const renderItem = ({ item }: { item: Lead }) => {
    const isPending = pending?.leadId === item.leadId;
    const isBusy = (convert.isPending && convert.variables === item.leadId) || (remove.isPending && remove.variables === item.leadId);

    return (
      <View style={styles.row}>
        <View style={styles.rowMain}>
          <Text style={styles.leadName}>{item.fullName}</Text>
          <Text style={styles.contact}>{item.mobileNumber}{item.email ? ` · ${item.email}` : ""}</Text>

          <View style={styles.pillRow}>
            {item.leadStatusName && <StatusPill label={item.leadStatusName} tone="neutral" />}
            {item.leadSourceName && <StatusPill label={item.leadSourceName} tone="neutral" />}
            {item.eventTypeName && <StatusPill label={item.eventTypeName} tone="neutral" />}
            {item.convertedCustomerId && <StatusPill label="Converted" tone="good" />}
          </View>

          {(item.expectedEventDate || item.expectedBudget) && (
            <Text style={styles.meta}>
              {item.expectedEventDate ? formatDate(item.expectedEventDate) : ""}
              {item.expectedEventDate && item.expectedBudget ? " · " : ""}
              {item.expectedBudget ? formatCurrency(item.expectedBudget) : ""}
            </Text>
          )}

          {isPending && actionError && <Text style={styles.rowError}>{actionError}</Text>}
        </View>

        {isPending ? (
          <View style={styles.actions}>
            <Pressable style={styles.actionBtn} onPress={cancelPending} disabled={isBusy}>
              <Text style={styles.actionText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.actionBtn, styles.actionBtnDanger]}
              disabled={isBusy}
              onPress={() => (pending!.kind === "delete" ? remove.mutate(item.leadId) : convert.mutate(item.leadId))}
            >
              {isBusy ? (
                <ActivityIndicator color="#ff7a72" size="small" />
              ) : (
                <Text style={[styles.actionText, styles.actionTextDanger]}>
                  {pending!.kind === "delete" ? "Confirm delete" : "Confirm convert"}
                </Text>
              )}
            </Pressable>
          </View>
        ) : (
          <View style={styles.actions}>
            <Pressable style={styles.actionBtn} onPress={() => onView(item)}>
              <Text style={styles.actionText}>View</Text>
            </Pressable>
            <Pressable style={styles.actionBtn} onPress={() => onEdit(item)}>
              <Text style={styles.actionText}>Edit</Text>
            </Pressable>
            {!item.convertedCustomerId && (
              <Pressable style={styles.actionBtn} onPress={() => setPending({ leadId: item.leadId, kind: "convert" })}>
                <Text style={styles.actionText}>Convert</Text>
              </Pressable>
            )}
            <Pressable
              style={[styles.actionBtn, styles.actionBtnDanger]}
              onPress={() => setPending({ leadId: item.leadId, kind: "delete" })}
            >
              <Text style={[styles.actionText, styles.actionTextDanger]}>Delete</Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Enquiry</Text>
          <Text style={styles.subtitle}>{data?.totalCount ?? 0} total</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>‹ Home</Text>
          </Pressable>
          <Pressable style={styles.newButton} onPress={onCreate}>
            <Text style={styles.newButtonText}>+ New Enquiry</Text>
          </Pressable>
        </View>
      </View>

      <TextInput
        style={styles.search}
        value={search}
        onChangeText={setSearch}
        placeholder="Search by name or mobile number"
        placeholderTextColor="#6f83a0"
      />

      {leadStatuses && leadStatuses.length > 0 && (
        <View style={styles.filterRow}>
          <Pressable style={[styles.filterChip, leadStatusId === null && styles.filterChipSelected]} onPress={() => setLeadStatusId(null)}>
            <Text style={[styles.filterChipText, leadStatusId === null && styles.filterChipTextSelected]}>All</Text>
          </Pressable>
          {leadStatuses.map((s) => (
            <Pressable key={s.id} style={[styles.filterChip, leadStatusId === s.id && styles.filterChipSelected]} onPress={() => setLeadStatusId(s.id)}>
              <Text style={[styles.filterChipText, leadStatusId === s.id && styles.filterChipTextSelected]}>{s.name}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <View style={styles.dateFilterRow}>
        <MiniDatePicker label="Added from" value={createdFrom} onChange={setCreatedFrom} />
        <MiniDatePicker label="Added to" value={createdTo} onChange={setCreatedTo} />
        {(createdFrom.length > 0 || createdTo.length > 0) && (
          <Pressable
            style={styles.clearDatesButton}
            onPress={() => { setCreatedFrom(""); setCreatedTo(""); }}
          >
            <Text style={styles.clearDatesText}>Clear dates</Text>
          </Pressable>
        )}
      </View>

      {isLoading ? (
        <ActivityIndicator color="#ff9a4d" style={{ marginTop: 40 }} />
      ) : isError ? (
        <Text style={styles.error}>Couldn't load enquiries.</Text>
      ) : (
        <FlatList
          data={data?.items ?? []}
          keyExtractor={(item) => String(item.leadId)}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={<Text style={styles.empty}>No enquiries yet — add the first one.</Text>}
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
  dateFilterRow: { flexDirection: "row", alignItems: "flex-end", gap: 12, marginBottom: 16, flexWrap: "wrap" },
  clearDatesButton: { paddingVertical: 8 },
  clearDatesText: { color: "#ff7a72", fontSize: 12, fontWeight: "600" },
  filterChip: { borderWidth: 1, borderColor: "#23405c", borderRadius: 100, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: "#132540" },
  filterChipSelected: { borderColor: "#ff9a4d", backgroundColor: "rgba(255, 154, 77, 0.14)" },
  filterChipText: { color: "#a7b7cb", fontSize: 12, fontWeight: "600" },
  filterChipTextSelected: { color: "#ff9a4d" },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingVertical: 14 },
  rowMain: { flex: 1, gap: 4 },
  leadName: { color: "#e8edf3", fontSize: 16, fontWeight: "600" },
  contact: { color: "#a7b7cb", fontSize: 13 },
  pillRow: { flexDirection: "row", gap: 6, marginTop: 4, flexWrap: "wrap" },
  meta: { color: "#6f83a0", fontSize: 12, marginTop: 4 },
  rowError: { color: "#ff7a72", fontSize: 12, marginTop: 4 },
  actions: { flexDirection: "row", gap: 8 },
  actionBtn: { borderWidth: 1, borderColor: "#23405c", borderRadius: 6, paddingVertical: 7, paddingHorizontal: 12 },
  actionBtnDanger: { borderColor: "rgba(255, 122, 114, 0.4)" },
  actionText: { color: "#a7b7cb", fontSize: 12, fontWeight: "600" },
  actionTextDanger: { color: "#ff7a72" },
  separator: { height: 1, backgroundColor: "#1b2c42" },
  error: { color: "#ff7a72", marginTop: 40, textAlign: "center" },
  empty: { color: "#6f83a0", marginTop: 40, textAlign: "center" },
});
