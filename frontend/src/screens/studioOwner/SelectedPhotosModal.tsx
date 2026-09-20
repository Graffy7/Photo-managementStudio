import { useMemo, useState } from "react";
import {
  View, Text, Pressable, FlatList, Image, Modal, ActivityIndicator, StyleSheet, useWindowDimensions,
} from "react-native";
import { useInfiniteQuery } from "@tanstack/react-query";
import { photoSelectionApi, photoUrl } from "../../api/photoSelectionApi";
import type { OwnerGallery, OwnerPhoto } from "../../types/photoSelection";

const NORMAL_COLOR = "#7fc0e6";
const BIG_COLOR = "#ff9a4d";
const GAP = 12;
const PADDING = 20;
const PAGE_SIZE = 60;

// Only what the customer selected, each photo marked "✓ Selected" with its size, plus the totals.
export function SelectedPhotosModal({ gallery, visible, onClose }: { gallery: OwnerGallery; visible: boolean; onClose: () => void }) {
  const { width } = useWindowDimensions();
  const [preview, setPreview] = useState<OwnerPhoto | null>(null);
  const c = gallery.counts;

  const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    // The counts are in the key: if the customer changes something the list reloads.
    queryKey: ["photo-gallery-selected", gallery.galleryId, c.selected, c.normal, c.big],
    queryFn: ({ pageParam }) => photoSelectionApi.photos(gallery.galleryId, { filter: "Selected", page: pageParam, pageSize: PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    enabled: visible,
  });

  const photos = useMemo(() => data?.pages.flatMap((p) => p.items) ?? [], [data]);

  const contentWidth = Math.min(width, 1200);
  const columns = contentWidth < 520 ? 2 : contentWidth < 820 ? 3 : contentWidth < 1080 ? 4 : 5;
  const cardWidth = Math.floor((contentWidth - PADDING * 2 - GAP * (columns - 1)) / columns);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Selected Photos</Text>
            <Text style={styles.subtitle}>{gallery.customerName}</Text>
          </View>
          <Pressable style={styles.backButton} onPress={onClose}>
            <Text style={styles.backText}>‹ Back</Text>
          </Pressable>
        </View>

        <View style={styles.totals}>
          <Total label="Total Selected" value={c.selected} color="#e8edf3" />
          <Total label="Normal" value={c.normal} color={NORMAL_COLOR} />
          <Total label="Big Size" value={c.big} color={BIG_COLOR} />
        </View>

        {isLoading ? (
          <ActivityIndicator color="#ff9a4d" style={{ marginTop: 40 }} />
        ) : isError ? (
          <View style={styles.center}>
            <Text style={styles.error}>Couldn't load the selected photos.</Text>
            <Pressable style={styles.secondaryButton} onPress={() => refetch()}>
              <Text style={styles.secondaryText}>Try again</Text>
            </Pressable>
          </View>
        ) : photos.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.empty}>The customer hasn't selected any photos yet.</Text>
          </View>
        ) : (
          <FlatList
            key={columns}
            data={photos}
            numColumns={columns}
            keyExtractor={(p) => String(p.photoId)}
            contentContainerStyle={{ padding: PADDING, gap: GAP, width: contentWidth, alignSelf: "center" }}
            columnWrapperStyle={{ gap: GAP }}
            onEndReached={() => hasNextPage && !isFetchingNextPage && fetchNextPage()}
            onEndReachedThreshold={0.6}
            ListFooterComponent={isFetchingNextPage ? <ActivityIndicator color="#ff9a4d" style={{ marginVertical: 16 }} /> : null}
            renderItem={({ item }) => <SelectedCard photo={item} width={cardWidth} onPress={() => setPreview(item)} />}
          />
        )}

        <Modal visible={preview !== null} transparent animationType="fade" onRequestClose={() => setPreview(null)}>
          <Pressable style={styles.previewOverlay} onPress={() => setPreview(null)}>
            {preview && (
              <>
                <Image source={{ uri: photoUrl(preview.previewUrl) }} style={styles.previewImage} resizeMode="contain" />
                <Text style={styles.previewCaption}>
                  {preview.fileName} · ✓ Selected · {preview.selectionType === "Big" ? "Big Size" : "Normal"}
                </Text>
              </>
            )}
          </Pressable>
        </Modal>
      </View>
    </Modal>
  );
}

