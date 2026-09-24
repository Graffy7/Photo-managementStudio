import { useMemo, useState } from "react";
import {
  View, Text, TextInput, Pressable, ScrollView, Image, Modal, StyleSheet, ActivityIndicator, Platform, Share, Linking,
} from "react-native";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { buildCustomerLink, photoSelectionApi, photoUrl } from "../../api/photoSelectionApi";
import { extractErrorMessage } from "../../api/errorMessage";
import { StatusPill } from "../../components/StatusPill";
import { FolderBrowserModal } from "../../components/FolderBrowserModal";
import { DeliveryFolders } from "../../components/DeliveryFolders";
import { SelectionCopyPanel } from "./SelectionCopyPanel";
import { downloadBytes } from "../../utils/downloadFile";
import { STATE_LABELS, stateTone } from "./PhotoSelectionListScreen";
import type { OwnerGallery, OwnerPhoto, PhotoFilter } from "../../types/photoSelection";

const EXPIRY_PRESETS = [7, 15, 30, 60];
const PAGE_SIZE = 60;

function formatDate(value: string | null): string {
  return value ? new Date(value.endsWith("Z") ? value : `${value}Z`).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" }) : "—";
}

// Event dates are plain calendar dates (no time zone), unlike the UTC timestamps below.
function formatEventDate(value: string): string {
  return new Date(value).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
}

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  return new Date(value.endsWith("Z") ? value : `${value}Z`).toLocaleString("en-IN", {
    day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit",
  });
}

function daysLeft(value: string | null): number | null {
  if (!value) return null;
  const ms = new Date(value.endsWith("Z") ? value : `${value}Z`).getTime() - Date.now();
  return Math.ceil(ms / 86_400_000);
}

