import { useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { photoSelectionApi } from "../api/photoSelectionApi";
import { extractErrorMessage } from "../api/errorMessage";

// Picks a folder inside the studio's own photo folder on the server, so the owner points at where
// the original photos live instead of typing a path. The server never lists anything outside that
// folder. Only folder names are listed — the photos themselves are never read until Import.
export function FolderBrowserModal({
  visible,
  onClose,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (path: string) => void;
}) {
  const [currentPath, setCurrentPath] = useState<string | null>(null);

  // The modal stays mounted between opens; start each one from the top-level list.
  useEffect(() => {
    if (visible) setCurrentPath(null);
  }, [visible]);

  const { data, isPending, isError, error } = useQuery({
    queryKey: ["photo-gallery-browse-folders", currentPath],
    queryFn: () => photoSelectionApi.browseFolders(currentPath ?? undefined),
    enabled: visible,
    retry: false,
  });

  // At the studio's photo folder itself there's nowhere further up to go.
  const atRoot = !data?.parentPath;
  const folders = data?.folders ?? [];
  const shownPath = data?.currentPath ?? currentPath;
  const relative = shownPath && data?.rootPath && shownPath.length > data.rootPath.length
    ? shownPath.slice(data.rootPath.length).replace(/^[\\/]/, "")
    : null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>Select the photos folder</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={20} color="#a7b7cb" />
            </Pressable>
          </View>

          <View style={styles.pathRow}>
            {!atRoot && (
              <Pressable style={styles.upButton} onPress={() => setCurrentPath(data?.parentPath ?? null)}>
                <Ionicons name="arrow-up-outline" size={14} color="#7fc0e6" />
                <Text style={styles.upButtonText}>Up</Text>
              </Pressable>
            )}
            <Ionicons name="lock-closed-outline" size={12} color="#6f83a0" />
            <Text style={styles.pathText} numberOfLines={1}>
              {relative ? `Studio photos › ${relative.split(/[\\/]/).join(" › ")}` : "Studio photos"}
            </Text>
          </View>

          <View style={styles.listBox}>
            {isPending ? (
              <ActivityIndicator color="#ff9a4d" style={{ marginVertical: 30 }} />
            ) : isError ? (
              <Text style={styles.empty}>{extractErrorMessage(error, "Couldn't open that folder.")}</Text>
            ) : folders.length === 0 ? (
              <Text style={styles.empty}>No sub-folders here.</Text>
            ) : (
              <ScrollView style={{ maxHeight: 340 }}>
                {folders.map((f) => (
                  <Pressable key={f.fullPath} style={styles.item} onPress={() => setCurrentPath(f.fullPath)}>
                    <Ionicons name="folder" size={20} color="#7fc0e6" />
                    <Text style={styles.itemText} numberOfLines={1}>{f.name}</Text>
                    <Ionicons name="chevron-forward" size={14} color="#6f83a0" />
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>

          {data && (
            <Text style={styles.count}>
              {data.imageCount === 0
                ? "No photos in this folder or its sub-folders."
                : `${data.imageCount} photo${data.imageCount === 1 ? "" : "s"} in this folder (including sub-folders).`}
            </Text>
          )}

          <View style={styles.actions}>
            <Pressable style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.selectButton, (!data?.currentPath || data.imageCount === 0) && styles.selectButtonDisabled]}
              disabled={!data?.currentPath || data.imageCount === 0}
              onPress={() => data?.currentPath && onSelect(data.currentPath)}
            >
              <Text style={styles.selectText}>Use This Folder</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(5,10,18,0.6)", alignItems: "center", justifyContent: "center", padding: 20 },
  card: { width: "100%", maxWidth: 560, backgroundColor: "#132540", borderRadius: 14, borderWidth: 1, borderColor: "#23405c", padding: 18 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  title: { color: "#e8edf3", fontSize: 16, fontWeight: "700" },
  pathRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  upButton: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#0d1826", borderRadius: 6, paddingVertical: 4, paddingHorizontal: 8, borderWidth: 1, borderColor: "#23405c" },
  upButtonText: { color: "#7fc0e6", fontSize: 11, fontWeight: "700" },
  pathText: { color: "#7fc0e6", fontSize: 12, fontWeight: "600", flexShrink: 1 },
  listBox: { borderWidth: 1, borderColor: "#23405c", borderRadius: 10, backgroundColor: "#0d1826", minHeight: 120 },
  empty: { color: "#6f83a0", fontSize: 12, textAlign: "center", padding: 24 },
  item: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: "#1b2c42" },
  itemText: { color: "#e8edf3", fontSize: 13, flex: 1 },
  count: { color: "#a7b7cb", fontSize: 12, marginTop: 10 },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 12, marginTop: 16 },
  cancelButton: { paddingVertical: 10, paddingHorizontal: 14 },
  cancelText: { color: "#a7b7cb", fontSize: 13, fontWeight: "600" },
  selectButton: { backgroundColor: "#ff9a4d", borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16 },
  selectButtonDisabled: { opacity: 0.4 },
  selectText: { color: "#0d1826", fontWeight: "700", fontSize: 13 },
});
