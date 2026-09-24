import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { photoSelectionApi } from "../api/photoSelectionApi";
import { extractErrorMessage } from "../api/errorMessage";
import type { PhotoFolder } from "../types/photoSelection";

interface Props {
  galleryId: number;
  // Which folder the photo grid below is showing; null is the whole gallery.
  selectedFolderId: number | null;
  onSelect: (folderId: number | null) => void;
}

// The owner's view of an event's delivery folders. Folders come from the subfolders of the imported
// source folder, and the studio can add, rename, mark delivered or remove them. Removing one never
// removes photos - they fall back into "Other".
export function DeliveryFolders({ galleryId, selectedFolderId, onSelect }: Props) {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [menuFor, setMenuFor] = useState<number | null>(null);
  const [renaming, setRenaming] = useState<number | null>(null);
  const [renameTo, setRenameTo] = useState("");
  const [pendingDelete, setPendingDelete] = useState<PhotoFolder | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: folders = [], isPending } = useQuery({
    queryKey: ["gallery-folders", galleryId],
    queryFn: () => photoSelectionApi.folders(galleryId),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["gallery-folders", galleryId] });
    queryClient.invalidateQueries({ queryKey: ["photo-gallery-photos", galleryId] });
  };
  const fail = (err: unknown) => setError(extractErrorMessage(err));

  const create = useMutation({
    mutationFn: (name: string) => photoSelectionApi.createFolder(galleryId, name),
    onSuccess: () => { setNewName(""); setAdding(false); setError(null); refresh(); },
    onError: fail,
  });
  const rename = useMutation({
    mutationFn: ({ folderId, name }: { folderId: number; name: string }) =>
      photoSelectionApi.renameFolder(galleryId, folderId, name),
    onSuccess: () => { setRenaming(null); setError(null); refresh(); },
    onError: fail,
  });
  const setDelivered = useMutation({
    mutationFn: ({ folderId, isDelivered }: { folderId: number; isDelivered: boolean }) =>
      photoSelectionApi.setFolderDelivered(galleryId, folderId, isDelivered),
    onSuccess: () => { setMenuFor(null); refresh(); },
    onError: fail,
  });
  const remove = useMutation({
    mutationFn: (folderId: number) => photoSelectionApi.deleteFolder(galleryId, folderId),
    onSuccess: () => { setPendingDelete(null); setMenuFor(null); onSelect(null); refresh(); },
    onError: fail,
  });

  if (isPending) {
    return <ActivityIndicator color="#7fc0e6" style={{ marginVertical: 12 }} />;
  }

  const total = folders.reduce((sum, f) => sum + f.photoCount, 0);

  return (
    // While a folder's menu is open, this block sits above what follows it, so the menu isn't hidden
    // under the filter chips below.
    <View style={[styles.wrapper, menuFor !== null && styles.raised]}>
      <View style={styles.grid}>
        <Pressable
          style={[styles.card, selectedFolderId === null && styles.cardActive]}
          onPress={() => onSelect(null)}
        >
          <View style={styles.cardTop}>
            <Ionicons name="images-outline" size={16} color="#7fc0e6" />
            <Text style={styles.cardName} numberOfLines={1}>All photos</Text>
          </View>
          <Text style={styles.cardCount}>{total} photos</Text>
        </Pressable>

        {folders.map((folder) => {
          const active = selectedFolderId === folder.folderId;
          const editable = folder.folderId > 0;   // "Other" is a bucket, not a real folder
          return (
            // The card with the open menu is lifted above the cards after it (on the web each card is
            // its own layer, so a later card would otherwise paint over the menu).
            <View key={folder.folderId} style={[styles.cardWrap, menuFor === folder.folderId && styles.raised]}>
              {renaming === folder.folderId ? (
                <View style={[styles.card, styles.cardEditing]}>
                  <TextInput
                    style={styles.input}
                    value={renameTo}
                    onChangeText={setRenameTo}
                    autoFocus
                    maxLength={100}
                    onSubmitEditing={() => renameTo.trim() && rename.mutate({ folderId: folder.folderId, name: renameTo.trim() })}
                  />
                  <View style={styles.editActions}>
                    <Pressable onPress={() => setRenaming(null)} accessibilityRole="button">
                      <Text style={styles.cancelLink}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => renameTo.trim() && rename.mutate({ folderId: folder.folderId, name: renameTo.trim() })}
                      disabled={rename.isPending}
                      accessibilityRole="button"
                    >
                      <Text style={styles.saveLink}>Save</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Pressable
                  style={[styles.card, active && styles.cardActive]}
                  onPress={() => onSelect(folder.folderId)}
                  accessibilityRole="button"
                  accessibilityLabel={`${folder.name}, ${folder.photoCount} photos`}
                >
                  <View style={styles.cardTop}>
                    <Ionicons
                      name={folder.isDelivered ? "folder-open" : "folder"}
                      size={16}
                      color={folder.isDelivered ? "#4cc493" : "#f2bd5c"}
                    />
                    <Text style={styles.cardName} numberOfLines={1}>{folder.name}</Text>
                    {editable && <View style={styles.menuButtonSpace} />}
                  </View>
                  <View style={styles.cardBottom}>
                    <Text style={styles.cardCount}>{folder.photoCount} photos</Text>
                    {folder.selectedCount > 0 && <Text style={styles.cardPicked}>· {folder.selectedCount} chosen</Text>}
                  </View>
                  {folder.isDelivered && (
                    <View style={styles.deliveredRow}>
                      <Ionicons name="checkmark-circle" size={11} color="#4cc493" />
                      <Text style={styles.deliveredText}>Delivered</Text>
                    </View>
                  )}
                </Pressable>
              )}

              {/* Outside the card's own button: a button inside a button isn't valid on the web. */}
              {editable && renaming !== folder.folderId && (
                <Pressable
                  style={styles.menuButton}
                  onPress={() => setMenuFor(menuFor === folder.folderId ? null : folder.folderId)}
                  accessibilityRole="button"
                  accessibilityLabel={`Actions for ${folder.name}`}
                  hitSlop={6}
                >
                  <Ionicons name="ellipsis-vertical" size={13} color="#6f83a0" />
                </Pressable>
              )}

              {menuFor === folder.folderId && renaming !== folder.folderId && (
                <View style={styles.menu}>
                  <Pressable
                    style={styles.menuItem}
                    onPress={() => { setRenaming(folder.folderId); setRenameTo(folder.name); setMenuFor(null); }}
                  >
                    <Ionicons name="create-outline" size={13} color="#a7b7cb" />
                    <Text style={styles.menuText}>Rename</Text>
                  </Pressable>
                  <Pressable
                    style={styles.menuItem}
                    onPress={() => setDelivered.mutate({ folderId: folder.folderId, isDelivered: !folder.isDelivered })}
                  >
                    <Ionicons name={folder.isDelivered ? "close-circle-outline" : "checkmark-circle-outline"} size={13} color="#a7b7cb" />
                    <Text style={styles.menuText}>{folder.isDelivered ? "Mark not delivered" : "Mark delivered"}</Text>
                  </Pressable>
                  <Pressable style={styles.menuItem} onPress={() => { setPendingDelete(folder); setMenuFor(null); }}>
                    <Ionicons name="trash-outline" size={13} color="#ff7a72" />
                    <Text style={[styles.menuText, { color: "#ff7a72" }]}>Remove folder</Text>
                  </Pressable>
                </View>
              )}
            </View>
          );
        })}

        {adding ? (
          <View style={[styles.card, styles.cardEditing]}>
            <TextInput
              style={styles.input}
              value={newName}
              onChangeText={setNewName}
              placeholder="e.g. Drone"
              placeholderTextColor="#6f83a0"
              autoFocus
              maxLength={100}
              onSubmitEditing={() => newName.trim() && create.mutate(newName.trim())}
            />
            <View style={styles.editActions}>
              <Pressable onPress={() => { setAdding(false); setNewName(""); setError(null); }} accessibilityRole="button">
                <Text style={styles.cancelLink}>Cancel</Text>
              </Pressable>
              <Pressable onPress={() => newName.trim() && create.mutate(newName.trim())} disabled={create.isPending} accessibilityRole="button">
                <Text style={styles.saveLink}>Add</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable style={styles.addCard} onPress={() => { setAdding(true); setError(null); }} accessibilityRole="button">
            <Ionicons name="add" size={16} color="#7fc0e6" />
            <Text style={styles.addText}>Add Folder</Text>
          </Pressable>
        )}
      </View>

      {pendingDelete && (
        <View style={styles.confirm}>
          <Text style={styles.confirmText}>
            Remove “{pendingDelete.name}”?{" "}
            {pendingDelete.photoCount > 0
              ? `Its ${pendingDelete.photoCount} photos stay in the gallery under “Other”.`
              : "It has no photos in it."}
          </Text>
          <Pressable onPress={() => setPendingDelete(null)} accessibilityRole="button">
            <Text style={styles.cancelLink}>No</Text>
          </Pressable>
          <Pressable onPress={() => remove.mutate(pendingDelete.folderId)} disabled={remove.isPending} accessibilityRole="button">
            {remove.isPending
              ? <ActivityIndicator size="small" color="#ff7a72" />
              : <Text style={styles.confirmYes}>Yes, remove</Text>}
          </Pressable>
        </View>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const CARD_WIDTH = 168;

const styles = StyleSheet.create({
  wrapper: { gap: 10 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  cardWrap: { position: "relative" },
  raised: { zIndex: 30 },
  card: {
    width: CARD_WIDTH, borderWidth: 1, borderColor: "#23405c", borderRadius: 10,
    backgroundColor: "#0f1e30", paddingVertical: 10, paddingHorizontal: 12, gap: 4,
  },
  cardActive: { borderColor: "#7fc0e6", backgroundColor: "rgba(127, 192, 230, 0.08)" },
  cardEditing: { gap: 8 },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 7 },
  cardName: { color: "#e8edf3", fontSize: 13, fontWeight: "600", flex: 1 },
  cardBottom: { flexDirection: "row", alignItems: "center", gap: 4 },
  cardCount: { color: "#6f83a0", fontSize: 11 },
  cardPicked: { color: "#7fc0e6", fontSize: 11 },
  deliveredRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  deliveredText: { color: "#4cc493", fontSize: 10, fontWeight: "600" },
  menuButton: { position: "absolute", top: 10, right: 8, padding: 2 },
  menuButtonSpace: { width: 17 },

  menu: {
    position: "absolute", top: 34, right: 4, zIndex: 20, minWidth: 168,
    backgroundColor: "#132540", borderWidth: 1, borderColor: "#23405c", borderRadius: 8, paddingVertical: 4,
    boxShadow: "0 6px 18px rgba(0, 0, 0, 0.45)",
  },
  menuItem: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 7, paddingHorizontal: 10 },
  menuText: { color: "#a7b7cb", fontSize: 12, fontWeight: "600" },

  addCard: {
    width: CARD_WIDTH, borderWidth: 1, borderStyle: "dashed", borderColor: "#23405c", borderRadius: 10,
    paddingVertical: 10, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 6,
  },
  addText: { color: "#7fc0e6", fontSize: 12, fontWeight: "600" },

  input: {
    borderWidth: 1, borderColor: "#23405c", borderRadius: 8, paddingVertical: 5, paddingHorizontal: 8,
    color: "#e8edf3", backgroundColor: "#132540", fontSize: 12, outlineStyle: "none",
  } as any,
  editActions: { flexDirection: "row", justifyContent: "flex-end", gap: 12 },
  cancelLink: { color: "#a7b7cb", fontSize: 12, fontWeight: "600" },
  saveLink: { color: "#7fc0e6", fontSize: 12, fontWeight: "700" },

  confirm: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 12 },
  confirmText: { color: "#a7b7cb", fontSize: 12, flexShrink: 1 },
  confirmYes: { color: "#ff7a72", fontSize: 12, fontWeight: "700" },
  error: { color: "#ff7a72", fontSize: 12 },
});
