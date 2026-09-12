import { View, Image, ActivityIndicator, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { photoSelectionApi } from "../api/photoSelectionApi";
import { arrayBufferToBase64 } from "../utils/downloadPdf";

// <Image> can't attach the Authorization header a direct URL to browse-file-preview would need,
// so this fetches the bytes through the authenticated apiClient and hands them to <Image> as a
// data URI instead (same workaround used for PDF downloads elsewhere in the app).
export function LocalFileThumbnail({ path }: { path: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["photo-selection-browse-file-preview", path],
    queryFn: () => photoSelectionApi.getBrowseFilePreview(path),
    staleTime: Infinity,
  });

  if (isLoading) {
    return (
      <View style={[styles.box, styles.center]}>
        <ActivityIndicator color="#7fc0e6" size="small" />
      </View>
    );
  }

  if (isError || !data) {
    return <View style={[styles.box, styles.center]} />;
  }

  return (
    <Image
      source={{ uri: `data:image/jpeg;base64,${arrayBufferToBase64(data)}` }}
      style={styles.box}
      resizeMode="cover"
    />
  );
}

const styles = StyleSheet.create({
  box: { width: "100%", aspectRatio: 1, borderRadius: 8, backgroundColor: "#0d1826" },
  center: { alignItems: "center", justifyContent: "center" },
});
