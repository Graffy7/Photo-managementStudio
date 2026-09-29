import { useMemo, useState } from "react";
import { View, Text, Pressable, FlatList, Modal, StyleSheet, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useInfiniteQuery } from "@tanstack/react-query";
import { publicPhotoSelectionApi } from "../../api/photoSelectionApi";
import { PublicPhotoCard, BIG_COLOR, NORMAL_COLOR } from "./PublicPhotoCard";
import type { GalleryCounts, PublicPhoto, SelectionType } from "../../types/photoSelection";
import { Button } from "../../ui/Button";
import { Skeleton } from "../../ui/Skeleton";
import { colors, radius, space, touch, type } from "../../ui/theme";

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

  const { data, isPending, isError, fetchNextPage, hasNextPage, refetch } = useInfiniteQuery({
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

  const columns = width < 600 ? 2 : width < 900 ? 3 : 4;
  const gap = 10;
  const padding = width < 600 ? space.lg : space.xl;
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
            <View style={styles.doneIcon}><Ionicons name="checkmark" size={40} color={colors.success} /></View>
            <Text style={styles.doneTitle}>Sent to the studio</Text>
            <Text style={styles.doneText}>The studio now has your photo selection.</Text>
            <Text style={styles.doneCounts}>
              {counts.selected} photos · {counts.normal} Normal · {counts.big} Big
            </Text>
            {!locked && (
              <Text style={styles.doneHint}>You can still change it until the studio locks your selection.</Text>
            )}
            <Button label="Back to photos" variant="primary" onPress={close} style={{ minWidth: 220 }} />
          </View>
        ) : (
          <>
            <View style={styles.header}>
              <Pressable onPress={close} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Back to photos" hitSlop={6}>
                <Ionicons name="chevron-back" size={22} color={colors.text} />
              </Pressable>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.title}>Your selection</Text>
                <Text style={styles.summary}>
                  {counts.selected} selected · <Text style={{ color: NORMAL_COLOR }}>{counts.normal} Normal</Text> ·{" "}
                  <Text style={{ color: BIG_COLOR }}>{counts.big} Big</Text>
                </Text>
              </View>
            </View>

            {isPending ? (
              <View style={[styles.grid, { padding, gap }]}>
                {Array.from({ length: columns * 2 }).map((_, i) => (
                  <Skeleton key={i} width={cardWidth} height={Math.round(cardWidth * 0.75) + 56} rounded={radius.card} />
                ))}
              </View>
            ) : isError ? (
              <View style={styles.center}>
                <Text style={styles.errorText}>Couldn't load your selection. Check your internet connection.</Text>
                <Button label="Try again" onPress={() => refetch()} />
              </View>
            ) : photos.length === 0 ? (
              <View style={styles.center}>
                <Ionicons name="images-outline" size={36} color={colors.textFaint} />
                <Text style={styles.emptyTitle}>No photos selected yet</Text>
                <Text style={styles.emptyText}>Open a folder and tap Select on the photos you like.</Text>
                <Button label="Choose photos" onPress={close} />
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
              <View style={styles.footerInner}>
                {locked ? (
                  <Text style={styles.lockedText}>The studio has locked your selection. Contact the studio if you need to change it.</Text>
                ) : (
                  <>
                    {error && <Text style={styles.errorText}>{error}</Text>}
                    {counts.selected > 0 && (
                      <Button label={`Send ${counts.selected} photo${counts.selected === 1 ? "" : "s"} to the studio`} variant="primary" onPress={() => setStep("confirm")} full />
                    )}
                  </>
                )}
              </View>
            </View>

            {step === "confirm" && (
              <View style={styles.dialogOverlay}>
                <View style={styles.dialog}>
                  <Text style={styles.dialogTitle}>Send your selection?</Text>
                  <Text style={styles.dialogText}>
                    {counts.selected} photos: {counts.normal} Normal and {counts.big} Big. The studio will be told right away.
                    You can still change it until the studio locks your selection.
                  </Text>
                  <View style={styles.dialogActions}>
                    <Button label="Keep editing" onPress={() => setStep("review")} disabled={submitting} />
                    <Button label="Yes, send" variant="primary" onPress={submit} loading={submitting} />
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
  screen: { flex: 1, backgroundColor: colors.page },
  header: {
    flexDirection: "row", alignItems: "center", gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.bar,
  },
  backButton: { width: touch, height: touch, alignItems: "center", justifyContent: "center", marginLeft: -10 },
  title: { ...type.heading, color: colors.text },
  summary: { ...type.small, color: colors.textMuted },
  grid: { flexDirection: "row", flexWrap: "wrap", alignSelf: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.sm, padding: space.xl },
  emptyTitle: { ...type.heading, color: colors.text, textAlign: "center" },
  emptyText: { ...type.body, color: colors.textMuted, textAlign: "center", marginBottom: space.sm },
  errorText: { ...type.small, color: colors.danger, textAlign: "center", marginBottom: space.sm },
  lockedText: { ...type.small, color: colors.warning, textAlign: "center", fontWeight: "600" },
  footer: { borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bar, padding: space.lg },
  footerInner: { width: "100%", maxWidth: 480, alignSelf: "center" },
  dialogOverlay: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(5,10,18,0.78)",
    alignItems: "center", justifyContent: "center", padding: space.xl,
  },
  dialog: { backgroundColor: colors.card, borderRadius: 14, padding: space.xl, width: "100%", maxWidth: 420, borderWidth: 1, borderColor: colors.border },
  dialogTitle: { ...type.heading, fontSize: 19, color: colors.text, marginBottom: space.sm },
  dialogText: { ...type.body, color: colors.textMuted },
  dialogActions: { flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", gap: space.sm, marginTop: space.xl },
  doneWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28, gap: space.sm },
  doneIcon: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.successSoft, alignItems: "center", justifyContent: "center", marginBottom: space.sm },
  doneTitle: { ...type.title, color: colors.text, textAlign: "center" },
  doneText: { ...type.body, color: colors.textMuted, textAlign: "center" },
  doneCounts: { ...type.body, color: colors.link, fontWeight: "600" },
  doneHint: { ...type.small, color: colors.textFaint, textAlign: "center", marginBottom: space.lg, maxWidth: 320 },
});
