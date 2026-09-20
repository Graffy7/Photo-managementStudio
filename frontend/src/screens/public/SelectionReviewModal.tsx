import { useMemo, useState } from "react";
import { View, Text, Pressable, FlatList, Modal, ActivityIndicator, StyleSheet, useWindowDimensions } from "react-native";
import { useInfiniteQuery } from "@tanstack/react-query";
import { publicPhotoSelectionApi } from "../../api/photoSelectionApi";
import { PublicPhotoCard, BIG_COLOR, NORMAL_COLOR } from "./PublicPhotoCard";
import type { GalleryCounts, PublicPhoto, SelectionType } from "../../types/photoSelection";

interface Props {
  visible: boolean;
  token: string;
  counts: GalleryCounts;
  locked: boolean;
  effective: (photo: PublicPhoto) => SelectionType | null;
  onChange: (photo: PublicPhoto, next: SelectionType | null) => void;
  onClose: () => void;
  // Saves anything still in flight, then submits. Resolves true when the studio has the selection.
  onSubmit: () => Promise<{ ok: true } | { ok: false; message: string }>;
}

type Step = "review" | "confirm" | "done";

// Everything the customer picked, in one place, before it goes to the studio: change a size or
// drop a photo, then confirm. Nothing is sent until they confirm.
export function SelectionReviewModal({ visible, token, counts, locked, effective, onChange, onClose, onSubmit }: Props) {
  const { width } = useWindowDimensions();
  const [step, setStep] = useState<Step>("review");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, isError, fetchNextPage, hasNextPage, refetch } = useInfiniteQuery({
    queryKey: ["public-photos-review", token],
    queryFn: ({ pageParam }) => publicPhotoSelectionApi.photos(token, { filter: "Selected", page: pageParam, pageSize: 60 }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    enabled: visible,
    gcTime: 0,
    staleTime: 0,
  });

  // The list is fetched once when the review opens; photos the customer unselects here (or that
  // they changed on the grid a moment ago) are filtered by their live state instead of refetching.
  const photos = useMemo(
    () => (data?.pages.flatMap((p) => p.items) ?? []).filter((p) => effective(p) !== null),
    // effective changes identity whenever a selection does
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, effective]
  );

  const columns = width < 560 ? 2 : width < 860 ? 3 : 4;
  const gap = 10;
  const padding = 14;
  const cardWidth = Math.floor((Math.min(width, 1200) - padding * 2 - gap * (columns - 1)) / columns);

  const close = () => {
    setStep("review");
    setError(null);
    onClose();
  };

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    const result = await onSubmit();
    setSubmitting(false);
    if (result.ok) {
      setStep("done");
    } else {
      setError(result.message);
      setStep("review");
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <View style={styles.screen}>
        {step === "done" ? (
          <View style={styles.doneWrap}>
            <View style={styles.doneIcon}><Text style={styles.doneCheck}>✓</Text></View>
            <Text style={styles.doneTitle}>Selection submitted</Text>
            <Text style={styles.doneText}>Your photo selection has been sent to the studio.</Text>
            <Text style={styles.doneCounts}>
              {counts.selected} photos · {counts.normal} Normal · {counts.big} Big
            </Text>
            {!locked && (
              <Text style={styles.doneHint}>You can still make changes until the studio locks your selection.</Text>
            )}
            <Pressable style={styles.primary} onPress={close}>
              <Text style={styles.primaryText}>Back to photos</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.header}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>Review your selection</Text>
                <Text style={styles.summary}>
                  {counts.selected} selected · <Text style={{ color: NORMAL_COLOR }}>{counts.normal} Normal</Text> ·{" "}
                  <Text style={{ color: BIG_COLOR }}>{counts.big} Big</Text>
                </Text>
              </View>
              <Pressable style={styles.secondary} onPress={close}>
                <Text style={styles.secondaryText}>Back</Text>
              </Pressable>
            </View>

            {isLoading ? (
              <ActivityIndicator color="#ff9a4d" style={{ marginTop: 40 }} />
            ) : isError ? (
              <View style={styles.center}>
                <Text style={styles.errorText}>Couldn't load your selection.</Text>
                <Pressable style={styles.secondary} onPress={() => refetch()}><Text style={styles.secondaryText}>Try again</Text></Pressable>
              </View>
            ) : photos.length === 0 ? (
              <View style={styles.center}>
                <Text style={styles.emptyText}>You haven't selected any photos yet.</Text>
              </View>
            ) : (
              <FlatList
                key={columns}
                data={photos}
                numColumns={columns}
                keyExtractor={(p) => String(p.photoId)}
                contentContainerStyle={{ padding, gap, alignSelf: "center", width: Math.min(width, 1200) }}
                columnWrapperStyle={columns > 1 ? { gap } : undefined}
                onEndReached={() => hasNextPage && fetchNextPage()}
                onEndReachedThreshold={0.6}
                renderItem={({ item }) => (
                  <PublicPhotoCard
                    photo={item}
                    selection={effective(item)}
                    width={cardWidth}
                    disabled={locked}
                    onOpen={() => undefined}
                    onChange={onChange}
                  />
                )}
                extraData={effective}
              />
            )}

            <View style={styles.footer}>
              {locked ? (
                <Text style={styles.lockedText}>
                  🔒 Selection Locked. Please contact the studio if you need to make changes.
                </Text>
              ) : (
                <>
                  {error && <Text style={styles.errorText}>{error}</Text>}
                  <Pressable
                    style={[styles.primary, counts.selected === 0 && styles.disabled]}
                    disabled={counts.selected === 0}
                    onPress={() => setStep("confirm")}
                  >
                    <Text style={styles.primaryText}>Submit selection ({counts.selected})</Text>
                  </Pressable>
                </>
              )}
            </View>

            {step === "confirm" && (
              <View style={styles.dialogOverlay}>
                <View style={styles.dialog}>
                  <Text style={styles.dialogTitle}>Submit your selection?</Text>
                  <Text style={styles.dialogText}>
                    You've chosen {counts.selected} photos: {counts.normal} Normal and {counts.big} Big. The studio will be notified.
                    You can still make changes until the studio locks your selection.
                  </Text>
                  <View style={styles.dialogActions}>
                    <Pressable style={styles.secondary} disabled={submitting} onPress={() => setStep("review")}>
                      <Text style={styles.secondaryText}>Keep editing</Text>
                    </Pressable>
                    <Pressable style={[styles.primary, styles.dialogPrimary, submitting && styles.disabled]} disabled={submitting} onPress={submit}>
                      {submitting ? <ActivityIndicator color="#0d1826" /> : <Text style={styles.primaryText}>Yes, submit</Text>}
                    </Pressable>
                  </View>
                </View>
              </View>
            )}
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0d1826" },
  header: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderBottomWidth: 1, borderBottomColor: "#1b2c42" },
  title: { color: "#e8edf3", fontSize: 18, fontWeight: "700" },
  summary: { color: "#a7b7cb", fontSize: 13, marginTop: 2 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  emptyText: { color: "#6f83a0", fontSize: 14, textAlign: "center" },
  errorText: { color: "#ff7a72", fontSize: 13, textAlign: "center", marginBottom: 8 },
  lockedText: { color: "#f2bd5c", fontSize: 13, textAlign: "center", fontWeight: "600" },
  footer: { padding: 14, borderTopWidth: 1, borderTopColor: "#1b2c42", backgroundColor: "#0f1e30", alignItems: "center" },
  primary: { backgroundColor: "#ff9a4d", borderRadius: 10, paddingVertical: 13, paddingHorizontal: 26, alignItems: "center", minWidth: 180 },
  primaryText: { color: "#0d1826", fontWeight: "800", fontSize: 14 },
  secondary: { backgroundColor: "#132540", borderRadius: 10, paddingVertical: 11, paddingHorizontal: 18, borderWidth: 1, borderColor: "#23405c" },
  secondaryText: { color: "#7fc0e6", fontWeight: "700", fontSize: 13 },
  disabled: { opacity: 0.45 },
  dialogOverlay: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(5,10,18,0.78)", alignItems: "center", justifyContent: "center", padding: 20,
  },
  dialog: { backgroundColor: "#132540", borderRadius: 14, padding: 20, width: "100%", maxWidth: 420, borderWidth: 1, borderColor: "#23405c" },
  dialogTitle: { color: "#e8edf3", fontSize: 18, fontWeight: "700", marginBottom: 8 },
  dialogText: { color: "#a7b7cb", fontSize: 14, lineHeight: 20 },
  dialogActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 18 },
  dialogPrimary: { minWidth: 120, paddingVertical: 11 },
  doneWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28, gap: 10 },
  doneIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: "rgba(76,196,147,0.16)", alignItems: "center", justifyContent: "center", marginBottom: 6 },
  doneCheck: { color: "#4cc493", fontSize: 38, fontWeight: "800" },
  doneTitle: { color: "#e8edf3", fontSize: 22, fontWeight: "700" },
  doneText: { color: "#a7b7cb", fontSize: 15, textAlign: "center" },
  doneCounts: { color: "#7fc0e6", fontSize: 14, fontWeight: "600", marginTop: 4 },
  doneHint: { color: "#6f83a0", fontSize: 13, textAlign: "center", marginBottom: 14 },
});
