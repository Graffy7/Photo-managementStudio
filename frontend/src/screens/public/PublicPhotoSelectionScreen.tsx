import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View, Text, TextInput, Pressable, FlatList, ScrollView, ActivityIndicator, StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { publicPhotoSelectionApi, toPublicError } from "../../api/photoSelectionApi";
import type { GalleryCounts, PhotoFilter, PhotoFolder, PublicGallery } from "../../types/photoSelection";
import { PublicPhotoCard } from "./PublicPhotoCard";
import { PhotoLightbox } from "./PhotoLightbox";
import { SelectionReviewModal } from "./SelectionReviewModal";
import { useSelectionSaver } from "./useSelectionSaver";
import { Button } from "../../ui/Button";
import { Skeleton } from "../../ui/Skeleton";
import { useBreakpoint } from "../../ui/useBreakpoint";
import { colors, radius, space, touch, type } from "../../ui/theme";

const PAGE_SIZE = 48;
const GAP = 10;
const MAX_CONTENT_WIDTH = 1200;
const BOTTOM_BAR_HEIGHT = 76;

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
    return <GallerySkeleton />;
  }

  if (error || !gallery) {
    const failure = toPublicError(error);
    return <StateScreen kind={failure.kind} message={failure.message} onRetry={failure.kind === "offline" ? () => refetch() : undefined} />;
  }

  return <Gallery token={token} gallery={gallery} />;
}

// Same shape as the real page (header, steps, folder rows, bottom bar), so nothing jumps when it loads.
function GallerySkeleton() {
  return (
    <View style={styles.screen}>
      <View style={[styles.inner, styles.pagePad]}>
        <Skeleton width={120} height={14} />
        <Skeleton width="70%" height={28} style={{ marginTop: 10 }} />
        <Skeleton width="45%" height={16} style={{ marginTop: 8 }} />
        <Skeleton height={64} rounded={radius.card} style={{ marginTop: space.xl }} />
        {[0, 1, 2].map((i) => <Skeleton key={i} height={72} rounded={radius.card} style={{ marginTop: space.md }} />)}
      </View>
    </View>
  );
}

function StateScreen({ kind, message, onRetry }: { kind: string; message: string; onRetry?: () => void }) {
  const title =
    kind === "expired" ? "This link has expired"
    : kind === "invalid" ? "This link isn't valid"
    : kind === "offline" ? "You're offline"
    : "Something went wrong";
  const icon: keyof typeof Ionicons.glyphMap = kind === "expired" ? "time-outline" : kind === "offline" ? "cloud-offline-outline" : "link-outline";

  return (
    <View style={styles.centerScreen}>
      <View style={styles.stateCard}>
        <Ionicons name={icon} size={40} color={colors.textMuted} />
        <Text style={styles.stateTitle}>{title}</Text>
        <Text style={styles.stateText}>{message}</Text>
        {onRetry && <Button label="Try again" variant="primary" onPress={onRetry} full />}
      </View>
    </View>
  );
}

