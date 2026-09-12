import { useState } from "react";
import { View, Text, TextInput, Pressable, FlatList, StyleSheet, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { photoSelectionApi } from "../../../api/photoSelectionApi";
import { extractErrorMessage } from "../../../api/errorMessage";
import { StatusPill } from "../../../components/StatusPill";
import { FolderPathField } from "../../../components/FolderPathField";
import { useRefetchOnFocus } from "../../../hooks/useRefetchOnFocus";
import type { CompletedEventPhotoSelection, PhotoSelectionStatus } from "../../../types/photoSelection";

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
}

// Only the three states a studio owner actually needs to act on/notice at a glance — every
// in-between project status (Draft/LinkGenerated/InProgress/Reopened) reads as "customer hasn't
// submitted yet", and Submitted/Processed both read as "customer submitted".
function displayStatus(status: PhotoSelectionStatus | null): { label: string; tone: "neutral" | "warn" | "good" } {
  if (status === null) return { label: "Need to Send", tone: "neutral" };
  if (status === "Submitted" || status === "Processed") return { label: "Customer Submitted", tone: "good" };
  return { label: "Already Sent", tone: "warn" };
}

export function PhotoSelectionListScreen({ onManage }: { onManage: (projectId: number) => void }) {
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const [creatingForEventId, setCreatingForEventId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [sourceFolder, setSourceFolder] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["photo-selection-completed-events"],
    queryFn: photoSelectionApi.getCompletedEvents,
  });
  useRefetchOnFocus(refetch);

  const createMutation = useMutation({
    mutationFn: (item: CompletedEventPhotoSelection) =>
      photoSelectionApi.create({ customerId: item.customerId, eventId: item.eventId, name: name.trim(), sourceFolder: sourceFolder.trim() }),
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ["photo-selection-completed-events"] });
      setCreatingForEventId(null);
      setName("");
      setSourceFolder("");
      onManage(project.photoSelectionProjectId);
    },
    onError: (err) => setError(extractErrorMessage(err)),
  });

  const renderItem = ({ item }: { item: CompletedEventPhotoSelection }) => {
    const status = displayStatus(item.status);
    const isCreating = creatingForEventId === item.eventId;

    return (
      <View style={styles.row}>
        <View style={styles.rowMain}>
          <Text style={styles.eventDate}>{formatDate(item.eventDate)}</Text>
          <Text style={styles.customerName}>{item.customerName}</Text>
          {item.venue ? <Text style={styles.venue}>{item.venue}</Text> : null}

          {isCreating ? (
            <View style={styles.createForm}>
              <Text style={styles.label}>Selection name</Text>
              <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Wedding Album Selection" placeholderTextColor="#6f83a0" />
              <Text style={styles.label}>Source folder (where the originals live)</Text>
              <FolderPathField value={sourceFolder} onChange={setSourceFolder} placeholder="D:\StudioPhotos\...\Original Photos" />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <View style={styles.createFormActions}>
                <Pressable onPress={() => { setCreatingForEventId(null); setError(null); }}>
                  <Text style={styles.cancelLink}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={styles.createButton}
                  onPress={() => createMutation.mutate(item)}
                  disabled={createMutation.isPending || !name.trim() || !sourceFolder.trim()}
                >
                  {createMutation.isPending ? <ActivityIndicator color="#0d1826" /> : <Text style={styles.createButtonText}>Create</Text>}
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable
              onPress={() =>
                item.photoSelectionProjectId ? onManage(item.photoSelectionProjectId) : setCreatingForEventId(item.eventId)
              }
            >
              <StatusPill label={status.label} tone={status.tone} />
            </Pressable>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Photo Selection</Text>
          <Text style={styles.subtitle}>Completed events — send a selection link or check on one already sent</Text>
        </View>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>‹ Home</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <ActivityIndicator color="#ff9a4d" style={{ marginTop: 40 }} />
      ) : isError ? (
        <Text style={styles.errorCentered}>Couldn't load completed events.</Text>
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(item) => String(item.eventId)}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={<Text style={styles.empty}>No completed events yet — photo selection can be sent once an event is marked Completed.</Text>}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0d1826", padding: 24 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 },
  title: { fontSize: 24, fontWeight: "700", color: "#e8edf3" },
  subtitle: { fontSize: 13, color: "#6f83a0", marginTop: 2, maxWidth: 420 },
  backButton: { backgroundColor: "#132540", borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16, borderWidth: 1, borderColor: "#23405c" },
  backText: { color: "#7fc0e6", fontWeight: "600", fontSize: 13 },
  row: { paddingVertical: 14 },
  rowMain: { gap: 4 },
  eventDate: { color: "#7fc0e6", fontSize: 12, fontWeight: "600" },
  customerName: { color: "#e8edf3", fontSize: 16, fontWeight: "600" },
  venue: { color: "#a7b7cb", fontSize: 13 },
  separator: { height: 1, backgroundColor: "#1b2c42" },
  errorCentered: { color: "#ff7a72", marginTop: 40, textAlign: "center" },
  empty: { color: "#6f83a0", marginTop: 40, textAlign: "center", paddingHorizontal: 20 },

  createForm: { marginTop: 8, maxWidth: 420 },
  label: { fontSize: 12, color: "#a7b7cb", marginTop: 8, marginBottom: 4 },
  input: {
    borderWidth: 1, borderColor: "#23405c", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9,
    fontSize: 13, color: "#e8edf3", backgroundColor: "#132540",
  },
  error: { color: "#ff7a72", fontSize: 12, marginTop: 6 },
  createFormActions: { flexDirection: "row", justifyContent: "flex-end", gap: 16, alignItems: "center", marginTop: 10 },
  cancelLink: { color: "#a7b7cb", fontSize: 12, fontWeight: "600" },
  createButton: { backgroundColor: "#ff9a4d", borderRadius: 8, paddingVertical: 9, paddingHorizontal: 16 },
  createButtonText: { color: "#0d1826", fontWeight: "700", fontSize: 12 },
});
