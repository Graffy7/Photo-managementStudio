import { useState } from "react";
import { View, Text, Pressable, StyleSheet, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { quotationsApi } from "../api/quotationsApi";
import { extractErrorMessage } from "../api/errorMessage";
import { quotationPdfName } from "../utils/downloadPdf";
import { PdfPreviewModal } from "../ui/PdfPreviewModal";
import type { PriceDisplay, Quotation } from "../types/quotation";
import { RowAction } from "../ui/RowAction";

const OPTIONS: { key: PriceDisplay; title: string; text: string }[] = [
  { key: "Detailed", title: "Show detailed prices", text: "Each service with its price, then the totals" },
  { key: "TotalOnly", title: "Show total only", text: "Services listed without prices, one total amount" },
];

// The PDF button of a quotation: asks how prices should show, remembers the choice for this
// quotation only, then opens the PDF in a preview pop-up (Download is inside it). Prices and
// totals themselves never change.
export function QuotationPdfButton({ quotation, onError }: { quotation: Quotation; onError: (message: string | null) => void }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ bytes: ArrayBuffer | null; error: string | null } | null>(null);

  const show = async (choice: PriceDisplay) => {
    setOpen(false);
    setBusy(true);
    onError(null);
    setPreview({ bytes: null, error: null });
    try {
      if (choice !== quotation.priceDisplay) {
        await quotationsApi.setPriceDisplay(quotation.quotationId, choice);
        queryClient.invalidateQueries({ queryKey: ["quotations"] });
        queryClient.invalidateQueries({ queryKey: ["event-history"] });
      }
      const bytes = await quotationsApi.downloadPdf(quotation.quotationId, choice);
      setPreview((p) => (p ? { ...p, bytes } : p));
    } catch (err) {
      const message = extractErrorMessage(err, "Couldn't load the PDF.");
      setPreview((p) => (p ? { ...p, error: message } : p));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View>
      <RowAction iconOnly icon="eye-outline" label="PDF" kind="primary" busy={busy} selected={open}
        onPress={() => setOpen((v) => !v)} accessibilityLabel={`View PDF of ${quotation.quotationNumber}`} />
      <PdfPreviewModal
        visible={!!preview}
        title={`${quotation.quotationNumber} · ${quotation.customerName}`}
        filename={quotationPdfName(quotation.customerName, quotation.quotationNumber)}
        bytes={preview?.bytes ?? null}
        loading={!!preview && !preview.bytes && !preview.error}
        error={preview?.error}
        onClose={() => setPreview(null)}
      />
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
                onPress={() => !locked && show(o.key)} disabled={locked} accessibilityRole="button">
                <Ionicons name={current ? "radio-button-on" : "radio-button-off"} size={15} color={current ? "#5B9BFF" : "#A4AFCF"} />
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
  backdrop: { flex: 1, backgroundColor: "rgba(2,6,20,0.5)", alignItems: "center", justifyContent: "center", padding: 16 },
  menu: {
    width: "100%", maxWidth: 360, backgroundColor: "#0C1733", borderWidth: 1, borderColor: "#1E2D57",
    borderRadius: 12, paddingVertical: 8, boxShadow: "0 8px 24px rgba(2,6,20,0.19)",
  },
  menuTitle: { color: "#A4AFCF", fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, paddingHorizontal: 12, paddingVertical: 6 },
  item: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingHorizontal: 12, paddingVertical: 8 },
  itemHover: { backgroundColor: "rgba(91,155,255,0.08)" },
  itemTitle: { color: "#F2F5FF", fontSize: 13, fontWeight: "600" },
  itemText: { color: "#A4AFCF", fontSize: 13, marginTop: 1 },
  note: { color: "#A4AFCF", fontSize: 12, paddingHorizontal: 12, paddingTop: 4, paddingBottom: 4 },
});