function Gallery({ token, gallery }: { token: string; gallery: PublicGallery }) {
  const { width, isPhone } = useBreakpoint();

  const [filter, setFilter] = useState<PhotoFilter>("All");
  // The customer picks a folder first; null means they are still on the folder screen.
  const [folder, setFolder] = useState<PhotoFolder | null>(null);
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

  const { data: folders = [], isPending: foldersPending } = useQuery({
    queryKey: ["public-folders", token, counts.selected],
    queryFn: () => publicPhotoSelectionApi.folders(token),
    refetchOnWindowFocus: false,
    placeholderData: (previous) => previous,
  });

  const { data, isPending, isFetchingNextPage, isError, fetchNextPage, hasNextPage, refetch } = useInfiniteQuery({
    queryKey: ["public-photos", token, filter, search, folder?.folderId ?? null],
    queryFn: ({ pageParam }) => publicPhotoSelectionApi.photos(token, { filter, search: search || undefined, page: pageParam, pageSize: PAGE_SIZE, folderId: folder?.folderId }),
    enabled: folder !== null,
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    refetchOnWindowFocus: false,
    gcTime: 0,
    staleTime: 0,
  });

  const photos = useMemo(() => data?.pages.flatMap((p) => p.items) ?? [], [data]);
  const totalMatching = data?.pages[0]?.totalCount ?? 0;

  // Photo grid: 2 columns on phones, 3 on tablets, 4-5 on desktop.
  const pad = isPhone ? space.lg : space.xl;
  const columns = width < 600 ? 2 : width < 900 ? 3 : width < 1180 ? 4 : 5;
  const contentWidth = Math.min(width, MAX_CONTENT_WIDTH);
  const cardWidth = Math.floor((contentWidth - pad * 2 - GAP * (columns - 1)) / columns);
  // Folders: one full-width row each on phones, then equal-width columns (2 on tablets, 3 on desktop).
  const folderColumns = isPhone ? 1 : width < 1024 ? 2 : 3;
  const folderWidth = Math.floor((contentWidth - pad * 2 - space.md * (folderColumns - 1)) / folderColumns);

  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const openFolder = (f: PhotoFolder) => {
    setFolder(f);
    setFilter("All");
    setSearchText("");
    setSearchOpen(false);
  };

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
      return { ok: false, message: failure.kind === "offline" ? "Couldn't send. Check your internet connection and try again." : failure.message };
    }
  };

  if (lost) {
    return <StateScreen kind={lost} message={lost === "expired"
      ? "This photo selection link has expired. Please contact the studio."
      : "This link is not valid. Please contact the studio for a new link."} />;
  }

  const filters: { key: PhotoFilter; label: string }[] = [
    { key: "All", label: "All" },
    { key: "Selected", label: "Selected" },
    { key: "NotSelected", label: "Not selected" },
    { key: "Normal", label: "Normal" },
    { key: "Big", label: "Big" },
  ];

  const banners = (
    <>
      {locked && (
        <Banner tone="warning" icon="lock-closed-outline" title="Selection locked"
          text="The studio has locked your selection. Contact the studio if you need to change anything." />
      )}
      {!locked && submitted && folder === null && (
        <Banner
          tone={changedSinceSubmit ? "warning" : "success"}
          icon={changedSinceSubmit ? "create-outline" : "checkmark-circle-outline"}
          text={changedSinceSubmit
            ? "You've changed your selection since sending it. Tap “Review and send update” below."
            : `Sent to the studio${submittedAt ? ` on ${formatDate(submittedAt)}` : ""}. You can still change it until the studio locks it.`}
        />
      )}
      {error && (
        <View style={[styles.banner, styles.bannerDanger]}>
          <Text style={[styles.bannerText, { color: colors.danger }]}>{error.message}</Text>
          <View style={styles.bannerActions}>
            {error.retry && <Button label="Retry" variant="link" onPress={error.retry} />}
            <Button label="Dismiss" variant="link" onPress={dismissError} />
          </View>
        </View>
      )}
    </>
  );

  return (
    <View style={styles.screen}>
      {folder === null ? (
        // ---- Home: event, how it works, folders -------------------------------------------------
        <ScrollView contentContainerStyle={{ paddingBottom: BOTTOM_BAR_HEIGHT + space.xl }}>
          <View style={[styles.inner, { paddingHorizontal: pad, paddingTop: space.xl }]}>
            <Text style={styles.studio}>{gallery.studioName}</Text>
            <Text style={styles.eventTitle}>{gallery.customerName}</Text>
            <Text style={styles.eventMeta}>
              {[gallery.title, formatDate(gallery.eventDate), `${counts.total} photos`].filter(Boolean).join("  ·  ")}
            </Text>
            {gallery.expiresAt && !submitted && !locked && (
              <Text style={styles.deadline}>Please choose your photos by {formatDate(gallery.expiresAt)}</Text>
            )}

            <View style={{ marginTop: space.lg, gap: space.md }}>{banners}</View>

            {!locked && (
              <View style={styles.steps}>
                <Step n={1} text="Open a folder" />
                <Step n={2} text="Tap Select on the photos you like" />
                <Step n={3} text="Review and send to the studio" />
              </View>
            )}

            <Text style={styles.sectionTitle}>Your photos</Text>
            {foldersPending ? (
              [0, 1, 2].map((i) => <Skeleton key={i} height={72} rounded={radius.card} style={{ marginBottom: space.md }} />)
            ) : folders.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="images-outline" size={36} color={colors.textFaint} />
                <Text style={styles.emptyTitle}>No photos yet</Text>
                <Text style={styles.emptyText}>The studio hasn't added your photos yet. Please check back later.</Text>
              </View>
            ) : (
              <View style={[styles.folderList, !isPhone && styles.folderGrid]}>
                {folders.map((f) => (
                  <Pressable
                    key={f.folderId}
                    onPress={() => openFolder(f)}
                    style={({ pressed }) => [styles.folderRow, !isPhone && { width: folderWidth }, pressed && styles.pressed]}
                    accessibilityRole="button"
                    accessibilityLabel={`${f.name}, ${f.photoCount} photos${f.selectedCount ? `, ${f.selectedCount} selected` : ""}`}
                  >
                    <View style={styles.folderIcon}>
                      <Ionicons name="folder-open-outline" size={24} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.folderName} numberOfLines={2}>{f.name}</Text>
                      <Text style={styles.folderMeta}>
                        {f.photoCount} photo{f.photoCount === 1 ? "" : "s"}
                        {f.selectedCount > 0 && <Text style={styles.folderChosen}>  ·  {f.selectedCount} selected</Text>}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={colors.textFaint} />
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      ) : (
        // ---- One folder: photos ------------------------------------------------------------------
        <View style={{ flex: 1 }}>
          <View style={styles.folderHeaderWrap}>
            <View style={[styles.inner, { paddingHorizontal: pad }]}>
              <View style={styles.folderHeader}>
                <Pressable onPress={() => setFolder(null)} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Back to all folders" hitSlop={6}>
                  <Ionicons name="chevron-back" size={22} color={colors.text} />
                </Pressable>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.folderTitle} numberOfLines={1}>{folder.name}</Text>
                  <Text style={styles.folderSub} numberOfLines={1}>{gallery.customerName} · {folder.photoCount} photos</Text>
                </View>
                <Pressable onPress={() => setSearchOpen((o) => !o)} style={styles.iconButton} accessibilityRole="button" accessibilityLabel={searchOpen ? "Close search" : "Search photos"}>
                  <Ionicons name={searchOpen ? "close" : "search"} size={20} color={colors.textMuted} />
                </Pressable>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                {filters.map((f) => {
                  const on = filter === f.key;
                  return (
                    <Pressable key={f.key} style={[styles.chip, on && styles.chipOn]} onPress={() => setFilter(f.key)} accessibilityRole="button" accessibilityState={{ selected: on }}>
                      <Text style={[styles.chipText, on && styles.chipTextOn]}>{f.label}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              {searchOpen && (
                <TextInput
                  style={styles.search}
                  value={searchText}
                  onChangeText={setSearchText}
                  placeholder="Photo number or file name"
                  placeholderTextColor={colors.textFaint}
                  autoFocus
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              )}
            </View>
          </View>

          {/* Inside a folder only what blocks the customer is shown; the "sent" note lives on the home view. */}
          {(locked || error) && (
            <View style={[styles.inner, { paddingHorizontal: pad, paddingTop: space.md, gap: space.sm }]}>{banners}</View>
          )}

          <View style={[styles.inner, { flex: 1 }]}>
            {isPending ? (
              <View style={[styles.gridSkeleton, { padding: pad, gap: GAP }]}>
                {Array.from({ length: columns * 3 }).map((_, i) => (
                  <Skeleton key={i} width={cardWidth} height={Math.round(cardWidth * 0.75) + 56} rounded={radius.card} />
                ))}
              </View>
            ) : isError ? (
              <View style={styles.empty}>
                <Ionicons name="cloud-offline-outline" size={36} color={colors.textFaint} />
                <Text style={styles.emptyTitle}>Couldn't load the photos</Text>
                <Text style={styles.emptyText}>Check your internet connection and try again.</Text>
                <Button label="Try again" onPress={() => refetch()} />
              </View>
            ) : photos.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name={search ? "search-outline" : "images-outline"} size={36} color={colors.textFaint} />
                <Text style={styles.emptyTitle}>
                  {search ? "No photos match" : filter === "All" ? "No photos in this folder yet" : filter === "Selected" ? "Nothing selected here yet" : "No photos in this view"}
                </Text>
                {filter !== "All" && <Button label="Show all photos" variant="link" onPress={() => { setFilter("All"); setSearchText(""); }} />}
              </View>
            ) : (
              <FlatList
                key={columns}
                data={photos}
                numColumns={columns}
                keyExtractor={(p) => String(p.photoId)}
                contentContainerStyle={{ padding: pad, gap: GAP, paddingBottom: BOTTOM_BAR_HEIGHT + space.xl }}
                columnWrapperStyle={{ gap: GAP }}
                onEndReached={loadMore}
                onEndReachedThreshold={0.8}
                initialNumToRender={columns * 4}
                windowSize={7}
                maxToRenderPerBatch={columns * 3}
                removeClippedSubviews
                extraData={effective}
                ListFooterComponent={
                  <View style={styles.footer}>
                    {isFetchingNextPage ? <ActivityIndicator color={colors.primary} /> : !hasNextPage && (
                      <Text style={styles.endText}>{totalMatching} photo{totalMatching === 1 ? "" : "s"}</Text>
                    )}
                  </View>
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
        </View>
      )}

      <SelectionBar
        counts={counts}
        locked={locked}
        submitted={submitted}
        changedSinceSubmit={changedSinceSubmit}
        onReview={() => setReviewOpen(true)}
      />

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

// Always at the bottom, always the same height: how many are chosen, and the one next step.
function SelectionBar({ counts, locked, submitted, changedSinceSubmit, onReview }: {
  counts: GalleryCounts;
  locked: boolean;
  submitted: boolean;
  changedSinceSubmit: boolean;
  onReview: () => void;
}) {
  const sent = submitted && !changedSinceSubmit;
  const label = locked ? "View selection" : sent ? "View selection" : submitted ? "Review and send update" : "Review and send";
  return (
    <View style={styles.bar}>
      <View style={[styles.inner, styles.barInner]}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.barCount} numberOfLines={1}>
            {counts.selected} selected
          </Text>
          <Text style={styles.barSplit} numberOfLines={1}>
            <Text style={{ color: colors.normal }}>Normal {counts.normal}</Text>
            {"   "}
            <Text style={{ color: colors.big }}>Big {counts.big}</Text>
            {sent && <Text style={{ color: colors.success }}>{"   "}Sent ✓</Text>}
          </Text>
        </View>
        {counts.selected > 0 ? (
          <Button label={label} variant={sent || locked ? "secondary" : "primary"} onPress={onReview} />
        ) : (
          <Text style={styles.barHint}>Tap Select on a photo</Text>
        )}
      </View>
    </View>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <View style={styles.step}>
      <View style={styles.stepNum}><Text style={styles.stepNumText}>{n}</Text></View>
      <Text style={styles.stepText}>{text}</Text>
    </View>
  );
}

function Banner({ tone, icon, title, text }: { tone: "success" | "warning"; icon: keyof typeof Ionicons.glyphMap; title?: string; text: string }) {
  const color = tone === "success" ? colors.success : colors.warning;
  return (
    <View style={[styles.banner, { backgroundColor: tone === "success" ? colors.successSoft : colors.warningSoft }]}>
      <Ionicons name={icon} size={20} color={color} />
      <View style={{ flex: 1 }}>
        {title && <Text style={[styles.bannerTitle, { color }]}>{title}</Text>}
        <Text style={[styles.bannerText, { color: colors.text }]}>{text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  inner: { width: "100%", maxWidth: MAX_CONTENT_WIDTH, alignSelf: "center" },
  pagePad: { paddingHorizontal: space.lg, paddingTop: space.xl },
  pressed: { backgroundColor: colors.cardRaised },
  centerScreen: { flex: 1, backgroundColor: colors.page, alignItems: "center", justifyContent: "center", padding: space.xl },
  stateCard: {
    backgroundColor: colors.card, borderRadius: 16, padding: 28, maxWidth: 420, width: "100%",
    alignItems: "center", gap: space.md, borderWidth: 1, borderColor: colors.border,
  },
  stateTitle: { ...type.heading, fontSize: 20, color: colors.text, textAlign: "center" },
  stateText: { ...type.body, color: colors.textMuted, textAlign: "center", marginBottom: space.sm },

  // Home
  studio: { ...type.small, color: colors.textMuted, fontWeight: "600" },
  eventTitle: { fontSize: 26, lineHeight: 32, fontWeight: "700", color: colors.text, marginTop: space.xs },
  eventMeta: { ...type.body, color: colors.textMuted, marginTop: space.xs },
  deadline: { ...type.small, color: colors.warning, marginTop: space.sm },
  steps: {
    marginTop: space.xl, backgroundColor: colors.card, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border,
    padding: space.lg, gap: space.md,
  },
  step: { flexDirection: "row", alignItems: "center", gap: space.md },
  stepNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  stepNumText: { color: colors.primary, fontWeight: "700", fontSize: 13 },
  stepText: { ...type.body, color: colors.text, flex: 1 },
  sectionTitle: { ...type.heading, color: colors.text, marginTop: space.xl, marginBottom: space.md },
  folderList: { gap: space.md },
  folderGrid: { flexDirection: "row", flexWrap: "wrap" },
  folderRow: {
    flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 72,
    backgroundColor: colors.card, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border,
    paddingVertical: space.md, paddingHorizontal: space.lg,
  },
  folderIcon: { width: 44, height: 44, borderRadius: 10, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  folderName: { ...type.body, fontWeight: "600", color: colors.text },
  folderMeta: { ...type.small, color: colors.textMuted, marginTop: 2 },
  folderChosen: { color: colors.success, fontWeight: "600" },

  // Folder view
  folderHeaderWrap: { backgroundColor: colors.bar, borderBottomWidth: 1, borderBottomColor: colors.border },
  folderHeader: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingTop: space.md },
  backButton: { width: touch, height: touch, borderRadius: radius.control, alignItems: "center", justifyContent: "center", marginLeft: -10 },
  iconButton: { width: touch, height: touch, alignItems: "center", justifyContent: "center", marginRight: -10 },
  folderTitle: { ...type.heading, color: colors.text },
  folderSub: { ...type.small, color: colors.textMuted },
  chips: { gap: space.sm, paddingVertical: space.md },
  chip: {
    minHeight: 36, justifyContent: "center", borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.pill,
    paddingHorizontal: 14, backgroundColor: colors.card,
  },
  chipOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  chipText: { ...type.small, color: colors.textMuted, fontWeight: "600" },
  chipTextOn: { color: colors.primary },
  search: {
    borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.control, paddingHorizontal: space.md, height: touch,
    color: colors.text, backgroundColor: colors.card, marginBottom: space.md, fontSize: 15,
  },
  gridSkeleton: { flexDirection: "row", flexWrap: "wrap" },
  footer: { height: 48, alignItems: "center", justifyContent: "center" },
  endText: { ...type.caption, color: colors.textFaint },

  // Shared
  banner: { flexDirection: "row", gap: space.md, alignItems: "flex-start", borderRadius: radius.card, padding: space.md },
  bannerDanger: { backgroundColor: colors.dangerSoft, flexDirection: "column", gap: space.xs },
  bannerTitle: { ...type.body, fontWeight: "700" },
  bannerText: { ...type.small },
  bannerActions: { flexDirection: "row", gap: space.sm, marginLeft: -10 },
  empty: { alignItems: "center", gap: space.sm, paddingVertical: 48, paddingHorizontal: space.xl },
  emptyTitle: { ...type.heading, color: colors.text, textAlign: "center" },
  emptyText: { ...type.body, color: colors.textMuted, textAlign: "center", maxWidth: 360 },

  // Bottom selection bar
  bar: {
    position: "absolute", left: 0, right: 0, bottom: 0, height: BOTTOM_BAR_HEIGHT,
    backgroundColor: colors.bar, borderTopWidth: 1, borderTopColor: colors.border,
  },
  barInner: { flex: 1, flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.lg },
  barCount: { ...type.heading, color: colors.text },
  barSplit: { ...type.small, color: colors.textMuted },
  barHint: { ...type.small, color: colors.textMuted },
});
