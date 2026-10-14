import { useRef, useState } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { photoSelectionApi } from "../../api/photoSelectionApi";
import { extractErrorMessage } from "../../api/errorMessage";
import type { OwnerGallery } from "../../types/photoSelection";
import type { DirHandle } from "../../utils/devicePhotos";
import {
  chooseDestinationFolder, downloadSelectionZip, exportSelection, folderExportSupported, openComputerSources,
  type ExportProgress,
} from "../../utils/selectionExport";
import { Button } from "../../ui/Button";
import { colors, radius, space, type } from "../../ui/theme";

// "Export selected photos": copies the customer's selected ORIGINALS into a folder the owner chooses,
// sorted as <Event>_Selected\<Category>\Normal and \Big Size. A ZIP download is offered where the
// browser can't write to folders (phones, Firefox, Safari) and as an alternative everywhere else.
export function SelectionExportPanel({ gallery }: { gallery: OwnerGallery }) {
  const supported = folderExportSupported();
  const [destination, setDestination] = useState<DirHandle | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [finished, setFinished] = useState(false);
  const [running, setRunning] = useState(false);
  const [zipping, setZipping] = useState(false);
  const busy = useRef(false); // guards double clicks before React re-renders
  const cancel = useRef({ cancelled: false });

  const { data: manifest, isPending, isError, refetch } = useQuery({
    queryKey: ["selection-export", gallery.galleryId, gallery.counts.selected, gallery.counts.normal, gallery.counts.big],
    queryFn: () => photoSelectionApi.selectionExportManifest(gallery.galleryId),
    enabled: gallery.counts.selected > 0,
  });

  if (gallery.counts.selected === 0) return null;

  const choose = async () => {
    setNotice(null);
    const choice = await chooseDestinationFolder();
    if (choice.ok) {
      setDestination(choice.handle);
      setProgress(null);
      setFinished(false);
    } else if (choice.reason !== "cancelled") {
      setNotice(choice.message);
    }
  };

  const start = async () => {
    if (busy.current || !destination) return;
    busy.current = true;
    setRunning(true);
    setFinished(false);
    setNotice(null);
    cancel.current = { cancelled: false };
    try {
      // The selection as it is right now (the customer may have changed it since the page opened).
      const latest = (await refetch()).data;
      if (!latest || latest.files.length === 0) {
        setNotice("The customer has no photos selected right now.");
        return;
      }
      let computerFolders = new Map<string, DirHandle>();
      if (latest.computerCount > 0) {
        try {
          computerFolders = await openComputerSources(gallery.galleryId, latest);
        } catch {
          setNotice("The photo folder on this computer wasn't opened, so photos added from this computer can't be copied. Click Start export again and choose that folder.");
          return;
        }
      }
      // Still allowed to write there? (The browser can take permission back, e.g. after a restart.)
      const allowed = (await destination.queryPermission?.({ mode: "readwrite" })) ?? "granted";
      if (allowed !== "granted" && (await destination.requestPermission?.({ mode: "readwrite" }).catch(() => "denied")) !== "granted") {
        setNotice("The browser no longer has permission to save into that folder. Choose the destination folder again.");
        setDestination(null);
        return;
      }
      await exportSelection(gallery.galleryId, latest, destination, computerFolders, setProgress, cancel.current);
      setFinished(true);
    } catch (err) {
      setNotice(`The export stopped: ${(err as Error)?.message || "unknown problem"}. Nothing already copied was changed; click Start export to continue.`);
    } finally {
      busy.current = false;
      setRunning(false);
    }
  };

  const zip = async () => {
    if (zipping) return;
    setZipping(true);
    setNotice(null);
    try {
      await downloadSelectionZip(gallery.galleryId);
      setNotice("The ZIP download has started. When it finishes, open \"Export report.txt\" inside it to confirm every photo was included.");
    } catch (err) {
      setNotice(extractErrorMessage(err, "Couldn't start the ZIP download. Please try again."));
    } finally {
      setZipping(false);
    }
  };

  const m = manifest;
  const renamed = m?.files.filter((f) => f.renamedFrom).length ?? 0;
  const complete = finished && progress !== null && progress.processed === progress.total && progress.failed === 0;
  const stopped = finished && progress !== null && progress.processed < progress.total;
  const pct = progress && progress.total > 0 ? Math.round((progress.processed / progress.total) * 100) : 0;

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Ionicons name="folder-open-outline" size={22} color={colors.primary} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.title}>Export selected photos to a folder</Text>
          <Text style={styles.sub}>Copies the original files, sorted by category into Normal and Big Size folders.</Text>
        </View>
      </View>

      {isPending ? (
        <Text style={styles.muted}>Getting the selection…</Text>
      ) : isError || !m ? (
        <View style={{ gap: space.sm, alignItems: "flex-start" }}>
          <Text style={styles.error}>Couldn't load the selection. Check your connection.</Text>
          <Button label="Try again" onPress={() => refetch()} style={styles.small} />
        </View>
      ) : (
        <>
          <View style={styles.stats}>
            <Stat label="Selected" value={m.selectedCount} />
            <Stat label="Normal" value={m.normalCount} />
            <Stat label="Big Size" value={m.bigCount} />
            <Stat label="Categories" value={m.categories.length} />
          </View>

          <View style={styles.tree}>
            <Text style={styles.treeLine}>📁 {m.rootFolderName}</Text>
            {m.categories.slice(0, 4).map((c) => (
              <Text key={c} style={styles.treeLine}>{"    "}📁 {c}  ›  Normal, Big Size</Text>
            ))}
            {m.categories.length > 4 && <Text style={styles.treeMore}>{"    "}…and {m.categories.length - 4} more</Text>}
          </View>
          {renamed > 0 && (
            <Text style={styles.muted}>{renamed} photo{renamed === 1 ? " has" : "s have"} the same name as another photo in the same folder, so " (2)" is added to keep both.</Text>
          )}

          {supported ? (
            <>
              <View style={styles.actions}>
                <Button label={destination ? "Change folder" : "Choose destination folder"} icon="folder-outline" onPress={choose} disabled={running} />
                <Button label={running ? "Exporting…" : "Start export"} icon="download-outline" variant="primary" onPress={start} disabled={!destination || running} loading={running && !progress} />
                {running && <Button label="Stop" variant="link" onPress={() => { cancel.current.cancelled = true; }} />}
              </View>
              {destination && <Text style={styles.muted}>Saving into: <Text style={styles.strong}>{destination.name}\{m.rootFolderName}</Text></Text>}
              {m.computerCount > 0 && (
                <Text style={styles.muted}>{m.computerCount} of these photos were added from this computer; the browser will ask for that photo folder if it doesn't already have it.</Text>
              )}
            </>
          ) : (
            <Text style={styles.muted}>This browser can't save straight into a folder (that needs Chrome or Edge on a computer). Download a ZIP instead.</Text>
          )}

          <View style={styles.actions}>
            <Button
              label={zipping ? "Preparing…" : "Download as ZIP"}
              icon="archive-outline"
              variant={supported ? "link" : "primary"}
              onPress={zip}
              disabled={zipping || running || m.serverCount === 0}
            />
          </View>
          {m.serverCount === 0 ? (
            <Text style={styles.muted}>A ZIP isn't possible here: these originals are on the studio's computer, not on the server. Use Chrome or Edge on that computer.</Text>
          ) : m.computerCount > 0 ? (
            <Text style={styles.muted}>The ZIP includes the {m.serverCount} originals stored on the server; the {m.computerCount} added from the studio's computer aren't in it.</Text>
          ) : null}

          {progress && (
            <View style={styles.progressBox} accessibilityLiveRegion="polite">
              <View style={styles.track}><View style={[styles.fill, { width: `${pct}%` }, progress.failed > 0 && { backgroundColor: colors.warning }]} /></View>
              <Text style={styles.progressText}>
                {progress.processed} of {progress.total} done · {progress.copied} copied · {progress.alreadyThere} already there · {progress.failed} failed
              </Text>
            </View>
          )}

          {complete && (
            <View style={[styles.banner, { backgroundColor: colors.successSoft }]}>
              <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              <Text style={styles.bannerText}>
                All {progress!.total} photos are in {destination?.name}\{m.rootFolderName} ({progress!.copied} copied now{progress!.alreadyThere ? `, ${progress!.alreadyThere} were already there` : ""}). Every copy was checked after writing.
              </Text>
            </View>
          )}
          {finished && !complete && progress && (
            <View style={[styles.banner, { backgroundColor: colors.warningSoft }]}>
              <Ionicons name="alert-circle" size={20} color={colors.warning} />
              <Text style={styles.bannerText}>
                {stopped ? `Stopped after ${progress.processed} of ${progress.total} photos. ` : ""}
                {progress.failed > 0 ? `${progress.failed} photo${progress.failed === 1 ? "" : "s"} could not be copied (listed below). ` : ""}
                The export is not complete. Fix the problem and click Start export again — photos already copied are skipped.
              </Text>
            </View>
          )}
          {progress && progress.failures.length > 0 && (
            <ScrollView style={styles.failures} nestedScrollEnabled>
              {progress.failures.map((f) => (
                <Text key={f.path} style={styles.failure}><Text style={styles.strong}>{f.path}</Text> — {f.reason}</Text>
              ))}
            </ScrollView>
          )}
        </>
      )}

      {notice && <Text style={styles.notice}>{notice}</Text>}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, padding: space.lg, gap: space.md },
  head: { flexDirection: "row", gap: space.md, alignItems: "flex-start" },
  title: { ...type.heading, color: colors.text },
  sub: { ...type.small, color: colors.textMuted, marginTop: 2 },
  muted: { ...type.small, color: colors.textMuted },
  strong: { fontWeight: "700", color: colors.text },
  error: { ...type.small, color: colors.danger },
  small: { minHeight: 36 },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  stat: { flexGrow: 1, flexBasis: 90, backgroundColor: colors.cardRaised, borderRadius: radius.control, paddingVertical: space.sm, paddingHorizontal: space.md },
  statValue: { fontSize: 20, lineHeight: 26, fontWeight: "700", color: colors.text, fontVariant: ["tabular-nums"] },
  statLabel: { ...type.caption, color: colors.textMuted },
  tree: { backgroundColor: colors.page, borderRadius: radius.control, padding: space.md, gap: 2 },
  treeLine: { ...type.small, color: colors.text, fontFamily: "monospace" },
  treeMore: { ...type.small, color: colors.textMuted, fontFamily: "monospace" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, alignItems: "center" },
  progressBox: { gap: space.xs },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.cardRaised, overflow: "hidden" },
  fill: { height: 8, borderRadius: 4, backgroundColor: colors.primary },
  progressText: { ...type.small, color: colors.text, fontVariant: ["tabular-nums"] },
  banner: { flexDirection: "row", gap: space.sm, alignItems: "flex-start", borderRadius: radius.control, padding: space.md },
  bannerText: { ...type.small, color: colors.text, flex: 1 },
  failures: { maxHeight: 220, backgroundColor: colors.page, borderRadius: radius.control, padding: space.md },
  failure: { ...type.small, color: colors.text, marginBottom: 6 },
  notice: { ...type.small, color: colors.warning },
});
