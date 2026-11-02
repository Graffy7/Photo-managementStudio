import { useState } from "react";
import { Text, Pressable, StyleSheet, ActivityIndicator, Platform, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { quotationsApi } from "../api/quotationsApi";
import { extractErrorMessage } from "../api/errorMessage";
import { useAuthStore } from "../auth/authStore";
import { downloadAndSharePdf, quotationPdfName } from "../utils/downloadPdf";
import type { Quotation } from "../types/quotation";

// "98765 43210" -> "919876543210". A 10-digit number is taken as Indian; numbers that already
// carry a country code are kept. Null when there is no usable number (WhatsApp then asks whom to send to).
function whatsAppNumber(mobile: string | null | undefined): string | null {
  const digits = (mobile ?? "").replace(/\D/g, "").replace(/^0+/, "");
  if (digits.length === 10) return `91${digits}`;
  return digits.length >= 11 && digits.length <= 15 ? digits : null;
}

function message(q: Quotation, studioName: string | null | undefined): string {
  const total = `₹${q.grandTotal.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
  const from = studioName ? ` from ${studioName}` : "";
  return `Hello ${q.customerName}, here is your quotation ${q.quotationNumber}${from}. Total: ${total}. The PDF is attached.`;
}

// Phones and tablets: the browser's share sheet can carry the PDF itself straight into WhatsApp.
// Computers: that sheet rarely lists WhatsApp, so the PDF is downloaded and WhatsApp opens on the
// customer's chat with the message ready - the PDF is then dropped into the chat.
function canShareFile(file: File): boolean {
  if (typeof navigator === "undefined" || typeof navigator.canShare !== "function") return false;
  const touch = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
  try {
    return !!touch && navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

export function QuotationWhatsAppButton({ quotation, onError, onNotice }: {
  quotation: Quotation;
  onError: (message: string | null) => void;
  onNotice?: (message: string | null) => void;
}) {
  const studioName = useAuthStore((s) => s.user?.studioName);
  const [busy, setBusy] = useState(false);

  const share = async () => {
    setBusy(true);
    onError(null);
    onNotice?.(null);
    try {
      const filename = quotationPdfName(quotation.customerName, quotation.quotationNumber);
      // Same price layout the quotation's PDF button last used.
      const bytes = await quotationsApi.downloadPdf(quotation.quotationId, quotation.priceDisplay);
      const text = message(quotation, studioName);

      if (Platform.OS !== "web") {
        // The native share sheet lists WhatsApp; the file goes with it.
        await downloadAndSharePdf(bytes, filename);
        return;
      }

      const file = new File([bytes], filename, { type: "application/pdf" });
      if (canShareFile(file)) {
        try {
          await navigator.share({ files: [file], text });
          return;
        } catch (err) {
          if ((err as Error)?.name === "AbortError") return; // closed the share sheet
        }
      }

      await downloadAndSharePdf(bytes, filename);
      const number = whatsAppNumber(quotation.customerMobileNumber);
      const url = `https://wa.me/${number ?? ""}?text=${encodeURIComponent(text)}`;
      if (typeof window !== "undefined") window.open(url, "_blank", "noopener,noreferrer");
      else await Linking.openURL(url);
      onNotice?.(`${filename} was downloaded. Attach it in the WhatsApp chat that just opened.`);
    } catch (err) {
      onError(extractErrorMessage(err, "Couldn't prepare the quotation for WhatsApp."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Pressable style={styles.button} onPress={share} disabled={busy}
      accessibilityRole="button" accessibilityLabel={`Share ${quotation.quotationNumber} on WhatsApp`}>
      {busy ? <ActivityIndicator color="#25D366" size="small" /> : (
        <>
          <Ionicons name="logo-whatsapp" size={16} color="#25D366" />
          <Text style={styles.buttonText}>WhatsApp</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderColor: "#2c4463",
    borderRadius: 8, paddingHorizontal: 12, minHeight: 40, minWidth: 64,
  },
  buttonText: { color: "#8cc8f0", fontSize: 14, fontWeight: "600" },
});
