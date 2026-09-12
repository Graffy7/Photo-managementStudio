import { useEffect, useState } from "react";
import {
  View, Text, TextInput, Pressable, FlatList, StyleSheet, ActivityIndicator, ScrollView, Image, Platform,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { photoSelectionApi } from "../../../api/photoSelectionApi";
import { extractErrorMessage } from "../../../api/errorMessage";
import { API_BASE_URL } from "../../../constants/config";
import { StatusPill } from "../../../components/StatusPill";
import type { Photo, PhotoSelectionStatus } from "../../../types/photoSelection";

function absoluteUrl(path: string): string {
  return path.startsWith("http") ? path : `${API_BASE_URL}${path}`;
}

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-IN", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function statusTone(status: PhotoSelectionStatus): "good" | "bad" | "warn" | "neutral" {
  if (status === "Submitted" || status === "Processed") return "good";
  if (status === "InProgress" || status === "Reopened") return "warn";
  return "neutral";
}

export function PhotoSelectionManageScreen({ projectId, onBack }: { projectId: number; onBack: () => void }) {
  const queryClient = useQueryClient();
  const invalidateProject = () => queryClient.invalidateQueries({ queryKey: ["photo-selection-project", projectId] });

  const { data: project, isLoading } = useQuery({
    queryKey: ["photo-selection-project", projectId],
    queryFn: () => photoSelectionApi.getById(projectId),
  });

  const { data: photos, refetch: refetchPhotos } = useQuery({
    queryKey: ["photo-selection-photos", projectId],
    queryFn: () => photoSelectionApi.getPhotos(projectId, undefined, 200),
  });

  const { data: history } = useQuery({
    queryKey: ["photo-selection-history", projectId],
    queryFn: () => photoSelectionApi.getHistory(projectId),
  });

  const [error, setError] = useState<string | null>(null);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [expiresInDays, setExpiresInDays] = useState("");
  const [pin, setPin] = useState("");
  const [confirmingRevoke, setConfirmingRevoke] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const [jobId, setJobId] = useState<number | null>(null);
  const [showJobDetails, setShowJobDetails] = useState(false);

  const generateLinkMutation = useMutation({
    mutationFn: () =>
      photoSelectionApi.generateLink(projectId, {
        expiresInDays: expiresInDays.trim() ? Number(expiresInDays) : undefined,
        pin: pin.trim() || undefined,
      }),
    onSuccess: (result) => {
      setNewToken(result.token);
      setShowLinkForm(false);
      setError(null);
      invalidateProject();
    },
    onError: (err) => setError(extractErrorMessage(err)),
  });

  const revokeLinkMutation = useMutation({
    mutationFn: () => photoSelectionApi.revokeLink(projectId),
    onSuccess: () => {
      setConfirmingRevoke(false);
      setNewToken(null);
      invalidateProject();
    },
    onError: (err) => setError(extractErrorMessage(err)),
  });

  const reopenMutation = useMutation({
    mutationFn: () => photoSelectionApi.reopen(projectId),
    onSuccess: invalidateProject,
    onError: (err) => setError(extractErrorMessage(err)),
  });

  const processMutation = useMutation({
    mutationFn: () => photoSelectionApi.startProcessing(projectId),
    onSuccess: (job) => {
      setJobId(job.photoProcessingJobId);
      setError(null);
    },
    onError: (err) => setError(extractErrorMessage(err)),
  });

  const { data: job } = useQuery({
    queryKey: ["photo-selection-job", projectId, jobId],
    queryFn: () => photoSelectionApi.getProcessingJob(projectId, jobId!),
    enabled: jobId !== null,
    refetchInterval: (query) => (query.state.data && ["Completed", "CompletedWithErrors", "Failed"].includes(query.state.data.status) ? false : 1500),
  });

  useEffect(() => {
    if (job && ["Completed", "CompletedWithErrors", "Failed"].includes(job.status)) {
      invalidateProject();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.status]);

  const pickAndUploadPhotos = async () => {
    setError(null);
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: true, quality: 0.95 });
    if (result.canceled || result.assets.length === 0) return;

    setUploading(true);
    setUploadProgress({ done: 0, total: result.assets.length });
    try {
      if (Platform.OS === "web") {
        const files: File[] = [];
        for (const asset of result.assets) {
          const blob = await fetch(asset.uri).then((r) => r.blob());
          files.push(new File([blob], asset.fileName ?? `photo-${Date.now()}.jpg`, { type: asset.mimeType ?? "image/jpeg" }));
        }
        await photoSelectionApi.importPhotos(projectId, files);
      } else {
        const entries = result.assets.map((asset) => ({
          uri: asset.uri,
          name: asset.fileName ?? `photo-${Date.now()}.jpg`,
          type: asset.mimeType ?? "image/jpeg",
        }));
        await photoSelectionApi.importPhotos(projectId, entries);
      }
      await refetchPhotos();
      invalidateProject();
    } catch (err) {
      setError(extractErrorMessage(err, "Some photos failed to upload."));
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  };

  if (isLoading || !project) {
    return <ActivityIndicator color="#7fc0e6" style={{ marginTop: 60 }} />;
  }

  const customerLink = newToken ? `${window.location.origin}/photo-selection/${newToken}` : null;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Pressable onPress={onBack} style={styles.backButton}>
        <Text style={styles.backText}>‹ Back</Text>
      </Pressable>

      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{project.name}</Text>
          <Text style={styles.subtitle}>{project.customerName}{project.eventVenue ? ` · ${project.eventVenue}` : ""}</Text>
        </View>
        <StatusPill label={project.status} tone={statusTone(project.status)} />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Photo Selection</Text>
        <View style={styles.statsGrid}>
          <Stat label="Total Photos" value={project.totalPhotos} />
          <Stat label="Selected" value={project.selectedCount} accent="#7fc0e6" />
          <Stat label="Normal" value={project.normalCount} accent="#4cc493" />
          <Stat label="Big Size" value={project.bigCount} accent="#f2bd5c" />
          <Stat label="Pending" value={project.totalPhotos - project.selectedCount} accent="#6f83a0" />
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>Status: {project.status}</Text>
          {project.submittedAt && <Text style={styles.metaText}>Submitted: {formatDateTime(project.submittedAt)}</Text>}
        </View>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Controls</Text>
        <View style={styles.actionRow}>
          <Pressable style={styles.actionButton} onPress={pickAndUploadPhotos} disabled={uploading}>
            {uploading ? (
              <ActivityIndicator color="#0d1826" />
            ) : (
              <Text style={styles.actionButtonText}>
                {uploadProgress ? `Uploading ${uploadProgress.done}/${uploadProgress.total}…` : "Upload / Import Photos"}
              </Text>
            )}
          </Pressable>

          {!project.hasLink || !project.isActive ? (
            <Pressable style={styles.actionButton} onPress={() => setShowLinkForm(true)}>
              <Text style={styles.actionButtonText}>Generate Customer Link</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.actionButtonDanger} onPress={() => setConfirmingRevoke(true)}>
              <Text style={styles.actionButtonDangerText}>Revoke Link</Text>
            </Pressable>
          )}

          {project.status === "Submitted" && (
            <Pressable style={styles.actionButton} onPress={() => reopenMutation.mutate()} disabled={reopenMutation.isPending}>
              <Text style={styles.actionButtonText}>Reopen Selection</Text>
            </Pressable>
          )}

          {project.selectedCount > 0 && (
            <Pressable style={styles.actionButton} onPress={() => processMutation.mutate()} disabled={processMutation.isPending}>
              <Text style={styles.actionButtonText}>Process Selected Photos</Text>
            </Pressable>
          )}

          {project.selectedCount > 0 && (
            <Pressable
              style={styles.actionButton}
              onPress={() => window.open(`${API_BASE_URL}${photoSelectionApi.getReportUrl(projectId)}`, "_blank")}
            >
              <Text style={styles.actionButtonText}>Download Report</Text>
            </Pressable>
          )}
        </View>

        {showLinkForm && (
          <View style={styles.linkForm}>
            <Text style={styles.smallLabel}>Expires in (days, optional)</Text>
            <TextInput style={styles.input} value={expiresInDays} onChangeText={setExpiresInDays} keyboardType="numeric" placeholder="No expiry" placeholderTextColor="#6f83a0" />
            <Text style={styles.smallLabel}>PIN (optional)</Text>
            <TextInput style={styles.input} value={pin} onChangeText={setPin} placeholder="No PIN" placeholderTextColor="#6f83a0" secureTextEntry />
            <View style={styles.linkFormActions}>
              <Pressable onPress={() => setShowLinkForm(false)}><Text style={styles.cancelLink}>Cancel</Text></Pressable>
              <Pressable style={styles.actionButton} onPress={() => generateLinkMutation.mutate()} disabled={generateLinkMutation.isPending}>
                {generateLinkMutation.isPending ? <ActivityIndicator color="#0d1826" /> : <Text style={styles.actionButtonText}>Generate</Text>}
              </Pressable>
            </View>
          </View>
        )}

        {customerLink && (
          <View style={styles.linkBox}>
            <Text style={styles.smallLabel}>Customer link (copy it now — it won't be shown again)</Text>
            <Text style={styles.linkText} selectable>{customerLink}</Text>
          </View>
        )}

        {confirmingRevoke && (
          <View style={styles.confirmRow}>
            <Text style={styles.confirmText}>Revoke this link? The customer will no longer be able to open it.</Text>
            <Pressable onPress={() => setConfirmingRevoke(false)}><Text style={styles.cancelLink}>Cancel</Text></Pressable>
            <Pressable onPress={() => revokeLinkMutation.mutate()}>
              <Text style={styles.confirmRemoveLink}>Yes, revoke</Text>
            </Pressable>
          </View>
        )}

        {job && (
          <View style={styles.jobBox}>
            <Text style={styles.smallLabel}>Processing: {job.totalCount} photos</Text>
            <Text style={styles.metaText}>
              Completed: {job.completedCount} · Missing: {job.missingCount} · Failed: {job.failedCount} ({job.status})
            </Text>
            {(job.missingCount > 0 || job.failedCount > 0) && (
              <Pressable onPress={() => setShowJobDetails((v) => !v)}>
                <Text style={styles.cancelLink}>{showJobDetails ? "Hide details" : "View Details"}</Text>
              </Pressable>
            )}
            {showJobDetails && job.items.filter((i) => i.result !== "Copied").map((item, idx) => (
              <Text key={idx} style={styles.jobItemText}>
                #{item.photoNumber} {item.originalFileName} — {item.result}{item.errorMessage ? `: ${item.errorMessage}` : ""}
              </Text>
            ))}
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Photos ({photos?.length ?? 0})</Text>
        {!photos || photos.length === 0 ? (
          <Text style={styles.empty}>No photos imported yet.</Text>
        ) : (
          <FlatList
            data={photos}
            keyExtractor={(item) => String(item.photoId)}
            numColumns={4}
            columnWrapperStyle={{ gap: 8 }}
            scrollEnabled={false}
            renderItem={({ item }: { item: Photo }) => (
              <View style={styles.thumbCard}>
                <Image source={{ uri: absoluteUrl(item.thumbnailUrl) }} style={styles.thumbImage} resizeMode="cover" />
                <Text style={styles.thumbNumber}>#{item.photoNumber}</Text>
                {item.selectionType !== "None" && (
                  <View style={[styles.thumbBadge, item.selectionType === "Big" && styles.thumbBadgeBig]}>
                    <Text style={styles.thumbBadgeText}>{item.selectionType}</Text>
                  </View>
                )}
              </View>
            )}
          />
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Selection History</Text>
        {!history || history.length === 0 ? (
          <Text style={styles.empty}>No activity yet.</Text>
        ) : (
          history.map((entry, idx) => (
            <View key={idx} style={styles.historyRow}>
              <Text style={styles.historyAction}>
                {entry.action}{entry.photoNumber ? ` — #${entry.photoNumber}` : ""}
                {entry.oldSelectionType ? ` (${entry.oldSelectionType} → ${entry.newSelectionType})` : ""}
              </Text>
              <Text style={styles.historyDate}>{formatDateTime(entry.createdAt)}</Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
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
  screen: { flex: 1, backgroundColor: "#0d1826" },
  content: { padding: 24, maxWidth: 760, width: "100%", alignSelf: "center" },
  backButton: { marginBottom: 14 },
  backText: { color: "#7fc0e6", fontSize: 13, fontWeight: "600" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 },
  title: { fontSize: 22, fontWeight: "700", color: "#e8edf3" },
  subtitle: { fontSize: 13, color: "#6f83a0", marginTop: 2 },
  card: { backgroundColor: "#132540", borderRadius: 12, borderWidth: 1, borderColor: "#23405c", padding: 18, marginBottom: 14 },
  sectionLabel: { fontSize: 12, color: "#7fc0e6", fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 20 },
  stat: { minWidth: 90, gap: 2 },
  statValue: { color: "#e8edf3", fontSize: 20, fontWeight: "700" },
  statLabel: { color: "#6f83a0", fontSize: 11 },
  metaRow: { flexDirection: "row", gap: 16, marginTop: 12 },
  metaText: { color: "#a7b7cb", fontSize: 12 },
  error: { color: "#ff7a72", fontSize: 13, marginBottom: 12 },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  actionButton: { backgroundColor: "#ff9a4d", borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16 },
  actionButtonText: { color: "#0d1826", fontWeight: "700", fontSize: 12 },
  actionButtonDanger: { borderWidth: 1, borderColor: "#ff7a72", borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16 },
  actionButtonDangerText: { color: "#ff7a72", fontWeight: "700", fontSize: 12 },
  smallLabel: { fontSize: 11, color: "#7fc0e6", fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 12, marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: "#23405c", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14, color: "#e8edf3", backgroundColor: "#0d1826",
  },
  linkForm: { marginTop: 8, borderTopWidth: 1, borderTopColor: "#1b2c42", paddingTop: 12 },
  linkFormActions: { flexDirection: "row", justifyContent: "flex-end", gap: 16, marginTop: 12, alignItems: "center" },
  linkBox: { marginTop: 12, borderWidth: 1, borderColor: "#23405c", borderStyle: "dashed", borderRadius: 8, padding: 12, backgroundColor: "#0f1e30" },
  linkText: { color: "#4cc493", fontSize: 12, marginTop: 4 },
  confirmRow: {
    flexDirection: "row", alignItems: "center", gap: 16, marginTop: 12, padding: 12,
    borderWidth: 1, borderColor: "#23405c", borderStyle: "dashed", borderRadius: 8, backgroundColor: "#0f1e30",
  },
  confirmText: { color: "#e8edf3", fontSize: 13, flex: 1 },
  cancelLink: { color: "#a7b7cb", fontSize: 12, fontWeight: "600" },
  confirmRemoveLink: { color: "#ff7a72", fontSize: 13, fontWeight: "700" },
  jobBox: { marginTop: 12, borderWidth: 1, borderColor: "#23405c", borderRadius: 8, padding: 12, backgroundColor: "#0f1e30" },
  jobItemText: { color: "#f2bd5c", fontSize: 11, marginTop: 4 },
  empty: { color: "#6f83a0", fontSize: 13 },
  thumbCard: { flex: 1, marginBottom: 8, alignItems: "center" },
  thumbImage: { width: "100%", aspectRatio: 1, borderRadius: 6, backgroundColor: "#0d1826" },
  thumbNumber: { color: "#6f83a0", fontSize: 10, marginTop: 3 },
  thumbBadge: { backgroundColor: "#4cc49333", borderRadius: 100, paddingHorizontal: 6, paddingVertical: 1, marginTop: 2 },
  thumbBadgeBig: { backgroundColor: "#f2bd5c33" },
  thumbBadgeText: { color: "#e8edf3", fontSize: 9, fontWeight: "700" },
  historyRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#1b2c42" },
  historyAction: { color: "#e8edf3", fontSize: 12, flex: 1 },
  historyDate: { color: "#6f83a0", fontSize: 11 },
});
