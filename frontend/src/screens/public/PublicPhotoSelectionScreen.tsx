import { useEffect, useState } from "react";
import {
  View, Text, Image, TextInput, Pressable, FlatList, StyleSheet, ActivityIndicator, Modal, SafeAreaView,
} from "react-native";
import axios from "axios";
import { QueryClientProvider, QueryClient, useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { publicPhotoSelectionApi, setPhotoSelectionPin } from "../../api/publicPhotoSelectionApi";
import { extractErrorMessage } from "../../api/errorMessage";
import { API_BASE_URL } from "../../constants/config";
import type { PublicPhoto, PhotoSelectionType } from "../../types/photoSelection";

// A completely standalone tree — no auth store, no studio-owner QueryClient, no navigation.
// App.tsx mounts this directly (bypassing RootNavigator entirely) when the URL matches
// /photo-selection/:token, so it needs its own QueryClientProvider.
const queryClient = new QueryClient();

export function PublicPhotoSelectionScreen({ token }: { token: string }) {
  return (
    <QueryClientProvider client={queryClient}>
      <GalleryContent token={token} />
    </QueryClientProvider>
  );
}

function absoluteUrl(path: string): string {
  return path.startsWith("http") ? path : `${API_BASE_URL}${path}`;
}

function statusCodeOf(err: unknown): number | null {
  return axios.isAxiosError(err) ? (err.response?.status ?? null) : null;
}

function GalleryContent({ token }: { token: string }) {
  const qc = useQueryClient();
  const [needsPin, setNeedsPin] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinChecking, setPinChecking] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const summaryQuery = useQuery({
    queryKey: ["public-summary", token],
    queryFn: () => publicPhotoSelectionApi.getSummary(token),
    retry: false,
  });

  useEffect(() => {
    if (summaryQuery.isError) {
      setNeedsPin(statusCodeOf(summaryQuery.error) === 401);
    } else if (summaryQuery.isSuccess) {
      setNeedsPin(false);
    }
  }, [summaryQuery.isError, summaryQuery.isSuccess, summaryQuery.error]);

  const photosQuery = useInfiniteQuery({
    queryKey: ["public-photos", token],
    queryFn: ({ pageParam }) => publicPhotoSelectionApi.getPhotos(token, pageParam, 50),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage) => (lastPage.length < 50 ? undefined : lastPage[lastPage.length - 1].photoNumber),
    enabled: summaryQuery.isSuccess,
  });

  const selectionMutation = useMutation({
    mutationFn: ({ photoId, type }: { photoId: number; type: PhotoSelectionType }) =>
      publicPhotoSelectionApi.setSelection(token, photoId, type),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["public-summary", token] });
      qc.invalidateQueries({ queryKey: ["public-photos", token] });
    },
  });

  const submitMutation = useMutation({
    mutationFn: () => publicPhotoSelectionApi.submit(token),
    onSuccess: () => {
      setShowConfirm(false);
      setSubmitError(null);
      qc.invalidateQueries({ queryKey: ["public-summary", token] });
    },
    onError: (err) => setSubmitError(extractErrorMessage(err)),
  });

  const handlePinSubmit = async () => {
    setPinError(null);
    setPinChecking(true);
    try {
      await publicPhotoSelectionApi.unlock(token, pinInput);
      setPhotoSelectionPin(pinInput);
      setNeedsPin(false);
      await qc.invalidateQueries({ queryKey: ["public-summary", token] });
    } catch (err) {
      setPinError(extractErrorMessage(err, "Incorrect PIN."));
    } finally {
      setPinChecking(false);
    }
  };

  if (summaryQuery.isLoading) {
    return (
      <View style={styles.centerScreen}>
        <ActivityIndicator color="#7fc0e6" size="large" />
      </View>
    );
  }

  if (needsPin) {
    return (
      <View style={styles.centerScreen}>
        <View style={styles.pinCard}>
          <Text style={styles.pinTitle}>Enter your access PIN</Text>
          <Text style={styles.pinSubtitle}>Your photographer protected this gallery with a PIN.</Text>
          <TextInput
            style={styles.pinInput}
            value={pinInput}
            onChangeText={setPinInput}
            placeholder="PIN"
            placeholderTextColor="#6f83a0"
            secureTextEntry
            autoFocus
          />
          {pinError ? <Text style={styles.errorText}>{pinError}</Text> : null}
          <Pressable style={styles.primaryButton} onPress={handlePinSubmit} disabled={pinChecking || !pinInput.trim()}>
            {pinChecking ? <ActivityIndicator color="#0d1826" /> : <Text style={styles.primaryButtonText}>Continue</Text>}
          </Pressable>
        </View>
      </View>
    );
  }

  if (summaryQuery.isError) {
    return (
      <View style={styles.centerScreen}>
        <Text style={styles.errorTitle}>This link is no longer valid</Text>
        <Text style={styles.errorSubtitle}>It may have been revoked or expired. Please contact your photographer for a new link.</Text>
      </View>
    );
  }

  const summary = summaryQuery.data!;
  const photos = photosQuery.data?.pages.flat() ?? [];
  const remaining = summary.selectionLimitTotal !== null ? Math.max(0, summary.selectionLimitTotal - summary.selectedCount) : null;

  if (summary.isSubmitted) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.centerScreen}>
          <Text style={styles.doneTitle}>✓ Selection submitted</Text>
          <Text style={styles.doneSubtitle}>
            Thank you! You selected {summary.selectedCount} photo{summary.selectedCount === 1 ? "" : "s"}
            {"\n"}({summary.normalCount} Normal · {summary.bigCount} Big Size)
          </Text>
          <Text style={styles.doneMeta}>Submitted {summary.submittedAt ? new Date(summary.submittedAt).toLocaleString() : ""}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const canSelectNormal = (photo: PublicPhoto) =>
    photo.selectionType === "Normal" ||
    ((summary.selectionLimitTotal === null || summary.selectedCount < summary.selectionLimitTotal) &&
      (summary.selectionLimitNormal === null || summary.normalCount < summary.selectionLimitNormal));

  const canSelectBig = (photo: PublicPhoto) =>
    photo.selectionType === "Big" ||
    ((summary.selectionLimitTotal === null || summary.selectedCount < summary.selectionLimitTotal) &&
      (summary.selectionLimitBig === null || summary.bigCount < summary.selectionLimitBig));

  const setType = (photo: PublicPhoto, type: PhotoSelectionType) => {
    const next = photo.selectionType === type ? "None" : type;
    selectionMutation.mutate({ photoId: photo.photoId, type: next });
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.counterBar}>
        <Text style={styles.counterTitle}>{summary.projectName}</Text>
        <View style={styles.counterRow}>
          <CounterStat label="Total" value={summary.totalPhotos} />
          <CounterStat label="Selected" value={summary.selectedCount} accent="#7fc0e6" />
          <CounterStat label="Normal" value={summary.normalCount} accent="#4cc493" />
          <CounterStat label="Big" value={summary.bigCount} accent="#f2bd5c" />
          {remaining !== null && <CounterStat label="Remaining" value={remaining} accent="#ff9a4d" />}
        </View>
      </View>

      <FlatList
        data={photos}
        keyExtractor={(item) => String(item.photoId)}
        numColumns={2}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={{ gap: 10 }}
        onEndReached={() => {
          if (photosQuery.hasNextPage && !photosQuery.isFetchingNextPage) photosQuery.fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        ListFooterComponent={photosQuery.isFetchingNextPage ? <ActivityIndicator color="#7fc0e6" style={{ marginVertical: 16 }} /> : null}
        renderItem={({ item }) => (
          <View style={styles.photoCard}>
            <Image source={{ uri: absoluteUrl(item.previewUrl) }} style={styles.photoImage} resizeMode="cover" />
            <Text style={styles.photoNumber}>#{item.photoNumber}</Text>
            <View style={styles.selectRow}>
              <Pressable
                style={[styles.selectChip, item.selectionType !== "None" && styles.selectChipActive]}
                onPress={() => setType(item, item.selectionType === "None" ? "Normal" : "None")}
              >
                <Text style={[styles.selectChipText, item.selectionType !== "None" && styles.selectChipTextActive]}>
                  {item.selectionType !== "None" ? "☑ Selected" : "☐ Select"}
                </Text>
              </Pressable>
            </View>
            {item.selectionType !== "None" && (
              <View style={styles.typeRow}>
                <Pressable
                  style={[styles.typeChip, item.selectionType === "Normal" && styles.typeChipActive]}
                  onPress={() => canSelectNormal(item) && setType(item, "Normal")}
                  disabled={!canSelectNormal(item)}
                >
                  <Text style={[styles.typeChipText, item.selectionType === "Normal" && styles.typeChipTextActive]}>Normal</Text>
                </Pressable>
                <Pressable
                  style={[styles.typeChip, item.selectionType === "Big" && styles.typeChipActive]}
                  onPress={() => canSelectBig(item) && setType(item, "Big")}
                  disabled={!canSelectBig(item)}
                >
                  <Text style={[styles.typeChipText, item.selectionType === "Big" && styles.typeChipTextActive]}>Big Size</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}
      />

      <View style={styles.submitBar}>
        <Pressable style={styles.submitButton} onPress={() => setShowConfirm(true)} disabled={summary.selectedCount === 0}>
          <Text style={styles.submitButtonText}>SUBMIT SELECTION</Text>
        </Pressable>
      </View>

      <Modal visible={showConfirm} transparent animationType="fade" onRequestClose={() => setShowConfirm(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>You selected:</Text>
            <Text style={styles.modalLine}>Total: {summary.selectedCount}</Text>
            <Text style={styles.modalLine}>Normal Size: {summary.normalCount}</Text>
            <Text style={styles.modalLine}>Big Size: {summary.bigCount}</Text>
            <Text style={styles.modalQuestion}>Are you sure you want to submit?</Text>
            {submitError ? <Text style={styles.errorText}>{submitError}</Text> : null}
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancel} onPress={() => setShowConfirm(false)} disabled={submitMutation.isPending}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalConfirm} onPress={() => submitMutation.mutate()} disabled={submitMutation.isPending}>
                {submitMutation.isPending ? <ActivityIndicator color="#0d1826" /> : <Text style={styles.modalConfirmText}>Yes, Submit</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function CounterStat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <View style={styles.counterStat}>
      <Text style={[styles.counterValue, accent ? { color: accent } : null]}>{value}</Text>
      <Text style={styles.counterLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0d1826" },
  centerScreen: { flex: 1, backgroundColor: "#0d1826", alignItems: "center", justifyContent: "center", padding: 24 },

  pinCard: {
    width: "100%", maxWidth: 360, backgroundColor: "#132540", borderRadius: 12, padding: 24,
    borderWidth: 1, borderColor: "#23405c",
  },
  pinTitle: { color: "#e8edf3", fontSize: 18, fontWeight: "700", textAlign: "center" },
  pinSubtitle: { color: "#a7b7cb", fontSize: 13, textAlign: "center", marginTop: 6, marginBottom: 18 },
  pinInput: {
    borderWidth: 1, borderColor: "#23405c", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 16, color: "#e8edf3", backgroundColor: "#0d1826", textAlign: "center", letterSpacing: 4,
  },
  errorText: { color: "#ff7a72", fontSize: 13, marginTop: 10, textAlign: "center" },
  primaryButton: { backgroundColor: "#ff9a4d", borderRadius: 8, paddingVertical: 13, alignItems: "center", marginTop: 16 },
  primaryButtonText: { color: "#0d1826", fontWeight: "700", fontSize: 15 },

  errorTitle: { color: "#e8edf3", fontSize: 18, fontWeight: "700", textAlign: "center" },
  errorSubtitle: { color: "#a7b7cb", fontSize: 13, textAlign: "center", marginTop: 8, lineHeight: 20 },

  doneTitle: { color: "#4cc493", fontSize: 22, fontWeight: "700", textAlign: "center" },
  doneSubtitle: { color: "#e8edf3", fontSize: 15, textAlign: "center", marginTop: 12, lineHeight: 22 },
  doneMeta: { color: "#6f83a0", fontSize: 12, textAlign: "center", marginTop: 12 },

  counterBar: { backgroundColor: "#132540", borderBottomWidth: 1, borderBottomColor: "#23405c", padding: 14 },
  counterTitle: { color: "#e8edf3", fontSize: 15, fontWeight: "700", marginBottom: 10, textAlign: "center" },
  counterRow: { flexDirection: "row", justifyContent: "space-around" },
  counterStat: { alignItems: "center" },
  counterValue: { color: "#e8edf3", fontSize: 18, fontWeight: "700" },
  counterLabel: { color: "#6f83a0", fontSize: 10, marginTop: 2 },

  grid: { padding: 10, paddingBottom: 90, gap: 10 },
  photoCard: {
    flex: 1, backgroundColor: "#132540", borderRadius: 10, borderWidth: 1, borderColor: "#23405c",
    padding: 8, marginBottom: 10,
  },
  photoImage: { width: "100%", aspectRatio: 1, borderRadius: 6, backgroundColor: "#0d1826" },
  photoNumber: { color: "#7fc0e6", fontSize: 12, fontWeight: "700", marginTop: 6, textAlign: "center" },
  selectRow: { marginTop: 6 },
  selectChip: {
    borderWidth: 1, borderColor: "#23405c", borderRadius: 100, paddingVertical: 6, alignItems: "center", backgroundColor: "#0d1826",
  },
  selectChipActive: { borderColor: "#4cc493", backgroundColor: "rgba(76, 196, 147, 0.14)" },
  selectChipText: { color: "#a7b7cb", fontSize: 12, fontWeight: "600" },
  selectChipTextActive: { color: "#4cc493" },
  typeRow: { flexDirection: "row", gap: 6, marginTop: 6 },
  typeChip: {
    flex: 1, borderWidth: 1, borderColor: "#23405c", borderRadius: 6, paddingVertical: 6, alignItems: "center", backgroundColor: "#0d1826",
  },
  typeChipActive: { borderColor: "#ff9a4d", backgroundColor: "rgba(255, 154, 77, 0.14)" },
  typeChipText: { color: "#a7b7cb", fontSize: 11, fontWeight: "600" },
  typeChipTextActive: { color: "#ff9a4d" },

  submitBar: {
    position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#132540",
    borderTopWidth: 1, borderTopColor: "#23405c", padding: 14,
  },
  submitButton: { backgroundColor: "#ff9a4d", borderRadius: 8, paddingVertical: 14, alignItems: "center" },
  submitButtonText: { color: "#0d1826", fontWeight: "700", fontSize: 14, letterSpacing: 0.5 },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", padding: 24 },
  modalCard: { width: "100%", maxWidth: 340, backgroundColor: "#132540", borderRadius: 12, padding: 22, borderWidth: 1, borderColor: "#23405c" },
  modalTitle: { color: "#e8edf3", fontSize: 15, fontWeight: "700", marginBottom: 8 },
  modalLine: { color: "#a7b7cb", fontSize: 14, marginTop: 2 },
  modalQuestion: { color: "#e8edf3", fontSize: 14, fontWeight: "600", marginTop: 14 },
  modalActions: { flexDirection: "row", gap: 12, marginTop: 18 },
  modalCancel: { flex: 1, borderWidth: 1, borderColor: "#23405c", borderRadius: 8, paddingVertical: 12, alignItems: "center" },
  modalCancelText: { color: "#a7b7cb", fontWeight: "600" },
  modalConfirm: { flex: 1, backgroundColor: "#ff9a4d", borderRadius: 8, paddingVertical: 12, alignItems: "center" },
  modalConfirmText: { color: "#0d1826", fontWeight: "700" },
});
