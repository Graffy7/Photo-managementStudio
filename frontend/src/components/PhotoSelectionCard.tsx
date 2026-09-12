import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { photoSelectionApi } from "../api/photoSelectionApi";
import { extractErrorMessage } from "../api/errorMessage";
import { StatusPill } from "./StatusPill";
import { FolderPathField } from "./FolderPathField";

// Embedded summary shown on an event's detail page (point 7 of the photo-selection spec) — full
// management (upload, link, process, history) lives in the dedicated PhotoSelectionManageScreen;
// this card is just "is there one, what's the state, and a way in".
export function PhotoSelectionCard({
  customerId,
  eventId,
  onManage,
}: {
  customerId: number;
  eventId: number;
  onManage: (projectId: number) => void;
}) {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [sourceFolder, setSourceFolder] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: projects, isLoading } = useQuery({
    queryKey: ["photo-selection-projects", customerId, eventId],
    queryFn: () => photoSelectionApi.search({ customerId, eventId }),
  });

  const createMutation = useMutation({
    mutationFn: () => photoSelectionApi.create({ customerId, eventId, name: name.trim(), sourceFolder: sourceFolder.trim() }),
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ["photo-selection-projects", customerId, eventId] });
      setCreating(false);
      onManage(project.photoSelectionProjectId);
    },
    onError: (err) => setError(extractErrorMessage(err)),
  });

  if (isLoading) {
    return <ActivityIndicator color="#7fc0e6" style={{ marginVertical: 10 }} />;
  }

  const project = projects?.[0];

  if (!project) {
    if (!creating) {
      return (
        <Pressable style={styles.createTrigger} onPress={() => setCreating(true)}>
          <Text style={styles.createTriggerText}>+ Create Selection</Text>
        </Pressable>
      );
    }
    return (
      <View style={styles.createForm}>
        <Text style={styles.label}>Selection name</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Wedding Album Selection" placeholderTextColor="#6f83a0" />
        <Text style={styles.label}>Source folder (where the originals live)</Text>
        <FolderPathField value={sourceFolder} onChange={setSourceFolder} placeholder="D:\StudioPhotos\Gowthaman Wedding\Original Photos" />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={styles.createFormActions}>
          <Pressable onPress={() => setCreating(false)}><Text style={styles.cancelLink}>Cancel</Text></Pressable>
          <Pressable
            style={styles.createButton}
            onPress={() => createMutation.mutate()}
            disabled={createMutation.isPending || !name.trim() || !sourceFolder.trim()}
          >
            {createMutation.isPending ? <ActivityIndicator color="#0d1826" /> : <Text style={styles.createButtonText}>Create</Text>}
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View>
      <View style={styles.summaryRow}>
        <Stat label="Total Photos" value={project.totalPhotos} />
        <Stat label="Selected" value={project.selectedCount} accent="#7fc0e6" />
        <Stat label="Normal" value={project.normalCount} accent="#4cc493" />
        <Stat label="Big Size" value={project.bigCount} accent="#f2bd5c" />
        <Stat label="Pending" value={project.totalPhotos - project.selectedCount} accent="#6f83a0" />
      </View>
      <View style={styles.statusRow}>
        <StatusPill label={project.status} tone={project.status === "Submitted" || project.status === "Processed" ? "good" : "neutral"} />
        {project.submittedAt && <Text style={styles.metaText}>Submitted {new Date(project.submittedAt).toLocaleDateString()}</Text>}
      </View>
      <Pressable style={styles.manageButton} onPress={() => onManage(project.photoSelectionProjectId)}>
        <Text style={styles.manageButtonText}>Manage Photo Selection</Text>
      </Pressable>
    </View>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, accent ? { color: accent } : null]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  createTrigger: { alignSelf: "flex-start" },
  createTriggerText: { color: "#7fc0e6", fontSize: 13, fontWeight: "600" },
  createForm: { gap: 4 },
  label: { fontSize: 12, color: "#a7b7cb", marginTop: 8, marginBottom: 4 },
  input: {
    borderWidth: 1, borderColor: "#23405c", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9,
    fontSize: 13, color: "#e8edf3", backgroundColor: "#0d1826",
  },
  error: { color: "#ff7a72", fontSize: 12, marginTop: 6 },
  createFormActions: { flexDirection: "row", justifyContent: "flex-end", gap: 16, alignItems: "center", marginTop: 10 },
  cancelLink: { color: "#a7b7cb", fontSize: 12, fontWeight: "600" },
  createButton: { backgroundColor: "#ff9a4d", borderRadius: 8, paddingVertical: 9, paddingHorizontal: 16 },
  createButtonText: { color: "#0d1826", fontWeight: "700", fontSize: 12 },
  summaryRow: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  stat: { minWidth: 80, gap: 2 },
  statValue: { color: "#e8edf3", fontSize: 17, fontWeight: "700" },
  statLabel: { color: "#6f83a0", fontSize: 10 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 },
  metaText: { color: "#6f83a0", fontSize: 11 },
  manageButton: { backgroundColor: "#ff9a4d", borderRadius: 8, paddingVertical: 9, paddingHorizontal: 16, alignSelf: "flex-start", marginTop: 12 },
  manageButtonText: { color: "#0d1826", fontWeight: "700", fontSize: 12 },
});
