import { useState } from "react";
import { SubscriptionLock } from "../../components/SubscriptionLock";
import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { paymentsApi } from "../../api/paymentsApi";
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUSES, type Payment, type PaymentStatus } from "../../types/payment";
import { StatusPill } from "../../components/StatusPill";
import { SearchInput } from "../../components/SearchInput";
import { useRefetchOnFocus } from "../../hooks/useRefetchOnFocus";

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
}

function formatCurrency(value: number): string {
  return `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function statusTone(status: PaymentStatus): "good" | "bad" | "warn" | "neutral" {
  if (status === "Completed") return "good";
  if (status === "Cancelled") return "bad";
  if (status === "Pending") return "warn";
  return "neutral";
}

// A payment can be individually "Completed" while its event still has a balance owed —
// show "Pending" in that case so the list reflects the event's true collection state.
function displayStatus(item: Payment): PaymentStatus {
  if (item.paymentStatus === "Completed" && item.eventId !== null && (item.eventBalance ?? 0) > 0) {
    return "Pending";
  }
  return item.paymentStatus;
}

export function PaymentListScreen({ onCreate, onEdit }: { onCreate: () => void; onEdit: (payment: Payment) => void }) {
  const navigation = useNavigation<any>();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<PaymentStatus | null>(null);

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["payments", search, status],
    queryFn: () => paymentsApi.search({ search: search || undefined, paymentStatus: status ?? undefined, page: 1, pageSize: 50 }),
  });
  useRefetchOnFocus(refetch);

  const renderItem = ({ item }: { item: Payment }) => (
    <Pressable style={styles.row} onPress={() => onEdit(item)}>
      <View style={styles.rowMain}>
        <Text style={styles.paymentDate}>{formatDate(item.paymentDate)} · {PAYMENT_METHOD_LABELS[item.paymentMethod]}</Text>
        <Text style={styles.customerName}>{item.customerName}</Text>

        {item.eventId !== null && (
          <View style={styles.eventFinanceRow}>
            <View style={styles.eventFinanceItem}>
              <Text style={styles.eventFinanceLabel}>Total</Text>
              <Text style={styles.eventFinanceValue}>{formatCurrency(item.eventBudget ?? 0)}</Text>
            </View>
            <View style={styles.eventFinanceItem}>
              <Text style={styles.eventFinanceLabel}>Advance paid</Text>
              <Text style={styles.eventFinanceValue}>{formatCurrency(item.eventAmountPaid ?? 0)}</Text>
            </View>
            <View style={styles.eventFinanceItem}>
              <Text style={styles.eventFinanceLabel}>Balance</Text>
              <Text style={[styles.eventFinanceValue, { color: (item.eventBalance ?? 0) > 0 ? "#f2bd5c" : "#4cc493" }]}>
                {formatCurrency(item.eventBalance ?? 0)}
              </Text>
            </View>
          </View>
        )}

        <Text style={styles.contact}>{item.customerMobileNumber}{item.referenceNumber ? ` · Ref: ${item.referenceNumber}` : ""}</Text>

        <View style={styles.pillRow}>
          <StatusPill label={displayStatus(item)} tone={statusTone(displayStatus(item))} />
        </View>
      </View>
      <View style={styles.rowEnd}>
        <Text style={styles.amount}>{formatCurrency(item.amount)}</Text>
        <Text style={styles.chevron}>›</Text>
      </View>
    </Pressable>
  );

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Payments</Text>
          <Text style={styles.subtitle}>{data?.totalCount ?? 0} total</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>‹ Home</Text>
          </Pressable>
          <SubscriptionLock>
            <Pressable style={styles.newButton} onPress={onCreate}>
              <Text style={styles.newButtonText}>+ New Payment</Text>
            </Pressable>
          </SubscriptionLock>
        </View>
      </View>

      <SearchInput style={styles.search} value={search} onChangeText={setSearch} placeholder="Search by customer or reference number" />

      <View style={styles.filterRow}>
        <Pressable style={[styles.filterChip, status === null && styles.filterChipSelected]} onPress={() => setStatus(null)}>
          <Text style={[styles.filterChipText, status === null && styles.filterChipTextSelected]}>All</Text>
        </Pressable>
        {PAYMENT_STATUSES.map((s) => (
          <Pressable key={s} style={[styles.filterChip, status === s && styles.filterChipSelected]} onPress={() => setStatus(s)}>
            <Text style={[styles.filterChipText, status === s && styles.filterChipTextSelected]}>{s}</Text>
          </Pressable>
        ))}
      </View>

      {isPending ? (
        <ActivityIndicator color="#ff9a4d" style={{ marginTop: 40 }} />
      ) : isError ? (
        <Text style={styles.error}>Couldn't load payments.</Text>
      ) : (
        <FlatList
          data={data?.items ?? []}
          keyExtractor={(item) => String(item.paymentId)}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={<Text style={styles.empty}>No payments yet — record the first one.</Text>}
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
  paymentDate: { color: "#7fc0e6", fontSize: 12, fontWeight: "600" },
  customerName: { color: "#e8edf3", fontSize: 16, fontWeight: "600" },
  contact: { color: "#a7b7cb", fontSize: 13 },
  eventFinanceRow: { flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 4, marginBottom: 2 },
  eventFinanceItem: { gap: 1 },
  eventFinanceLabel: { color: "#6f83a0", fontSize: 10 },
  eventFinanceValue: { color: "#e8edf3", fontSize: 12, fontWeight: "700" },
  pillRow: { flexDirection: "row", gap: 6, marginTop: 4, flexWrap: "wrap" },
  rowEnd: { flexDirection: "row", alignItems: "center", gap: 8 },
  amount: { color: "#e8edf3", fontSize: 15, fontWeight: "700" },
  chevron: { color: "#6f83a0", fontSize: 20 },
  separator: { height: 1, backgroundColor: "#1b2c42" },
  error: { color: "#ff7a72", marginTop: 40, textAlign: "center" },
  empty: { color: "#6f83a0", marginTop: 40, textAlign: "center" },
});
