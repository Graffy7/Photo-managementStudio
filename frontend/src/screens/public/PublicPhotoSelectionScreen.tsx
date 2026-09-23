import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View, Text, TextInput, Pressable, FlatList, ScrollView, ActivityIndicator, StyleSheet, useWindowDimensions,
} from "react-native";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { publicPhotoSelectionApi, toPublicError } from "../../api/photoSelectionApi";
import type { PhotoFilter, PublicGallery } from "../../types/photoSelection";
import { PublicPhotoCard, BIG_COLOR, NORMAL_COLOR } from "./PublicPhotoCard";
import { PhotoLightbox } from "./PhotoLightbox";
import { SelectionReviewModal } from "./SelectionReviewModal";
import { useSelectionSaver } from "./useSelectionSaver";

const PAGE_SIZE = 48;
const GAP = 10;
const PADDING = 12;
const MAX_CONTENT_WIDTH = 1400;

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
}

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

// The page a customer opens from the studio's link. No login: the private token in the address is
// the access. Loads the gallery, then hands over to <Gallery> once the counters are known.
export function PublicPhotoSelectionScreen({ token }: { token: string }) {
  const { data: gallery, isPending, error, refetch } = useQuery({
    queryKey: ["public-gallery", token],
    queryFn: () => publicPhotoSelectionApi.get(token),
    retry: (count, err) => toPublicError(err).kind === "offline" && count < 2,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });

  if (isPending) {
    return (
      <View style={styles.centerScreen}>
        <ActivityIndicator color="#ff9a4d" size="large" />
      </View>
    );
  }

  if (error || !gallery) {
    const failure = toPublicError(error);
    return <StateScreen kind={failure.kind} message={failure.message} onRetry={failure.kind === "offline" ? () => refetch() : undefined} />;
  }

  return <Gallery token={token} gallery={gallery} />;
}

