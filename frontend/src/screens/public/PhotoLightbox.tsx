import { useEffect, useState } from "react";
import { View, Text, Pressable, Image, ScrollView, Modal, StyleSheet, Platform, useWindowDimensions } from "react-native";
import { photoUrl } from "../../api/photoSelectionApi";
import { BIG_COLOR, NORMAL_COLOR, colorFor } from "./PublicPhotoCard";
import type { PublicPhoto, SelectionType } from "../../types/photoSelection";

interface Props {
  photos: PublicPhoto[];
  index: number | null;
  total: number;
  hasMore: boolean;
  disabled: boolean;
  effective: (photo: PublicPhoto) => SelectionType | null;
  onIndexChange: (index: number) => void;
  onLoadMore: () => void;
  onChange: (photo: PublicPhoto, next: SelectionType | null) => void;
  onClose: () => void;
}

const MAX_ZOOM = 3;

// Full-screen view of one photo: the large preview (never the original), previous/next, zoom, and
// the same Select / Normal / Big controls as the grid — so the customer can decide while looking.
export function PhotoLightbox({ photos, index, total, hasMore, disabled, effective, onIndexChange, onLoadMore, onChange, onClose }: Props) {
  const { width, height } = useWindowDimensions();
  const [zoom, setZoom] = useState(1);

  const photo = index === null ? null : photos[index] ?? null;
  const canPrev = index !== null && index > 0;
  const canNext = index !== null && (index < photos.length - 1 || hasMore);

  const go = (delta: number) => {
    if (index === null) return;
    const next = index + delta;
    if (next < 0) return;
    if (next >= photos.length) {
      onLoadMore();
      return;
    }
    setZoom(1);
    onIndexChange(next);
  };

  // Start each photo un-zoomed; pull the next page when the customer nears the end of what's loaded.
  useEffect(() => {
    setZoom(1);
  }, [photo?.photoId]);
  useEffect(() => {
    if (index !== null && hasMore && index >= photos.length - 3) onLoadMore();
  }, [index, photos.length, hasMore, onLoadMore]);

  // Warm the cache for the neighbours so next/previous feels instant.
  useEffect(() => {
    if (index === null) return;
    [photos[index + 1], photos[index - 1]].forEach((p) => {
      const uri = photoUrl(p?.previewUrl);
      if (uri) Image.prefetch(uri).catch(() => undefined);
    });
  }, [index, photos]);

  // Keyboard: ← → to move, Esc to close, + / - to zoom (web only).
  useEffect(() => {
    if (Platform.OS !== "web" || photo === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "Escape") onClose();
      else if (e.key === "+" || e.key === "=") setZoom((z) => Math.min(MAX_ZOOM, z + 1));
      else if (e.key === "-") setZoom((z) => Math.max(1, z - 1));
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photo?.photoId, index, photos.length, hasMore]);

  if (photo === null) return null;

  const selection = effective(photo);
  const stageHeight = height - 150;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.topBar}>
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>{photo.fileName}</Text>
            <Text style={styles.counter}>{(index ?? 0) + 1} of {total}</Text>
          </View>
          <View style={styles.zoomGroup}>
            <Pressable style={styles.iconButton} onPress={() => setZoom((z) => Math.max(1, z - 1))} accessibilityLabel="Zoom out">
              <Text style={styles.iconText}>−</Text>
            </Pressable>
            <Text style={styles.zoomLabel}>{zoom}×</Text>
            <Pressable style={styles.iconButton} onPress={() => setZoom((z) => Math.min(MAX_ZOOM, z + 1))} accessibilityLabel="Zoom in">
              <Text style={styles.iconText}>+</Text>
            </Pressable>
          </View>
          <Pressable style={styles.closeButton} onPress={onClose} accessibilityLabel="Close">
            <Text style={styles.iconText}>✕</Text>
          </Pressable>
        </View>

        <View style={[styles.stage, { height: stageHeight }]}>
          <ScrollView
            horizontal
            style={{ width, height: stageHeight }}
            contentContainerStyle={{ width: width * zoom, height: stageHeight * zoom }}
            showsHorizontalScrollIndicator={zoom > 1}
            scrollEnabled={zoom > 1}
          >
            <ScrollView
              style={{ width: width * zoom }}
              contentContainerStyle={{ width: width * zoom, height: stageHeight * zoom }}
              showsVerticalScrollIndicator={zoom > 1}
              scrollEnabled={zoom > 1}
            >
              <Pressable onPress={() => setZoom((z) => (z >= MAX_ZOOM ? 1 : z + 1))} style={{ width: width * zoom, height: stageHeight * zoom }}>
                <Image
                  source={{ uri: photoUrl(photo.previewUrl) }}
                  style={{ width: "100%", height: "100%" }}
                  resizeMode="contain"
                  accessibilityLabel={photo.fileName}
                />
              </Pressable>
            </ScrollView>
          </ScrollView>

          {canPrev && (
            <Pressable style={[styles.arrow, { left: 8 }]} onPress={() => go(-1)} accessibilityLabel="Previous photo">
              <Text style={styles.arrowText}>‹</Text>
            </Pressable>
          )}
          {canNext && (
            <Pressable style={[styles.arrow, { right: 8 }]} onPress={() => go(1)} accessibilityLabel="Next photo">
              <Text style={styles.arrowText}>›</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.bottomBar}>
          {selection === null ? (
            <Pressable
              style={[styles.primary, disabled && styles.disabled]}
              disabled={disabled}
              onPress={() => onChange(photo, 1)}
            >
              <Text style={styles.primaryText}>Select this photo</Text>
            </Pressable>
          ) : (
            <>
              <Pressable
                style={[styles.selectedButton, { backgroundColor: colorFor(selection) }, disabled && styles.disabled]}
                disabled={disabled}
                onPress={() => onChange(photo, null)}
              >
                <Text style={styles.selectedText}>✓ Selected · tap to remove</Text>
              </Pressable>
              <View style={styles.radioRow}>
                {([1, 2] as SelectionType[]).map((type) => {
                  const active = selection === type;
                  const color = type === 1 ? NORMAL_COLOR : BIG_COLOR;
                  return (
                    <Pressable
                      key={type}
                      style={[styles.radio, active && { borderColor: color, backgroundColor: "rgba(255,255,255,0.08)" }, disabled && styles.disabled]}
                      disabled={disabled}
                      onPress={() => onChange(photo, type)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active }}
                    >
                      <View style={[styles.dot, active && { borderColor: color }]}>
                        {active && <View style={[styles.dotFill, { backgroundColor: color }]} />}
                      </View>
                      <Text style={[styles.radioText, active && { color: "#ffffff" }]}>{type === 1 ? "Normal" : "Big"}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "#050a12" },
  topBar: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8, height: 64 },
  name: { color: "#e8edf3", fontSize: 14, fontWeight: "700" },
  counter: { color: "#6f83a0", fontSize: 12, marginTop: 1 },
  zoomGroup: { flexDirection: "row", alignItems: "center", gap: 4 },
  zoomLabel: { color: "#a7b7cb", fontSize: 12, width: 24, textAlign: "center" },
  iconButton: { width: 34, height: 34, borderRadius: 8, backgroundColor: "#132540", alignItems: "center", justifyContent: "center" },
  closeButton: { width: 34, height: 34, borderRadius: 8, backgroundColor: "#23405c", alignItems: "center", justifyContent: "center" },
  iconText: { color: "#e8edf3", fontSize: 16, fontWeight: "700" },
  stage: { width: "100%", overflow: "hidden" },
  arrow: {
    position: "absolute", top: "50%", marginTop: -24, width: 44, height: 48, borderRadius: 10,
    backgroundColor: "rgba(19,37,64,0.85)", alignItems: "center", justifyContent: "center",
  },
  arrowText: { color: "#e8edf3", fontSize: 30, lineHeight: 34, fontWeight: "300" },
  bottomBar: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 10, padding: 12, minHeight: 86 },
  primary: { backgroundColor: NORMAL_COLOR, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 26 },
  primaryText: { color: "#0d1826", fontWeight: "800", fontSize: 14 },
  selectedButton: { borderRadius: 10, paddingVertical: 12, paddingHorizontal: 18 },
  selectedText: { color: "#0d1826", fontWeight: "800", fontSize: 13 },
  radioRow: { flexDirection: "row", gap: 8 },
  radio: {
    flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: "#23405c",
    borderRadius: 10, paddingVertical: 11, paddingHorizontal: 18,
  },
  radioText: { color: "#a7b7cb", fontSize: 13, fontWeight: "700" },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: "#6f83a0", alignItems: "center", justifyContent: "center" },
  dotFill: { width: 8, height: 8, borderRadius: 4 },
  disabled: { opacity: 0.45 },
});
