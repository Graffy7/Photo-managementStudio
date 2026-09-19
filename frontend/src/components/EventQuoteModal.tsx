import { useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { quotationsApi } from "../api/quotationsApi";
import { StatusPill } from "./StatusPill";
import type { Quotation, QuotationStatus } from "../types/quotation";

const STATUS_RANK: Record<QuotationStatus, number> = { Accepted: 0, Sent: 1, Draft: 2, Expired: 3, Rejected: 4, Cancelled: 5 };

function tone(status: QuotationStatus): "good" | "warn" | "bad" | "neutral" {
  if (status === "Accepted") return "good";
  if (status === "Sent") return "warn";
  if (status === "Draft") return "neutral";
  return "bad";
}

function money(value: number): string {
  return `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function shortDate(value: string): string {
  return new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

// A read-only "what did we agree to do for this client" card: the services (and prices) from the
// quotation tied to this event. If the quote wasn't linked to the event, the customer's other
// quotes are still listed so the owner can find what was promised.
export function EventQuoteModal({
  visible,
  onClose,
  eventId,
  customerId,
  customerName,
  eventLabel,
}: {
  visible: boolean;
  onClose: () => void;
  eventId: number;
  customerId: number;
  customerName: string;
  eventLabel: string;
}) {
  const [selected, setSelected] = useState(0);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["event-quote", customerId],
    queryFn: () => quotationsApi.search({ customerId, page: 1, pageSize: 20 }),
    enabled: visible,
  });

  const quotes = useMemo(() => {
    const list: Quotation[] = data?.items ?? [];
    return [...list].sort((a, b) => {
      const linkedA = a.eventId === eventId ? 0 : 1;
      const linkedB = b.eventId === eventId ? 0 : 1;
      if (linkedA !== linkedB) return linkedA - linkedB;
      if (STATUS_RANK[a.status] !== STATUS_RANK[b.status]) return STATUS_RANK[a.status] - STATUS_RANK[b.status];
      return b.quotationDate.localeCompare(a.quotationDate);
    });
  }, [data, eventId]);

  const quote = quotes[Math.min(selected, Math.max(quotes.length - 1, 0))];
  const linked = quote?.eventId === eventId;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title} numberOfLines={1}>Services for {customerName}</Text>
              <Text style={styles.subtitle} numberOfLines={1}>{eventLabel}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={20} color="#a7b7cb" />
            </Pressable>
          </View>

          {isLoading ? (
            <ActivityIndicator color="#7fc0e6" style={{ marginVertical: 30 }} />
          ) : isError ? (
            <Text style={styles.empty}>Couldn't load the quotation.</Text>
          ) : !quote ? (
            <View style={styles.emptyBox}>
              <Ionicons name="document-text-outline" size={26} color="#3d5570" />
              <Text style={styles.empty}>No quotation for {customerName} yet.</Text>
              <Text style={styles.emptyHint}>Create one from Quotations to see the agreed services here.</Text>
            </View>
          ) : (
            <>
              {quotes.length > 1 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.chipRow}>
                  {quotes.map((q, i) => (
                    <Pressable key={q.quotationId} style={[styles.chip, i === selected && styles.chipSelected]} onPress={() => setSelected(i)}>
                      <Text style={[styles.chipText, i === selected && styles.chipTextSelected]}>
                        {q.quotationNumber} · {q.status}{q.eventId === eventId ? " ★" : ""}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              )}

              <View style={styles.quoteHead}>
                <StatusPill label={quote.status} tone={tone(quote.status)} />
                <Text style={styles.quoteMeta}>{quote.quotationNumber} · {shortDate(quote.quotationDate)}</Text>
              </View>
              {!linked && <Text style={styles.notLinked}>Not linked to this event — this customer's quote</Text>}

              <ScrollView style={styles.items} nestedScrollEnabled>
                {quote.items.length === 0 && <Text style={styles.noItems}>No services listed on this quotation.</Text>}
                {quote.items.map((item) => (
                  <View key={item.quotationItemId} style={styles.itemRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemName}>{item.serviceName}</Text>
                      {item.notes ? <Text style={styles.itemNotes}>{item.notes}</Text> : null}
                    </View>
                    <Text style={styles.itemQty}>× {item.quantity}</Text>
                    <Text style={styles.itemTotal}>{money(item.total)}</Text>
                  </View>
                ))}
              </ScrollView>

              <View style={styles.totals}>
                {quote.discount > 0 && <TotalLine label="Discount" value={`− ${money(quote.discount)}`} />}
                {quote.taxAmount > 0 && <TotalLine label="Tax" value={money(quote.taxAmount)} />}
                <View style={styles.grandRow}>
                  <Text style={styles.grandLabel}>Total</Text>
                  <Text style={styles.grandValue}>{money(quote.grandTotal)}</Text>
                </View>
              </View>

              {quote.termsAndConditions ? <Text style={styles.terms} numberOfLines={3}>{quote.termsAndConditions}</Text> : null}
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function TotalLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.totalLine}>
      <Text style={styles.totalLabel}>{label}</Text>
      <Text style={styles.totalValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(3, 8, 15, 0.6)", alignItems: "center", justifyContent: "center", padding: 16 },
  card: { width: "100%", maxWidth: 380, backgroundColor: "#132540", borderRadius: 14, borderWidth: 1, borderColor: "#23405c", padding: 16 },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 12 },
  title: { color: "#e8edf3", fontSize: 15, fontWeight: "700" },
  subtitle: { color: "#6f83a0", fontSize: 11.5, marginTop: 2 },

  chipScroll: { marginBottom: 10, flexGrow: 0 },
  chipRow: { gap: 6 },
  chip: { borderWidth: 1, borderColor: "#23405c", borderRadius: 100, paddingVertical: 5, paddingHorizontal: 10, backgroundColor: "#0f1e30" },
  chipSelected: { borderColor: "#7fc0e6", backgroundColor: "rgba(127, 192, 230, 0.14)" },
  chipText: { color: "#a7b7cb", fontSize: 11, fontWeight: "600" },
  chipTextSelected: { color: "#7fc0e6" },

  quoteHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  quoteMeta: { color: "#a7b7cb", fontSize: 11.5 },
  notLinked: { color: "#f2bd5c", fontSize: 11, marginBottom: 8 },

  items: { maxHeight: 230, backgroundColor: "#0f1e30", borderRadius: 10, paddingHorizontal: 12 },
  noItems: { color: "#6f83a0", fontSize: 12, paddingVertical: 14, textAlign: "center" },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#1b2c42" },
  itemName: { color: "#e8edf3", fontSize: 13, fontWeight: "600" },
  itemNotes: { color: "#6f83a0", fontSize: 11, marginTop: 2 },
  itemQty: { color: "#a7b7cb", fontSize: 12 },
  itemTotal: { color: "#e8edf3", fontSize: 12.5, fontWeight: "700", minWidth: 64, textAlign: "right" },

  totals: { marginTop: 10, gap: 4 },
  totalLine: { flexDirection: "row", justifyContent: "space-between" },
  totalLabel: { color: "#6f83a0", fontSize: 12 },
  totalValue: { color: "#a7b7cb", fontSize: 12 },
  grandRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#1b2c42" },
  grandLabel: { color: "#e8edf3", fontSize: 13, fontWeight: "700" },
  grandValue: { color: "#ff9a4d", fontSize: 16, fontWeight: "800" },
  terms: { color: "#6f83a0", fontSize: 11, marginTop: 10 },

  emptyBox: { alignItems: "center", gap: 6, paddingVertical: 22 },
  empty: { color: "#a7b7cb", fontSize: 13, textAlign: "center" },
  emptyHint: { color: "#6f83a0", fontSize: 11.5, textAlign: "center" },
});
