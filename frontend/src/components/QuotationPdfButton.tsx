import { useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { quotationsApi } from "../api/quotationsApi";
import { extractErrorMessage } from "../api/errorMessage";
import { downloadAndSharePdf, quotationPdfName } from "../utils/downloadPdf";
import type { PriceDisplay, Quotation } from "../types/quotation";

const OPTIONS: { key: PriceDisplay; title: string; text: string }[] = [
  { key: "Detailed", title: "Show detailed prices", text: "Each service with its price, then the totals" },
  { key: "TotalOnly", title: "Show total only", text: "Services listed without prices, one total amount" },
];

// The PDF button of a quotation: asks how prices should show, remembers the choice for this
// quotation only, then downloads. Prices and totals themselves never change.
export function QuotationPdfButton({ quotation, onError }: { quotation: Quotation; onError: (message: string | null) => void }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const download = async (choice: PriceDisplay) => {
    setOpen(false);
    setBusy(true);
    onError(null);
    try {
      if (choice !== quotation.priceDisplay) {
        await quotationsApi.setPriceDisplay(quotation.quotationId, choice);
        queryClient.invalidateQueries({ queryKey: ["quotations"] });
        queryClient.invalidateQueries({ queryKey: ["event-history"] });
      }
      const bytes = await quotationsApi.downloadPdf(quotation.quotationId, choice);
      await downloadAndSharePdf(bytes, quotationPdfName(quotation.customerName, quotation.quotationNumber));
    } catch (err) {
      onError(extractErrorMessage(err, "Couldn't download the PDF."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View>
      <Pressable style={styles.button} onPress={() => setOpen((v) => !v)} disabled={busy}
        accessibilityRole="button" accessibilityLabel={`Download PDF of ${quotation.quotationNumber}`}>
        {busy ? <ActivityIndicator color="#B5A5FF" size="small" /> : (
          <>
            <Text style={styles.buttonText}>PDF</Text>
            <Ionicons name={open ? "chevron-up" : "chevron-down"} size={11} color="#B5A5FF" />
          </>
        )}
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
        <Pressable style={styles.menu} onPress={() => undefined}>
          <Text style={styles.menuTitle}>{quotation.quotationNumber} — prices on this PDF</Text>
          {OPTIONS.map((o) => {
            const current = quotation.priceDisplay === o.key;
            // A typed total only works as "Total only" - the listed prices wouldn't add up to it.
            const locked = o.key === "Detailed" && quotation.manualTotal != null;
            return (
              <Pressable key={o.key} style={({ hovered }: any) => [styles.item, hovered && !locked && styles.itemHover, locked && { opacity: 0.45 }]}
                onPress={() => !locked && download(o.key)} disabled={locked} accessibilityRole="button">
                <Ionicons name={current ? "radio-button-on" : "radio-button-off"} size={15} color={current ? "#B5A5FF" : "#A1A5B3"} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>{o.title}</Text>
                  <Text style={styles.itemText}>{locked ? "Not available: this quotation has a total entered by hand" : o.text}</Text>
                </View>
              </Pressable>
            );
          })}
          <Text style={styles.note}>Saved for this quotation only. Prices and totals don't change.</Text>
        </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(8,9,13,0.5)", alignItems: "center", justifyContent: "center", padding: 16 },
  button: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderColor: "#4B4F63", borderRadius: 8, paddingHorizontal: 12, minHeight: 40, minWidth: 64, justifyContent: "center" },
  buttonText: { color: "#B5A5FF", fontSize: 14, fontWeight: "600" },
  menu: {
    width: "100%", maxWidth: 360, backgroundColor: "#22252E", borderWidth: 1, borderColor: "#343746",
    borderRadius: 12, paddingVertical: 8, boxShadow: "0 8px 24px rgba(8,9,13,0.19)",
  },
  menuTitle: { color: "#A1A5B3", fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, paddingHorizontal: 12, paddingVertical: 6 },
  item: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingHorizontal: 12, paddingVertical: 8 },
  itemHover: { backgroundColor: "rgba(181,165,255,0.08)" },
  itemTitle: { color: "#E6E7EC", fontSize: 13, fontWeight: "600" },
  itemText: { color: "#A1A5B3", fontSize: 13, marginTop: 1 },
  note: { color: "#A1A5B3", fontSize: 12, paddingHorizontal: 12, paddingTop: 4, paddingBottom: 4 },
});
