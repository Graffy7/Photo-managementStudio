import { createElement, useEffect, useMemo, useRef } from "react";
import { Modal, Pressable, View, Text, StyleSheet, ActivityIndicator, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "./Button";
import { downloadAndSharePdf } from "../utils/downloadPdf";
import { colors, radius, space, type, shadow, webShadow } from "./theme";

// Shows a PDF in a large pop-up so it can be read without downloading it. On the web the browser's
// own viewer is embedded (scroll, zoom, print); phones have no in-page viewer, so there the PDF
// opens in the phone's share/open sheet instead. "Download" saves the same file.
export function PdfPreviewModal({ visible, title, filename, bytes, loading, error, onClose }: {
  visible: boolean;
  title: string;
  filename: string;
  bytes: ArrayBuffer | null;
  loading?: boolean;
  error?: string | null;
  onClose: () => void;
}) {
  const web = Platform.OS === "web";
  // One object URL per file, released when the file changes or the pop-up goes away.
  const url = useMemo(
    () => (web && bytes ? URL.createObjectURL(new Blob([bytes], { type: "application/pdf" })) : null),
    [bytes, web],
  );
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  // Phones: hand the file to the system viewer once, as soon as it has arrived.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!web && visible && bytes) {
      downloadAndSharePdf(bytes, filename).finally(() => closeRef.current());
    }
  }, [web, visible, bytes, filename]);

  return (
    <Modal visible={visible && web} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close preview">
        <Pressable style={styles.card} onPress={() => undefined}>
          <View style={styles.header}>
            <Ionicons name="document-text-outline" size={18} color={colors.primary} />
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
            <Button label="Download" icon="download-outline" variant="secondary" disabled={!bytes} onPress={() => bytes && downloadAndSharePdf(bytes, filename)} />
            <Pressable style={styles.close} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close preview">
              <Ionicons name="close" size={20} color={colors.textMuted} />
            </Pressable>
          </View>
          <View style={styles.body}>
            {error ? (
              <Text style={styles.error}>{error}</Text>
            ) : loading || !url ? (
              <ActivityIndicator color={colors.primary} size="large" />
            ) : (
              createElement("iframe", { src: url, title, style: { width: "100%", height: "100%", border: 0, borderRadius: 8, background: "#FFFFFF" } })
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(2,6,20,0.7)", alignItems: "center", justifyContent: "center", padding: space.lg },
  card: {
    width: "100%", maxWidth: 980, height: "92%", backgroundColor: colors.card, borderRadius: 16, borderWidth: 1,
    borderColor: colors.borderStrong, overflow: "hidden", ...webShadow(shadow.menu),
  },
  header: {
    flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  title: { ...type.heading, color: colors.text, flex: 1 },
  close: { width: 36, height: 36, borderRadius: radius.control, alignItems: "center", justifyContent: "center" },
  body: { flex: 1, padding: space.md, alignItems: "stretch", justifyContent: "center" },
  error: { ...type.small, color: colors.danger, textAlign: "center" },
});
