import { useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Image, Platform } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { settingsApi } from "../../../api/settingsApi";
import { extractErrorMessage } from "../../../api/errorMessage";
import { API_BASE_URL } from "../../../constants/config";
import { ConfirmDialog } from "../../../ui/ConfirmDialog";

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
    return <ActivityIndicator color="#5B9BFF" style={{ marginTop: 40 }} />;
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
            <ActivityIndicator color="#070F24" />
          ) : (
            <Text style={styles.primaryButtonText}>{logoUrl ? "Replace logo" : "Upload logo"}</Text>
          )}
        </Pressable>

        {logoUrl && (
          <Pressable style={styles.dangerButton} onPress={() => setConfirmingRemove(true)}>
            <Text style={styles.dangerButtonText}>Remove logo</Text>
          </Pressable>
        )}
      </View>

      <ConfirmDialog
        visible={confirmingRemove}
        icon="image-outline"
        title="Remove logo?"
        message="Your logo will no longer appear on quotations, the sidebar or the customer photo page. You can upload a new one any time."
        confirmLabel="Remove"
        busy={removeMutation.isPending}
        onCancel={() => setConfirmingRemove(false)}
        onConfirm={() => removeMutation.mutate()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hint: { color: "#A4AFCF", fontSize: 12, marginBottom: 16 },
  previewCard: {
    width: 140, height: 140, borderRadius: 12, borderWidth: 1, borderColor: "#2E4377", backgroundColor: "#111E3F",
    alignItems: "center", justifyContent: "center", overflow: "hidden", marginBottom: 16,
  },
  preview: { width: "100%", height: "100%" },
  placeholder: { alignItems: "center", justifyContent: "center" },
  placeholderText: { color: "#A4AFCF", fontSize: 12 },
  error: { color: "#FF5C75", fontSize: 13, marginBottom: 8 },
  actions: { flexDirection: "row", gap: 12 },
  primaryButton: { backgroundColor: "#5B9BFF", borderRadius: 8, paddingVertical: 11, paddingHorizontal: 20 },
  primaryButtonText: { color: "#070F24", fontWeight: "700", fontSize: 13 },
  dangerButton: { borderWidth: 1, borderColor: "#FF5C75", borderRadius: 8, paddingVertical: 11, paddingHorizontal: 20 },
  dangerButtonText: { color: "#FF5C75", fontWeight: "700", fontSize: 13 },
});
