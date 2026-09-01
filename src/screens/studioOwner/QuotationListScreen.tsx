import { useState } from "react";
import { View, Text, TextInput, FlatList, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { quotationsApi } from "../../api/quotationsApi";
import { QUOTATION_STATUSES, type Quotation, type QuotationStatus } from "../../types/quotation";
import { StatusPill } from "../../components/StatusPill";
import { downloadAndSharePdf } from "../../utils/downloadPdf";
import { extractErrorMessage } from "../../api/errorMessage";

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
}

function formatCurrency(value: number): string {
  return `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function statusTone(status: QuotationStatus): "good" | "bad" | "warn" | "neutral" {
  if (status === "Accepted") return "good";
  if (status === "Rejected" || status === "Cancelled") return "bad";
  if (status === "Sent" || status === "Expired") return "warn";
  return "neutral";
}

export function QuotationListScreen({ onCreate, onEdit }: { onCreate: () => void; onEdit: (quotation: Quotation) => void }) {
  const navigation = useNavigation<any>();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<QuotationStatus | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["quotations", search, status],
    queryFn: () => quotationsApi.search({ search: search || undefined, status: status ?? undefined, page: 1, pageSize: 50 }),
  });

  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const handleDownload = async (item: Quotation) => {
    setDownloadingId(item.quotationId);
    setDownloadError(null);
    try {
      const bytes = await quotationsApi.downloadPdf(item.quotationId);
      await downloadAndSharePdf(bytes, `${item.quotationNumber}.pdf`);
    } catch (err) {
      setDownloadError(extractErrorMessage(err, "Couldn't download the PDF."));
    } finally {
      setDownloadingId(null);
    }
  };

  const renderItem = ({ item }: { item: Quotation }) => (
    <View style={styles.row}>
      <Pressable style={styles.rowMain} onPress={() => onEdit(item)}>
        <Text style={styles.quotationNumber}>{item.quotationNumber} · {formatDate(item.quotationDate)}</Text>
        <Text style={styles.customerName}>{item.customerName}</Text>
        <Text style={styles.contact}>{item.customerMobileNumber}{item.items.length ? ` · ${item.items.length} item${item.items.length > 1 ? "s" : ""}` : ""}</Text>

        <View style={styles.pillRow}>
          <StatusPill label={item.status} tone={statusTone(item.status)} />
        </View>
      </Pressable>
      <View style={styles.rowEnd}>
        <Text style={styles.grandTotal}>{formatCurrency(item.grandTotal)}</Text>
        <Pressable style={styles.pdfButton} onPress={() => handleDownload(item)} disabled={downloadingId === item.quotationId}>
          {downloadingId === item.quotationId ? (
            <ActivityIndicator color="#7fc0e6" size="small" />
          ) : (
            <Text style={styles.pdfButtonText}>PDF</Text>
          )}
        </Pressable>
        <Pressable onPress={() => onEdit(item)}>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Quotations</Text>
          <Text style={styles.subtitle}>{data?.totalCount ?? 0} total</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>‹ Home</Text>
          </Pressable>
          <Pressable style={styles.newButton} onPress={onCreate}>
            <Text style={styles.newButtonText}>+ New Quotation</Text>
          </Pressable>
        </View>
      </View>

      <TextInput
        style={styles.search}
        value={search}
        onChangeText={setSearch}
        placeholder="Search by quotation number or customer"
        placeholderTextColor="#6f83a0"
      />

      {downloadError ? <Text style={styles.downloadError}>{downloadError}</Text> : null}

      <View style={styles.filterRow}>
        <Pressable style={[styles.filterChip, status === null && styles.filterChipSelected]} onPress={() => setStatus(null)}>
          <Text style={[styles.filterChipText, status === null && styles.filterChipTextSelected]}>All</Text>
        </Pressable>
        {QUOTATION_STATUSES.map((s) => (
          <Pressable key={s} style={[styles.filterChip, status === s && styles.filterChipSelected]} onPress={() => setStatus(s)}>
            <Text style={[styles.filterChipText, status === s && styles.filterChipTextSelected]}>{s}</Text>
          </Pressable>
        ))}
      </View>

      {isLoading ? (
        <ActivityIndicator color="#ff9a4d" style={{ marginTop: 40 }} />
      ) : isError ? (
        <Text style={styles.error}>Couldn't load quotations.</Text>
      ) : (
        <FlatList
          data={data?.items ?? []}
          keyExtractor={(item) => String(item.quotationId)}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={<Text style={styles.empty}>No quotations yet — create the first one.</Text>}
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
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14 },
  rowMain: { flex: 1, gap: 4 },
  quotationNumber: { color: "#7fc0e6", fontSize: 12, fontWeight: "600" },
  customerName: { color: "#e8edf3", fontSize: 16, fontWeight: "600" },
  contact: { color: "#a7b7cb", fontSize: 13 },
  pillRow: { flexDirection: "row", gap: 6, marginTop: 4, flexWrap: "wrap" },
  rowEnd: { flexDirection: "row", alignItems: "center", gap: 10 },
  grandTotal: { color: "#e8edf3", fontSize: 15, fontWeight: "700" },
  pdfButton: { borderWidth: 1, borderColor: "#23405c", borderRadius: 6, paddingVertical: 6, paddingHorizontal: 10, minWidth: 44, alignItems: "center" },
  pdfButtonText: { color: "#7fc0e6", fontSize: 11, fontWeight: "700" },
  chevron: { color: "#6f83a0", fontSize: 20 },
  separator: { height: 1, backgroundColor: "#1b2c42" },
  error: { color: "#ff7a72", marginTop: 40, textAlign: "center" },
  downloadError: { color: "#ff7a72", fontSize: 12, marginBottom: 12 },
  empty: { color: "#6f83a0", marginTop: 40, textAlign: "center" },
});