function Total({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.total}>
      <Text style={[styles.totalValue, { color }]}>{value}</Text>
      <Text style={styles.totalLabel}>{label}</Text>
    </View>
  );
}

function SelectedCard({ photo, width, onPress }: { photo: OwnerPhoto; width: number; onPress: () => void }) {
  const big = photo.selectionType === "Big";
  const accent = big ? BIG_COLOR : NORMAL_COLOR;

  return (
    <Pressable style={[styles.card, { width, borderColor: accent }]} onPress={onPress} accessibilityRole="button" accessibilityLabel={`View ${photo.fileName}`}>
      <View style={[styles.imageBox, { height: Math.round(width * 0.72) }]}>
        {photo.thumbnailUrl ? (
          <Image source={{ uri: photoUrl(photo.thumbnailUrl) }} style={styles.image} resizeMode="contain" />
        ) : (
          <View style={[styles.image, styles.noPreview]}><Text style={styles.noPreviewText}>No preview</Text></View>
        )}
      </View>
      <View style={styles.cardFooter}>
        <Text style={styles.fileName} numberOfLines={1}>{photo.fileName}</Text>
        <Text style={[styles.selectedLabel, { color: "#4cc493" }]}>✓ Selected</Text>
        <View style={[styles.sizeBadge, { backgroundColor: accent }]}>
          <Text style={styles.sizeText}>{big ? "Big Size" : "Normal"}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0d1826" },
  header: { flexDirection: "row", alignItems: "center", gap: 12, padding: PADDING, paddingBottom: 12 },
  title: { color: "#e8edf3", fontSize: 22, fontWeight: "700" },
  subtitle: { color: "#6f83a0", fontSize: 13, marginTop: 2 },
  backButton: { backgroundColor: "#132540", borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16, borderWidth: 1, borderColor: "#23405c" },
  backText: { color: "#7fc0e6", fontWeight: "600", fontSize: 13 },
  totals: {
    flexDirection: "row", flexWrap: "wrap", gap: 28, paddingHorizontal: PADDING, paddingVertical: 12,
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#1b2c42", backgroundColor: "#0f1e30",
  },
  total: { gap: 1 },
  totalValue: { fontSize: 26, fontWeight: "800" },
  totalLabel: { color: "#6f83a0", fontSize: 12 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  empty: { color: "#6f83a0", fontSize: 14, textAlign: "center" },
  error: { color: "#ff7a72", fontSize: 13, textAlign: "center" },
  secondaryButton: { backgroundColor: "#132540", borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16, borderWidth: 1, borderColor: "#23405c" },
  secondaryText: { color: "#7fc0e6", fontWeight: "600", fontSize: 13 },

  card: { backgroundColor: "#132540", borderRadius: 10, borderWidth: 2, overflow: "hidden" },
  imageBox: { backgroundColor: "#0a1320", width: "100%" },
  image: { width: "100%", height: "100%" },
  noPreview: { alignItems: "center", justifyContent: "center" },
  noPreviewText: { color: "#6f83a0", fontSize: 12 },
  cardFooter: { padding: 10, gap: 5, borderTopWidth: 1, borderTopColor: "#1b2c42" },
  fileName: { color: "#a7b7cb", fontSize: 11 },
  selectedLabel: { fontSize: 14, fontWeight: "800" },
  sizeBadge: { alignSelf: "flex-start", borderRadius: 6, paddingHorizontal: 10, paddingVertical: 3 },
  sizeText: { color: "#0d1826", fontSize: 12, fontWeight: "800" },

  previewOverlay: { flex: 1, backgroundColor: "#050a12", alignItems: "center", justifyContent: "center", padding: 20 },
  previewImage: { width: "100%", height: "85%" },
  previewCaption: { color: "#a7b7cb", fontSize: 13, marginTop: 10 },
});