function StateScreen({ kind, message, onRetry }: { kind: string; message: string; onRetry?: () => void }) {
  const title =
    kind === "expired" ? "This link has expired"
    : kind === "invalid" ? "This link isn't valid"
    : kind === "offline" ? "You appear to be offline"
    : "Something went wrong";
  const icon = kind === "expired" ? "⏳" : kind === "offline" ? "📡" : "🔗";

  return (
    <View style={styles.centerScreen}>
      <View style={styles.stateCard}>
        <Text style={styles.stateIcon}>{icon}</Text>
        <Text style={styles.stateTitle}>{title}</Text>
        <Text style={styles.stateText}>{message}</Text>
        {onRetry && (
          <Pressable style={styles.primaryButton} onPress={onRetry}>
            <Text style={styles.primaryButtonText}>Try again</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function Gallery({ token, gallery }: { token: string; gallery: PublicGallery }) {
  const { width } = useWindowDimensions();

  const [filter, setFilter] = useState<PhotoFilter>("All");
  const [searchText, setSearchText] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const search = useDebounced(searchText.trim(), 300);

  const [locked, setLocked] = useState(gallery.isLocked);
  const [lost, setLost] = useState<"invalid" | "expired" | null>(null);
  const [submitted, setSubmitted] = useState(gallery.isSubmitted);
  const [submittedAt, setSubmittedAt] = useState(gallery.submittedAt);
  const [changedSinceSubmit, setChangedSinceSubmit] = useState(gallery.changedSinceSubmit);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  // Only offer Back when there is somewhere to go back to (a link opened in a fresh tab has no history).
  const [canGoBack] = useState(() => typeof window !== "undefined" && window.history.length > 1);

  // A saved change after the customer has already submitted means the studio's copy is out of date.
  const submittedRef = useRef(submitted);
  submittedRef.current = submitted;

  const saver = useSelectionSaver(token, gallery.counts, {
    onLocked: () => setLocked(true),
    onAccessLost: setLost,
    onSaved: () => {
      if (submittedRef.current) setChangedSinceSubmit(true);
    },
  });
  const { counts, effective, setSelection, error, dismissError } = saver;

  const { data, isPending, isFetchingNextPage, isError, fetchNextPage, hasNextPage, refetch } = useInfiniteQuery({
    queryKey: ["public-photos", token, filter, search],
    queryFn: ({ pageParam }) => publicPhotoSelectionApi.photos(token, { filter, search: search || undefined, page: pageParam, pageSize: PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    refetchOnWindowFocus: false,
    gcTime: 0,
    staleTime: 0,
  });

  const photos = useMemo(() => data?.pages.flatMap((p) => p.items) ?? [], [data]);
  const totalMatching = data?.pages[0]?.totalCount ?? 0;

  // Responsive grid: 2 columns on phones, 3 on tablets, 4–5 on desktop.
  const columns = width < 560 ? 2 : width < 860 ? 3 : width < 1180 ? 4 : 5;
  const contentWidth = Math.min(width, MAX_CONTENT_WIDTH);
  const cardWidth = Math.floor((contentWidth - PADDING * 2 - GAP * (columns - 1)) / columns);

  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleSubmit = async (): Promise<{ ok: true } | { ok: false; message: string }> => {
    try {
      await saver.flush();
      const result = await publicPhotoSelectionApi.submit(token);
      setSubmitted(true);
      setSubmittedAt(result.submittedAt);
      setChangedSinceSubmit(false);
      saver.setCounts(result.counts);
      return { ok: true };
    } catch (err) {
      const failure = toPublicError(err);
      if (failure.kind === "locked") setLocked(true);
      if (failure.kind === "invalid" || failure.kind === "expired") setLost(failure.kind);
      return { ok: false, message: failure.kind === "offline" ? "Unable to submit. Please check your internet connection." : failure.message };
    }
  };

  if (lost) {
    return <StateScreen kind={lost} message={lost === "expired"
      ? "This photo selection link has expired. Please contact the studio."
      : "This link is not valid. Please contact the studio for a new link."} />;
  }

  const filters: { key: PhotoFilter; label: string; count: number }[] = [
    { key: "All", label: "All", count: counts.total },
    { key: "Selected", label: "Selected", count: counts.selected },
    { key: "NotSelected", label: "Not selected", count: counts.notSelected },
    { key: "Normal", label: "Normal", count: counts.normal },
    { key: "Big", label: "Big", count: counts.big },
  ];

  const submitLabel = submitted && !changedSinceSubmit ? "Submitted ✓" : submitted ? "Submit changes" : "Submit";

  return (
    <View style={styles.screen}>
      {/* Header + summary + filters stay pinned; only the photo grid scrolls under them. */}
      <View style={styles.sticky}>
        <View style={[styles.inner, { maxWidth: MAX_CONTENT_WIDTH }]}>
          <View style={styles.headerRow}>
            {canGoBack && (
              <Pressable style={styles.backButton} onPress={() => window.history.back()} accessibilityRole="button" accessibilityLabel="Go back">
                <Text style={styles.backText}>‹ Back</Text>
              </Pressable>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.studio} numberOfLines={1}>{gallery.studioName}</Text>
              <Text style={styles.headline} numberOfLines={1}>
                {gallery.customerName} · {gallery.title} · {formatDate(gallery.eventDate)}
              </Text>
            </View>
            <Text style={styles.photoCount}>{counts.total} photos</Text>
          </View>

          <View style={styles.summaryBar}>
            <View style={styles.counters}>
              <Counter label="Selected" value={counts.selected} color="#e8edf3" />
              <Counter label="Normal" value={counts.normal} color={NORMAL_COLOR} />
              <Counter label="Big" value={counts.big} color={BIG_COLOR} />
            </View>
            <View style={styles.summaryActions}>
              <Pressable style={styles.secondaryButton} onPress={() => setReviewOpen(true)}>
                <Text style={styles.secondaryButtonText}>Review</Text>
              </Pressable>
              <Pressable
                style={[styles.primaryButton, styles.submitButton, (counts.selected === 0 || locked || (submitted && !changedSinceSubmit)) && styles.disabled]}
                disabled={counts.selected === 0 || locked || (submitted && !changedSinceSubmit)}
                onPress={() => setReviewOpen(true)}
              >
                <Text style={styles.primaryButtonText}>{submitLabel}</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.filterRow}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {filters.map((f) => (
                <Pressable key={f.key} style={[styles.chip, filter === f.key && styles.chipSelected]} onPress={() => setFilter(f.key)}>
                  <Text style={[styles.chipText, filter === f.key && styles.chipTextSelected]}>{f.label} ({f.count})</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable style={styles.searchToggle} onPress={() => setSearchOpen((o) => !o)} accessibilityLabel="Search photos">
              <Text style={styles.searchToggleText}>{searchOpen ? "✕" : "🔍"}</Text>
            </Pressable>
          </View>

          {searchOpen && (
            <TextInput
              style={styles.search}
              value={searchText}
              onChangeText={setSearchText}
              placeholder="Search by file name or photo number"
              placeholderTextColor="#6f83a0"
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
            />
          )}
        </View>
      </View>

      <View style={[styles.inner, { maxWidth: MAX_CONTENT_WIDTH, flex: 1 }]}>
        {locked && (
          <View style={[styles.banner, styles.bannerWarn]}>
            <Text style={styles.bannerTitleWarn}>🔒 Selection Locked</Text>
            <Text style={styles.bannerTextWarn}>Your studio has locked this selection. Please contact the studio if you need to make changes.</Text>
          </View>
        )}
        {!locked && submitted && (
          <View style={[styles.banner, styles.bannerGood]}>
            <Text style={styles.bannerTextGood}>
              {changedSinceSubmit
                ? "You've made changes since you submitted. Tap “Submit changes” to send the update to the studio."
                : `✓ Your selection was sent to the studio${submittedAt ? ` on ${formatDate(submittedAt)}` : ""}. You can still make changes until the studio locks it.`}
            </Text>
          </View>
        )}
        {error && (
          <View style={[styles.banner, styles.bannerBad]}>
            <Text style={styles.bannerTextBad}>{error.message}</Text>
            <View style={styles.bannerActions}>
              {error.retry && (
                <Pressable onPress={error.retry}><Text style={styles.bannerLink}>Retry</Text></Pressable>
              )}
              <Pressable onPress={dismissError}><Text style={styles.bannerLinkMuted}>Dismiss</Text></Pressable>
            </View>
          </View>
        )}

        {isPending ? (
          <ActivityIndicator color="#ff9a4d" style={{ marginTop: 40 }} />
        ) : isError ? (
          <View style={styles.center}>
            <Text style={styles.errorText}>Couldn't load the photos. Please check your internet connection.</Text>
            <Pressable style={styles.secondaryButton} onPress={() => refetch()}>
              <Text style={styles.secondaryButtonText}>Try again</Text>
            </Pressable>
          </View>
        ) : photos.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyText}>
              {search ? "No photos match your search." : filter === "All" ? "No photos here yet." : "Nothing in this view."}
            </Text>
          </View>
        ) : (
          <FlatList
            key={columns}
            data={photos}
            numColumns={columns}
            keyExtractor={(p) => String(p.photoId)}
            contentContainerStyle={{ padding: PADDING, gap: GAP }}
            columnWrapperStyle={{ gap: GAP }}
            onEndReached={loadMore}
            onEndReachedThreshold={0.8}
            initialNumToRender={columns * 4}
            windowSize={7}
            maxToRenderPerBatch={columns * 3}
            removeClippedSubviews
            extraData={effective}
            ListFooterComponent={
              isFetchingNextPage ? <ActivityIndicator color="#ff9a4d" style={{ marginVertical: 16 }} /> : hasNextPage ? null : (
                <Text style={styles.endText}>{totalMatching} photo{totalMatching === 1 ? "" : "s"}</Text>
              )
            }
            renderItem={({ item, index }) => (
              <PublicPhotoCard
                photo={item}
                selection={effective(item)}
                width={cardWidth}
                disabled={locked}
                onOpen={() => setLightboxIndex(index)}
                onChange={setSelection}
              />
            )}
          />
        )}
      </View>

      <PhotoLightbox
        photos={photos}
        index={lightboxIndex}
        total={totalMatching}
        hasMore={!!hasNextPage}
        disabled={locked}
        effective={effective}
        onIndexChange={setLightboxIndex}
        onLoadMore={loadMore}
        onChange={setSelection}
        onClose={() => setLightboxIndex(null)}
      />

      <SelectionReviewModal
        visible={reviewOpen}
        token={token}
        counts={counts}
        locked={locked}
        effective={effective}
        onChange={setSelection}
        onClose={() => setReviewOpen(false)}
        onSubmit={handleSubmit}
      />
    </View>
  );
}

function Counter({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.counter}>
      <Text style={[styles.counterValue, { color }]}>{value}</Text>
      <Text style={styles.counterLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0d1826" },
  centerScreen: { flex: 1, backgroundColor: "#0d1826", alignItems: "center", justifyContent: "center", padding: 24 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  stateCard: {
    backgroundColor: "#132540", borderRadius: 16, padding: 28, maxWidth: 420, width: "100%",
    alignItems: "center", gap: 10, borderWidth: 1, borderColor: "#23405c",
  },
  stateIcon: { fontSize: 38 },
  stateTitle: { color: "#e8edf3", fontSize: 20, fontWeight: "700", textAlign: "center" },
  stateText: { color: "#a7b7cb", fontSize: 14, textAlign: "center", lineHeight: 20 },

  sticky: { backgroundColor: "#0f1e30", borderBottomWidth: 1, borderBottomColor: "#1b2c42", zIndex: 5 },
  inner: { width: "100%", alignSelf: "center" },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: PADDING, paddingTop: 10 },
  backButton: { backgroundColor: "#132540", borderRadius: 9, paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: "#23405c" },
  backText: { color: "#7fc0e6", fontWeight: "700", fontSize: 13 },
  studio: { color: "#7fc0e6", fontSize: 11, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase" },
  headline: { color: "#e8edf3", fontSize: 15, fontWeight: "700", marginTop: 1 },
  photoCount: { color: "#6f83a0", fontSize: 12 },

  summaryBar: {
    flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between",
    gap: 8, paddingHorizontal: PADDING, paddingVertical: 8,
  },
  counters: { flexDirection: "row", gap: 16 },
  counter: { alignItems: "flex-start" },
  counterValue: { fontSize: 20, fontWeight: "800", lineHeight: 22 },
  counterLabel: { color: "#6f83a0", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5 },
  summaryActions: { flexDirection: "row", gap: 8 },
  primaryButton: { backgroundColor: "#ff9a4d", borderRadius: 9, paddingVertical: 10, paddingHorizontal: 18, alignItems: "center" },
  submitButton: { minWidth: 96 },
  primaryButtonText: { color: "#0d1826", fontWeight: "800", fontSize: 13 },
  secondaryButton: { backgroundColor: "#132540", borderRadius: 9, paddingVertical: 10, paddingHorizontal: 16, borderWidth: 1, borderColor: "#23405c" },
  secondaryButtonText: { color: "#7fc0e6", fontWeight: "700", fontSize: 13 },
  disabled: { opacity: 0.45 },

  filterRow: { flexDirection: "row", alignItems: "center", paddingLeft: PADDING, paddingBottom: 10 },
  chips: { gap: 8, paddingRight: 8 },
  chip: { borderWidth: 1, borderColor: "#23405c", borderRadius: 100, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: "#132540" },
  chipSelected: { borderColor: "#ff9a4d", backgroundColor: "rgba(255,154,77,0.14)" },
  chipText: { color: "#a7b7cb", fontSize: 12, fontWeight: "600" },
  chipTextSelected: { color: "#ff9a4d" },
  searchToggle: { width: 38, height: 32, alignItems: "center", justifyContent: "center", marginRight: PADDING - 4 },
  searchToggleText: { color: "#a7b7cb", fontSize: 15 },
  search: {
    borderWidth: 1, borderColor: "#23405c", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9,
    color: "#e8edf3", backgroundColor: "#132540", marginHorizontal: PADDING, marginBottom: 10, fontSize: 14,
  },

  banner: { marginHorizontal: PADDING, marginTop: 10, borderRadius: 10, padding: 12, gap: 6, borderWidth: 1 },
  bannerWarn: { backgroundColor: "rgba(242,189,92,0.12)", borderColor: "rgba(242,189,92,0.4)" },
  bannerTitleWarn: { color: "#f2bd5c", fontWeight: "800", fontSize: 14 },
  bannerTextWarn: { color: "#f2d9a0", fontSize: 13 },
  bannerGood: { backgroundColor: "rgba(76,196,147,0.10)", borderColor: "rgba(76,196,147,0.35)" },
  bannerTextGood: { color: "#8fdcbc", fontSize: 13 },
  bannerBad: { backgroundColor: "rgba(255,122,114,0.12)", borderColor: "rgba(255,122,114,0.4)" },
  bannerTextBad: { color: "#ffb0aa", fontSize: 13 },
  bannerActions: { flexDirection: "row", gap: 18 },
  bannerLink: { color: "#ff9a4d", fontWeight: "800", fontSize: 13 },
  bannerLinkMuted: { color: "#a7b7cb", fontWeight: "600", fontSize: 13 },

  errorText: { color: "#ff7a72", fontSize: 13, textAlign: "center" },
  emptyText: { color: "#6f83a0", fontSize: 14, textAlign: "center" },
  endText: { color: "#4a5d78", fontSize: 12, textAlign: "center", marginVertical: 14 },
});
