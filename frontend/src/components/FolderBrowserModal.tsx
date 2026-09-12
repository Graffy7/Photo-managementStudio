import { useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { photoSelectionApi } from "../api/photoSelectionApi";
import { LocalFileThumbnail } from "./LocalFileThumbnail";
import type { FolderBrowseEntry, FolderBrowseFileEntry } from "../types/photoSelection";

type Tile =
  | { kind: "folder"; key: string; name: string; fullPath: string }
  | { kind: "file"; key: string; name: string; fullPath: string; isImage: boolean };

const VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".avi", ".mkv", ".wmv"]);
const AUDIO_EXTENSIONS = new Set([".mp3", ".wav", ".m4a", ".aac"]);

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot).toLowerCase();
}

function fileIconFor(name: string): keyof typeof Ionicons.glyphMap {
  const ext = extensionOf(name);
  if (VIDEO_EXTENSIONS.has(ext)) return "videocam-outline";
  if (AUDIO_EXTENSIONS.has(ext)) return "musical-notes-outline";
  if (ext === ".pdf") return "document-text-outline";
  return "document-outline";
}

// A server-side folder picker: since the backend already runs on the same machine as the
// studio's photos (see ILocalPhotoProcessor), "browsing" here means walking that machine's own
// disk through a small API rather than the browser's sandboxed (and path-less) file input. Files
// are shown alongside folders — thumbnailed when they're images — purely so the owner can see at
// a glance they're in the right place; only a folder can actually be selected.
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

  // The modal stays mounted (just hidden) between opens via `visible` — reset to the "This PC"
  // root every time it opens instead of resuming wherever it was left last time.
  useEffect(() => {
    if (visible) setCurrentPath(null);
  }, [visible]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["photo-selection-browse-folders", currentPath],
    queryFn: () => photoSelectionApi.browseFolders(currentPath ?? undefined),
    enabled: visible,
  });

  const atTop = currentPath === null;

  const isDrive = (name: string) => /^[A-Za-z]:\\?$/.test(name);
  const folderIconFor = (name: string): keyof typeof Ionicons.glyphMap => {
    if (!atTop) return "folder";
    switch (name) {
      case "Desktop": return "desktop-outline";
      case "Documents": return "document-text-outline";
      case "Downloads": return "download-outline";
      case "Pictures": return "image-outline";
      case "Videos": return "videocam-outline";
      default: return isDrive(name) ? "server-outline" : "folder";
    }
  };

  const tiles: Tile[] = [
    ...(data?.folders ?? []).map((f: FolderBrowseEntry): Tile => ({ kind: "folder", key: f.fullPath, name: f.name, fullPath: f.fullPath })),
    ...(data?.files ?? []).map((f: FolderBrowseFileEntry): Tile => ({ kind: "file", key: f.fullPath, name: f.name, fullPath: f.fullPath, isImage: f.isImage })),
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>Select a folder</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={20} color="#a7b7cb" />
            </Pressable>
          </View>

          <View style={styles.pathRow}>
            {!atTop && (
              <Pressable style={styles.upButton} onPress={() => setCurrentPath(data?.parentPath ?? null)}>
                <Ionicons name="arrow-up-outline" size={14} color="#7fc0e6" />
                <Text style={styles.upButtonText}>Up</Text>
              </Pressable>
            )}
            <Text style={styles.pathText} numberOfLines={1}>{currentPath ?? "This PC"}</Text>
          </View>

          <View style={styles.gridBox}>
            {isLoading ? (
              <ActivityIndicator color="#ff9a4d" style={{ marginVertical: 30 }} />
            ) : isError ? (
              <Text style={styles.empty}>Couldn't open that folder.</Text>
            ) : tiles.length === 0 ? (
              <Text style={styles.empty}>This folder is empty.</Text>
            ) : (
              <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={styles.grid}>
                {tiles.map((item) => (
                  <Pressable
                    key={item.key}
                    style={styles.tile}
                    disabled={item.kind !== "folder"}
                    onPress={() => item.kind === "folder" && setCurrentPath(item.fullPath)}
                  >
                    {item.kind === "folder" ? (
                      <View style={[styles.tileThumb, styles.center]}>
                        <Ionicons name={folderIconFor(item.name)} size={34} color="#7fc0e6" />
                      </View>
                    ) : item.isImage ? (
                      <LocalFileThumbnail path={item.fullPath} />
                    ) : (
                      <View style={[styles.tileThumb, styles.center]}>
                        <Ionicons name={fileIconFor(item.name)} size={30} color="#6f83a0" />
                      </View>
                    )}
                    <Text style={styles.tileLabel} numberOfLines={2}>{item.name}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>

          <View style={styles.actions}>
            <Pressable style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.selectButton, atTop && styles.selectButtonDisabled]}
              disabled={atTop}
              onPress={() => currentPath && onSelect(currentPath)}
            >
              <Text style={styles.selectText}>Select This Folder</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(5,10,18,0.6)", alignItems: "center", justifyContent: "center", padding: 20 },
  card: { width: "100%", maxWidth: 640, backgroundColor: "#132540", borderRadius: 14, borderWidth: 1, borderColor: "#23405c", padding: 18 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  title: { color: "#e8edf3", fontSize: 16, fontWeight: "700" },
  pathRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  upButton: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#0d1826", borderRadius: 6, paddingVertical: 4, paddingHorizontal: 8, borderWidth: 1, borderColor: "#23405c" },
  upButtonText: { color: "#7fc0e6", fontSize: 11, fontWeight: "700" },
  pathText: { color: "#7fc0e6", fontSize: 12, fontWeight: "600", flexShrink: 1 },
  gridBox: { borderWidth: 1, borderColor: "#23405c", borderRadius: 10, backgroundColor: "#0d1826", padding: 12, minHeight: 120 },
  center: { alignItems: "center", justifyContent: "center" },
  empty: { color: "#6f83a0", fontSize: 12, textAlign: "center", padding: 20 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  tile: { width: "21%", alignItems: "center", gap: 4 },
  tileThumb: { width: "100%", aspectRatio: 1, borderRadius: 8, backgroundColor: "#132540" },
  tileLabel: { color: "#a7b7cb", fontSize: 10.5, textAlign: "center" },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 12, marginTop: 16 },
  cancelButton: { paddingVertical: 10, paddingHorizontal: 14 },
  cancelText: { color: "#a7b7cb", fontSize: 13, fontWeight: "600" },
  selectButton: { backgroundColor: "#ff9a4d", borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16 },
  selectButtonDisabled: { opacity: 0.4 },
  selectText: { color: "#0d1826", fontWeight: "700", fontSize: 13 },
});