export function PhotoGalleryManageScreen({ eventId, onBack }: { eventId: number; onBack: () => void }) {
  const queryClient = useQueryClient();

  // Opens the event's gallery (creating it the first time). While photos are importing it polls
  // quickly for the progress bar; otherwise it refreshes now and then so the counts follow the
  // customer live.
  const { data: gallery, isPending, isError, error } = useQuery({
    queryKey: ["photo-gallery", eventId],
    queryFn: () => photoSelectionApi.openForEvent(eventId),
    refetchInterval: (query) => {
      const data = query.state.data;
      const active = (s?: string) => s === "Queued" || s === "Running";
      return active(data?.latestImport?.status) || active(data?.latestCopyJob?.status) ? 1500 : 15000;
    },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["photo-gallery", eventId] });

  if (isPending) {
    return (
      <View style={styles.screen}>
        <ActivityIndicator color="#ff9a4d" style={{ marginTop: 60 }} />
      </View>
    );
  }

  if (isError || !gallery) {
    return (
      <View style={styles.screen}>
        <Pressable style={styles.backButton} onPress={onBack}><Text style={styles.backText}>‹ Photo Selection</Text></Pressable>
        <Text style={styles.error}>{extractErrorMessage(error, "Couldn't open this event's photo gallery.")}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Header gallery={gallery} onBack={onBack} />
      <Stats gallery={gallery} />
      <SelectionCopyPanel gallery={gallery} onChanged={refresh} />
      <ImportPanel gallery={gallery} onChanged={refresh} />
      <LinkPanel gallery={gallery} onChanged={refresh} />
      <PhotosPanel gallery={gallery} />
    </ScrollView>
  );
}

// ---- Header ----------------------------------------------------------------------------------

function Header({ gallery, onBack }: { gallery: OwnerGallery; onBack: () => void }) {
  return (
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        <Pressable onPress={onBack} style={{ alignSelf: "flex-start", marginBottom: 8 }}>
          <Text style={styles.crumb}>‹ Photo Selection</Text>
        </Pressable>
        <Text style={styles.title}>{gallery.customerName}</Text>
        <Text style={styles.subtitle}>
          {gallery.eventTypeName ? `${gallery.eventTypeName} · ` : ""}{formatEventDate(gallery.eventDate)}{gallery.venue ? ` · ${gallery.venue}` : ""}
        </Text>
      </View>
      <StatusPill label={STATE_LABELS[gallery.state]} tone={stateTone(gallery.state)} />
    </View>
  );
}

// ---- Stats -----------------------------------------------------------------------------------

function Stats({ gallery }: { gallery: OwnerGallery }) {
  const c = gallery.counts;
  const cards = [
    { label: "Total photos", value: c.total, color: "#e8edf3" },
    { label: "Selected", value: c.selected, color: "#4cc493" },
    { label: "Normal", value: c.normal, color: "#7fc0e6" },
    { label: "Big", value: c.big, color: "#ff9a4d" },
    { label: "Not selected", value: c.notSelected, color: "#a7b7cb" },
  ];

  return (
    <View style={styles.section}>
      <View style={styles.statRow}>
        {cards.map((card) => (
          <View key={card.label} style={styles.statCard}>
            <Text style={[styles.statValue, { color: card.color }]}>{card.value}</Text>
            <Text style={styles.statLabel}>{card.label}</Text>
          </View>
        ))}
      </View>
      <View style={styles.metaRow}>
        <Meta label="Status" value={gallery.isLocked ? "Locked" : "Open"} />
        <Meta label="Link opened" value={formatDateTime(gallery.firstOpenedAt)} />
        <Meta label="Last updated" value={formatDateTime(gallery.lastSelectionAt)} />
        <Meta
          label="Submitted at"
          value={gallery.submittedAt ? `${formatDateTime(gallery.submittedAt)}${gallery.changedSinceSubmit ? " · edited since" : ""}` : "Not submitted"}
        />
      </View>
    </View>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.meta}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

// ---- Import ----------------------------------------------------------------------------------

function ImportPanel({ gallery, onChanged }: { gallery: OwnerGallery; onChanged: () => void }) {
  const [folder, setFolder] = useState(gallery.sourceFolder ?? "");
  const [browsing, setBrowsing] = useState(false);
  const [starting, setStarting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const job = gallery.latestImport;
  const running = job?.status === "Queued" || job?.status === "Running";
  const percent = job && job.totalCount > 0 ? Math.round((job.processedCount / job.totalCount) * 100) : 0;

  const start = async () => {
    setMessage(null);
    setStarting(true);
    try {
      await photoSelectionApi.startImport(gallery.galleryId, folder.trim());
      onChanged();
    } catch (err) {
      setMessage(extractErrorMessage(err, "Couldn't start the import."));
    } finally {
      setStarting(false);
    }
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Photos</Text>
      <Text style={styles.hint}>
        Choose the folder on this computer where the finished photos are. Small previews are made for the customer to look at —
        your original files stay exactly where they are and are never uploaded.
      </Text>

      <View style={styles.folderRow}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          value={folder}
          onChangeText={setFolder}
          placeholder="e.g. D:\Photos\Meera Wedding\Selected"
          placeholderTextColor="#6f83a0"
          editable={!running}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Pressable style={styles.secondaryButton} disabled={running} onPress={() => setBrowsing(true)}>
          <Text style={styles.secondaryButtonText}>Browse</Text>
        </Pressable>
        <Pressable
          style={[styles.primaryButton, (running || starting || !folder.trim()) && styles.disabled]}
          disabled={running || starting || !folder.trim()}
          onPress={start}
        >
          <Text style={styles.primaryButtonText}>{gallery.counts.total > 0 ? "Import new photos" : "Import photos"}</Text>
        </Pressable>
      </View>

      {!!message && <Text style={styles.error}>{message}</Text>}

      {running && job && (
        <View style={styles.progressBox}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${percent}%` }]} />
          </View>
          <Text style={styles.progressText}>
            {job.status === "Queued" ? "Waiting to start…" : `Preparing previews… ${job.processedCount} of ${job.totalCount} (${percent}%)`}
          </Text>
        </View>
      )}

      {!running && job && (job.status === "Completed" || job.status === "CompletedWithErrors" || job.status === "Failed") && (
        <Text style={job.status === "Completed" ? styles.okText : styles.warnText}>
          {job.status === "Failed"
            ? job.errorMessage ?? "The last import failed."
            : `Last import: ${job.processedCount - job.failedCount} photo${job.processedCount - job.failedCount === 1 ? "" : "s"} added${job.failedCount > 0 ? `, ${job.failedCount} couldn't be read` : ""}.`}
        </Text>
      )}

      {gallery.previewsPurged && (
        <Text style={styles.warnText}>
          The previews for this event were removed after its link expired. Your original photos are untouched.
        </Text>
      )}

      <FolderBrowserModal
        visible={browsing}
        onClose={() => setBrowsing(false)}
        onSelect={(path) => {
          setFolder(path);
          setBrowsing(false);
        }}
      />
    </View>
  );
}

// ---- Link, lock, export ----------------------------------------------------------------------

function LinkPanel({ gallery, onChanged }: { gallery: OwnerGallery; onChanged: () => void }) {
  const [days, setDays] = useState<number | "custom">(30);
  const [customDays, setCustomDays] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; tone: "ok" | "error" } | null>(null);

  const importing = gallery.latestImport?.status === "Queued" || gallery.latestImport?.status === "Running";
  const noPhotos = gallery.counts.total === 0;
  const link = gallery.linkToken ? buildCustomerLink(gallery.linkToken) : null;
  const activeLink = gallery.hasActiveLink && !gallery.isExpired && link;
  const remaining = daysLeft(gallery.expiresAt);
  const chosenDays = days === "custom" ? parseInt(customDays, 10) : days;
  const validDays = Number.isFinite(chosenDays) && chosenDays >= 1 && chosenDays <= 365;

  const run = async (key: string, action: () => Promise<void>, okText?: string) => {
    setBusy(key);
    setMessage(null);
    try {
      await action();
      if (okText) setMessage({ text: okText, tone: "ok" });
    } catch (err) {
      setMessage({ text: extractErrorMessage(err), tone: "error" });
    } finally {
      setBusy(null);
    }
  };

  const generate = () =>
    run("generate", async () => {
      await photoSelectionApi.generateLink(gallery.galleryId, chosenDays as number);
      onChanged();
    }, "New link ready. Copy it or send it on WhatsApp.");

  const copy = () =>
    run("copy", async () => {
      if (!link) return;
      if (Platform.OS === "web" && navigator.clipboard) {
        await navigator.clipboard.writeText(link);
      } else {
        await Share.share({ message: link });
      }
    }, Platform.OS === "web" ? "Link copied." : undefined);

  const whatsApp = (reminder: boolean) =>
    run(reminder ? "reminder" : "whatsapp", async () => {
      const share = await photoSelectionApi.shareMessage(gallery.galleryId, reminder);
      await Linking.openURL(share.whatsAppUrl);
    });

  const revoke = () =>
    run("revoke", async () => {
      await photoSelectionApi.revokeLink(gallery.galleryId);
      onChanged();
    }, "Link revoked. It no longer opens.");

  const toggleLock = () =>
    run("lock", async () => {
      await (gallery.isLocked ? photoSelectionApi.unlock(gallery.galleryId) : photoSelectionApi.lock(gallery.galleryId));
      onChanged();
    });

  const exportCsv = () =>
    run("export", async () => {
      const bytes = await photoSelectionApi.exportCsv(gallery.galleryId);
      const safeName = gallery.customerName.replace(/[^\p{L}\p{N} _-]/gu, "").trim().replace(/\s+/g, "-") || "customer";
      await downloadBytes(bytes, `photo-selection-${safeName}.csv`, "text/csv");
    });

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Customer link</Text>

      {noPhotos || importing ? (
        <Text style={styles.hint}>
          {importing ? "Photos are still being prepared — the link can be sent once the import finishes." : "Import the photos first — then you can send the customer their private link."}
        </Text>
      ) : (
        <>
          {activeLink ? (
            <View style={styles.linkBox}>
              <Text style={styles.linkText} selectable numberOfLines={2}>{link}</Text>
              <Text style={styles.linkMeta}>
                Expires {formatDate(gallery.expiresAt)}{remaining !== null ? ` · ${remaining > 0 ? `${remaining} day${remaining === 1 ? "" : "s"} left` : "today"}` : ""}
              </Text>
            </View>
          ) : gallery.isExpired ? (
            <Text style={styles.warnText}>This link expired on {formatDate(gallery.expiresAt)}. Generate a new one to let the customer choose again.</Text>
          ) : (
            <Text style={styles.hint}>No active link yet. Pick how long it should work, then generate it.</Text>
          )}

          {activeLink && (
            <View style={styles.actionRow}>
              <Pressable style={styles.secondaryButton} disabled={busy !== null} onPress={copy}>
                <Text style={styles.secondaryButtonText}>Copy link</Text>
              </Pressable>
              <Pressable style={styles.whatsButton} disabled={busy !== null} onPress={() => whatsApp(false)}>
                <Text style={styles.whatsButtonText}>Send on WhatsApp</Text>
              </Pressable>
              {!gallery.submittedAt && (
                <Pressable style={styles.secondaryButton} disabled={busy !== null} onPress={() => whatsApp(true)}>
                  <Text style={styles.secondaryButtonText}>Send reminder</Text>
                </Pressable>
              )}
              <Pressable style={styles.dangerButton} disabled={busy !== null} onPress={revoke}>
                <Text style={styles.dangerButtonText}>Revoke link</Text>
              </Pressable>
            </View>
          )}

          <Text style={styles.label}>{activeLink ? "Replace with a new link — valid for" : "Link valid for"}</Text>
          <View style={styles.chipRow}>
            {EXPIRY_PRESETS.map((d) => (
              <Pressable key={d} style={[styles.chip, days === d && styles.chipSelected]} onPress={() => setDays(d)}>
                <Text style={[styles.chipText, days === d && styles.chipTextSelected]}>{d} days</Text>
              </Pressable>
            ))}
            <Pressable style={[styles.chip, days === "custom" && styles.chipSelected]} onPress={() => setDays("custom")}>
              <Text style={[styles.chipText, days === "custom" && styles.chipTextSelected]}>Custom</Text>
            </Pressable>
            {days === "custom" && (
              <TextInput
                style={[styles.input, styles.daysInput]}
                value={customDays}
                onChangeText={(t) => setCustomDays(t.replace(/\D/g, ""))}
                placeholder="days"
                placeholderTextColor="#6f83a0"
                keyboardType="number-pad"
              />
            )}
            <Pressable
              style={[styles.primaryButton, (!validDays || busy !== null) && styles.disabled]}
              disabled={!validDays || busy !== null}
              onPress={generate}
            >
              <Text style={styles.primaryButtonText}>{activeLink ? "Generate new link" : "Generate link"}</Text>
            </Pressable>
          </View>
          {activeLink && <Text style={styles.hintSmall}>Generating a new link stops the old one from working.</Text>}
        </>
      )}

      {!!message && <Text style={message.tone === "ok" ? styles.okText : styles.error}>{message.text}</Text>}

      {!noPhotos && (
        <View style={[styles.actionRow, styles.divider]}>
          <Pressable style={[styles.secondaryButton, busy !== null && styles.disabled]} disabled={busy !== null} onPress={toggleLock}>
            <Text style={styles.secondaryButtonText}>{gallery.isLocked ? "🔓 Unlock selection" : "🔒 Lock selection"}</Text>
          </Pressable>
          <Pressable
            style={[styles.secondaryButton, (gallery.counts.selected === 0 || busy !== null) && styles.disabled]}
            disabled={gallery.counts.selected === 0 || busy !== null}
            onPress={exportCsv}
          >
            <Text style={styles.secondaryButtonText}>Export selection (CSV)</Text>
          </Pressable>
          <Text style={styles.hintSmall}>
            {gallery.isLocked
              ? "Locked: the customer can still open the link but can't change anything."
              : "Lock the selection once you've confirmed it with the customer."}
          </Text>
        </View>
      )}
    </View>
  );
}

// ---- Photos (grid / table) -------------------------------------------------------------------

function PhotosPanel({ gallery }: { gallery: OwnerGallery }) {
  const [filter, setFilter] = useState<PhotoFilter>("All");
  const [view, setView] = useState<"grid" | "table">("grid");
  const [search, setSearch] = useState("");
  const [preview, setPreview] = useState<OwnerPhoto | null>(null);
  // null = every photo in the gallery; otherwise the delivery folder the owner picked above.
  const [folderId, setFolderId] = useState<number | null>(null);
  const c = gallery.counts;

  const { data, isPending, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    // total in the key: when an import finishes the list reloads with the new photos.
    queryKey: ["photo-gallery-photos", gallery.galleryId, filter, search, c.total, c.selected, folderId],
    queryFn: ({ pageParam }) => photoSelectionApi.photos(gallery.galleryId, { filter, search: search || undefined, page: pageParam, pageSize: PAGE_SIZE, folderId: folderId ?? undefined }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    enabled: c.total > 0,
  });

  const photos = useMemo(() => data?.pages.flatMap((p) => p.items) ?? [], [data]);
  const matching = data?.pages[0]?.totalCount ?? 0;

  if (c.total === 0) return null;

  const filters: { key: PhotoFilter; label: string; count: number }[] = [
    { key: "All", label: "All", count: c.total },
    { key: "Selected", label: "Selected", count: c.selected },
    { key: "NotSelected", label: "Not selected", count: c.notSelected },
    { key: "Normal", label: "Normal", count: c.normal },
    { key: "Big", label: "Big", count: c.big },
  ];

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { marginBottom: 10 }]}>Photo delivery</Text>
      <DeliveryFolders galleryId={gallery.galleryId} selectedFolderId={folderId} onSelect={setFolderId} />

      <View style={[styles.photosHeader, { marginTop: 18 }]}>
        <Text style={styles.sectionTitle}>Selection</Text>
        <View style={styles.viewToggle}>
          {(["grid", "table"] as const).map((v) => (
            <Pressable key={v} style={[styles.toggleItem, view === v && styles.toggleItemActive]} onPress={() => setView(v)}>
              <Text style={[styles.toggleText, view === v && styles.toggleTextActive]}>{v === "grid" ? "Grid" : "Table"}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.chipRow}>
        {filters.map((f) => (
          <Pressable key={f.key} style={[styles.chip, filter === f.key && styles.chipSelected]} onPress={() => setFilter(f.key)}>
            <Text style={[styles.chipText, filter === f.key && styles.chipTextSelected]}>
              {f.label}{folderId === null ? ` (${f.count})` : ""}
            </Text>
          </Pressable>
        ))}
      </View>

      <TextInput
        style={[styles.input, { marginBottom: 12 }]}
        value={search}
        onChangeText={setSearch}
        placeholder="Search by file name or photo number"
        placeholderTextColor="#6f83a0"
        autoCapitalize="none"
      />

      {isPending ? (
        <ActivityIndicator color="#ff9a4d" style={{ marginVertical: 24 }} />
      ) : photos.length === 0 ? (
        <Text style={styles.hint}>{filter === "All" && !search ? "No photos." : "Nothing matches."}</Text>
      ) : view === "grid" ? (
        <View style={styles.grid}>
          {photos.map((p) => (
            <Pressable key={p.photoId} style={[styles.tile, p.selectionType === "Big" && styles.tileBig, p.selectionType === "Normal" && styles.tileNormal]} onPress={() => setPreview(p)}>
              {p.thumbnailUrl ? (
                <Image source={{ uri: photoUrl(p.thumbnailUrl) }} style={styles.tileImage} resizeMode="contain" />
              ) : (
                <View style={[styles.tileImage, styles.tileEmpty]}><Text style={styles.hintSmall}>No preview</Text></View>
              )}
              <Text style={styles.tileName} numberOfLines={1}>{p.fileName}</Text>
              {p.selectionType && (
                <View style={[styles.tileBadge, { backgroundColor: p.selectionType === "Big" ? "#ff9a4d" : "#7fc0e6" }]}>
                  <Text style={styles.tileBadgeText}>{p.selectionType}</Text>
                </View>
              )}
            </Pressable>
          ))}
        </View>
      ) : (
        <View>
          <View style={[styles.tr, styles.trHead]}>
            <Text style={[styles.th, { width: 64 }]}>Photo ID</Text>
            <Text style={[styles.th, { flex: 1 }]}>File name</Text>
            <Text style={[styles.th, { width: 84 }]}>Selection</Text>
            <Text style={[styles.th, { width: 150 }]}>Selected on</Text>
          </View>
          {photos.map((p) => (
            <Pressable key={p.photoId} style={styles.tr} onPress={() => setPreview(p)}>
              <Text style={[styles.td, { width: 64 }]}>{p.photoNumber}</Text>
              <Text style={[styles.td, { flex: 1 }]} numberOfLines={1}>{p.fileName}</Text>
              <View style={{ width: 84 }}>
                {p.selectionType ? (
                  <StatusPill label={p.selectionType} tone={p.selectionType === "Big" ? "warn" : "neutral"} />
                ) : (
                  <Text style={styles.tdMuted}>—</Text>
                )}
              </View>
              <Text style={[styles.td, { width: 150 }]}>{formatDateTime(p.selectedAt)}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {hasNextPage && (
        <Pressable style={[styles.secondaryButton, { alignSelf: "center", marginTop: 14 }]} disabled={isFetchingNextPage} onPress={() => fetchNextPage()}>
          <Text style={styles.secondaryButtonText}>{isFetchingNextPage ? "Loading…" : `Load more (${photos.length} of ${matching})`}</Text>
        </Pressable>
      )}

      <Modal visible={preview !== null} transparent animationType="fade" onRequestClose={() => setPreview(null)}>
        <Pressable style={styles.previewOverlay} onPress={() => setPreview(null)}>
          {preview && (
            <>
              <Image source={{ uri: photoUrl(preview.previewUrl) }} style={styles.previewImage} resizeMode="contain" />
              <Text style={styles.previewCaption}>
                {preview.fileName}{preview.selectionType ? ` · ${preview.selectionType}` : " · not selected"}
              </Text>
            </>
          )}
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0d1826" },
  content: { padding: 24, paddingBottom: 48, width: "100%", maxWidth: 1100, alignSelf: "center" },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 18 },
  crumb: { color: "#7fc0e6", fontWeight: "600", fontSize: 13 },
  title: { fontSize: 24, fontWeight: "700", color: "#e8edf3" },
  subtitle: { fontSize: 13, color: "#6f83a0", marginTop: 3 },
  backButton: { backgroundColor: "#132540", borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16, borderWidth: 1, borderColor: "#23405c", alignSelf: "flex-start", margin: 24 },
  backText: { color: "#7fc0e6", fontWeight: "600", fontSize: 13 },

  section: { backgroundColor: "#0f1e30", borderRadius: 12, borderWidth: 1, borderColor: "#1b2c42", padding: 18, marginBottom: 16, gap: 10 },
  sectionTitle: { color: "#e8edf3", fontSize: 16, fontWeight: "700" },
  hint: { color: "#a7b7cb", fontSize: 13, lineHeight: 19 },
  hintSmall: { color: "#6f83a0", fontSize: 12 },
  label: { color: "#6f83a0", fontSize: 12, fontWeight: "600", marginTop: 6 },
  error: { color: "#ff7a72", fontSize: 13 },
  okText: { color: "#4cc493", fontSize: 13 },
  warnText: { color: "#f2bd5c", fontSize: 13 },
  disabled: { opacity: 0.45 },

  statRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statCard: { flexGrow: 1, flexBasis: 120, backgroundColor: "#132540", borderRadius: 10, borderWidth: 1, borderColor: "#23405c", padding: 14 },
  statValue: { fontSize: 26, fontWeight: "800" },
  statLabel: { color: "#6f83a0", fontSize: 12, marginTop: 2 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 24, marginTop: 4 },
  meta: { gap: 2 },
  metaLabel: { color: "#6f83a0", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 },
  metaValue: { color: "#e8edf3", fontSize: 13, fontWeight: "600" },

  folderRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, alignItems: "center" },
  input: {
    borderWidth: 1, borderColor: "#23405c", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
    color: "#e8edf3", backgroundColor: "#132540", fontSize: 13, minWidth: 200,
  },
  daysInput: { width: 80, minWidth: 80 },
  primaryButton: { backgroundColor: "#ff9a4d", borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16, justifyContent: "center" },
  primaryButtonText: { color: "#0d1826", fontWeight: "700", fontSize: 13 },
  secondaryButton: { backgroundColor: "#132540", borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16, borderWidth: 1, borderColor: "#23405c", justifyContent: "center" },
  secondaryButtonText: { color: "#7fc0e6", fontWeight: "600", fontSize: 13 },
  whatsButton: { backgroundColor: "#25a95a", borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16, justifyContent: "center" },
  whatsButtonText: { color: "#ffffff", fontWeight: "700", fontSize: 13 },
  dangerButton: { backgroundColor: "rgba(255,122,114,0.12)", borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16, borderWidth: 1, borderColor: "rgba(255,122,114,0.4)", justifyContent: "center" },
  dangerButtonText: { color: "#ff7a72", fontWeight: "600", fontSize: 13 },

  progressBox: { gap: 6, marginTop: 4 },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: "#132540", overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: "#ff9a4d", borderRadius: 4 },
  progressText: { color: "#a7b7cb", fontSize: 12 },

  linkBox: { backgroundColor: "#132540", borderRadius: 8, borderWidth: 1, borderColor: "#23405c", padding: 12, gap: 4 },
  linkText: { color: "#7fc0e6", fontSize: 13 },
  linkMeta: { color: "#6f83a0", fontSize: 12 },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, alignItems: "center" },
  divider: { borderTopWidth: 1, borderTopColor: "#1b2c42", paddingTop: 14, marginTop: 6 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
  chip: { borderWidth: 1, borderColor: "#23405c", borderRadius: 100, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: "#132540" },
  chipSelected: { borderColor: "#ff9a4d", backgroundColor: "rgba(255,154,77,0.14)" },
  chipText: { color: "#a7b7cb", fontSize: 12, fontWeight: "600" },
  chipTextSelected: { color: "#ff9a4d" },

  photosHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  viewToggle: { flexDirection: "row", borderWidth: 1, borderColor: "#23405c", borderRadius: 8, overflow: "hidden" },
  toggleItem: { paddingVertical: 6, paddingHorizontal: 14, backgroundColor: "#132540" },
  toggleItemActive: { backgroundColor: "#7fc0e6" },
  toggleText: { color: "#a7b7cb", fontSize: 12, fontWeight: "600" },
  toggleTextActive: { color: "#0d1826" },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tile: { width: 150, backgroundColor: "#132540", borderRadius: 8, borderWidth: 2, borderColor: "#1b2c42", overflow: "hidden" },
  tileNormal: { borderColor: "#7fc0e6" },
  tileBig: { borderColor: "#ff9a4d" },
  tileImage: { width: "100%", height: 100, backgroundColor: "#0a1320" },
  tileEmpty: { alignItems: "center", justifyContent: "center" },
  tileName: { color: "#a7b7cb", fontSize: 11, padding: 6 },
  tileBadge: { position: "absolute", top: 6, right: 6, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  tileBadgeText: { color: "#0d1826", fontSize: 10, fontWeight: "800" },

  tr: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#1b2c42" },
  trHead: { borderBottomColor: "#23405c" },
  th: { color: "#6f83a0", fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 },
  td: { color: "#e8edf3", fontSize: 13 },
  tdMuted: { color: "#4a5d78", fontSize: 13 },

  previewOverlay: { flex: 1, backgroundColor: "rgba(5,10,18,0.94)", alignItems: "center", justifyContent: "center", padding: 20 },
  previewImage: { width: "100%", height: "85%" },
  previewCaption: { color: "#a7b7cb", fontSize: 13, marginTop: 10 },
});
