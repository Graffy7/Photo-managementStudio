import { useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Image, Platform } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { settingsApi } from "../../../api/settingsApi";
import { extractErrorMessage } from "../../../api/errorMessage";
import { API_BASE_URL } from "../../../constants/config";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/jpg", "image/png"];
const MAX_SIZE_BYTES = 2 * 1024 * 1024;

export function LogoBrandingTab() {
  const queryClient = useQueryClient();
  const { data, isPending } = useQuery({ queryKey: ["studio-profile"], queryFn: settingsApi.getProfile });
  const [error, setError] = useState<string | null>(null);
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["studio-profile"] });

  const uploadMutation = useMutation({
    mutationFn: async (asset: ImagePicker.ImagePickerAsset) => {
      if (asset.mimeType && !ALLOWED_MIME_TYPES.includes(asset.mimeType)) {
        throw new Error("Please choose a JPG or PNG image.");
      }
      if (asset.fileSize && asset.fileSize > MAX_SIZE_BYTES) {
        throw new Error("The logo must be 2MB or smaller.");
      }

      if (Platform.OS === "web") {
        const blob = await fetch(asset.uri).then((r) => r.blob());
        return settingsApi.uploadLogo(blob, asset.fileName ?? "logo.jpg");
      }
      return settingsApi.uploadLogo({
        uri: asset.uri,
        name: asset.fileName ?? "logo.jpg",
        type: asset.mimeType ?? "image/jpeg",
      });
    },
    onSuccess: () => {
      setError(null);
      invalidate();
    },
    onError: (err) => setError(err instanceof Error ? err.message : extractErrorMessage(err)),
  });

  const removeMutation = useMutation({
    mutationFn: settingsApi.removeLogo,
    onSuccess: () => {
      setConfirmingRemove(false);
      invalidate();
    },
    onError: (err) => setError(extractErrorMessage(err)),
  });

  const pickImage = async () => {
    setError(null);
    if (Platform.OS !== "web") {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError("Photo library permission is required to choose a logo.");
        return;
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.9 });
    if (!result.canceled && result.assets[0]) {
      uploadMutation.mutate(result.assets[0]);
    }
  };

  if (isPending) {
    return <ActivityIndicator color="#7fc0e6" style={{ marginTop: 40 }} />;
  }

  const logoUrl = data?.logoUrl ? `${API_BASE_URL}${data.logoUrl}` : null;

  return (
    <View>
      <Text style={styles.hint}>Recommended size: 500×500px or similar. JPG or PNG, up to 2MB.</Text>

      <View style={styles.previewCard}>
        {logoUrl ? (
          <Image source={{ uri: logoUrl }} style={styles.preview} resizeMode="contain" />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>No logo yet</Text>
          </View>
        )}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.actions}>
        <Pressable style={styles.primaryButton} onPress={pickImage} disabled={uploadMutation.isPending}>
          {uploadMutation.isPending ? (
            <ActivityIndicator color="#0d1826" />
          ) : (
            <Text style={styles.primaryButtonText}>{logoUrl ? "Replace logo" : "Upload logo"}</Text>
          )}
        </Pressable>

        {logoUrl && !confirmingRemove && (
          <Pressable style={styles.dangerButton} onPress={() => setConfirmingRemove(true)}>
            <Text style={styles.dangerButtonText}>Remove logo</Text>
          </Pressable>
        )}
      </View>

      {confirmingRemove && (
        <View style={styles.confirmRow}>
          <Text style={styles.confirmText}>Remove this logo?</Text>
          <Pressable onPress={() => setConfirmingRemove(false)}>
            <Text style={styles.cancelLink}>Cancel</Text>
          </Pressable>
          <Pressable onPress={() => removeMutation.mutate()} disabled={removeMutation.isPending}>
            {removeMutation.isPending ? (
              <ActivityIndicator color="#ff7a72" size="small" />
            ) : (
              <Text style={styles.confirmRemoveLink}>Yes, remove</Text>
            )}
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  hint: { color: "#6f83a0", fontSize: 12, marginBottom: 16 },
  previewCard: {
    width: 140, height: 140, borderRadius: 12, borderWidth: 1, borderColor: "#23405c", backgroundColor: "#132540",
    alignItems: "center", justifyContent: "center", overflow: "hidden", marginBottom: 16,
  },
  preview: { width: "100%", height: "100%" },
  placeholder: { alignItems: "center", justifyContent: "center" },
  placeholderText: { color: "#6f83a0", fontSize: 12 },
  error: { color: "#ff7a72", fontSize: 13, marginBottom: 8 },
  actions: { flexDirection: "row", gap: 12 },
  primaryButton: { backgroundColor: "#ff9a4d", borderRadius: 8, paddingVertical: 11, paddingHorizontal: 20 },
  primaryButtonText: { color: "#0d1826", fontWeight: "700", fontSize: 13 },
  dangerButton: { borderWidth: 1, borderColor: "#ff7a72", borderRadius: 8, paddingVertical: 11, paddingHorizontal: 20 },
  dangerButtonText: { color: "#ff7a72", fontWeight: "700", fontSize: 13 },
  confirmRow: {
    flexDirection: "row", alignItems: "center", gap: 16, marginTop: 14, padding: 12,
    borderWidth: 1, borderColor: "#23405c", borderStyle: "dashed", borderRadius: 8, backgroundColor: "#0f1e30",
  },
  confirmText: { color: "#e8edf3", fontSize: 13, flex: 1 },
  cancelLink: { color: "#a7b7cb", fontSize: 13, fontWeight: "600" },
  confirmRemoveLink: { color: "#ff7a72", fontSize: 13, fontWeight: "700" },
});
