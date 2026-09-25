import { useState } from "react";
import { SubscriptionLock } from "../../components/SubscriptionLock";
import { View, Text, Pressable, Modal, ActivityIndicator, StyleSheet } from "react-native";
import { photoSelectionApi } from "../../api/photoSelectionApi";
import { extractErrorMessage } from "../../api/errorMessage";
import { SelectedPhotosModal } from "./SelectedPhotosModal";
import type { CopyJob, OwnerGallery } from "../../types/photoSelection";

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  return new Date(value.endsWith("Z") ? value : `${value}Z`).toLocaleString("en-IN", {
    day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit",
  });
}

// The owner's "what did the customer pick, and put those photos in a folder for me" section.
//   View Selected Photos   -> only the chosen photos, marked ✓ Selected + Normal / Big Size
//   Create Selected Photos -> copies the ORIGINALS into <photos folder>\Customer Selection\Normal / Big Size
//   Sync Selected Photos   -> after the customer changes their mind, brings those folders up to date
export function SelectionCopyPanel({ gallery, onChanged }: { gallery: OwnerGallery; onChanged: () => void }) {
  const [viewing, setViewing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const c = gallery.counts;
  const job = gallery.latestCopyJob;
  const running = job?.status === "Queued" || job?.status === "Running";
  const created = gallery.selectionCreatedAt !== null;
  const submitted = gallery.submittedAt !== null;
  const canCreate = submitted && c.selected > 0;
  const busy = running || starting;

  const start = async () => {
    setConfirming(false);
    setError(null);
    setStarting(true);
    try {
      await photoSelectionApi.startSelectionCopy(gallery.galleryId);
      onChanged();
    } catch (err) {
      setError(extractErrorMessage(err, "Couldn't start. Please try again."));
    } finally {
      setStarting(false);
    }
  };

  if (c.total === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Selected photos</Text>
      <Text style={styles.hint}>
        See exactly what the customer chose, and put those original photos into their own folder — ready to edit or print.
      </Text>

      <View style={styles.actionRow}>
        <Pressable
          style={[styles.secondaryButton, c.selected === 0 && styles.disabled]}
          disabled={c.selected === 0}
          onPress={() => setViewing(true)}
        >
          <Text style={styles.secondaryText}>View Selected Photos</Text>
        </Pressable>

        {created ? (
          <>
            <View style={styles.createdBadge}>
              <Text style={styles.createdText}>✓ Selection Created</Text>
            </View>
            <SubscriptionLock>
              <Pressable
                style={[gallery.selectionOutOfSync ? styles.primaryButton : styles.secondaryButton, busy && styles.disabled]}
                disabled={busy}
                onPress={() => setConfirming(true)}
              >
                <Text style={gallery.selectionOutOfSync ? styles.primaryText : styles.secondaryText}>Sync Selected Photos</Text>
              </Pressable>
            </SubscriptionLock>
          </>
        ) : (
          <SubscriptionLock>
            <Pressable
              style={[styles.primaryButton, (!canCreate || busy) && styles.disabled]}
              disabled={!canCreate || busy}
              onPress={() => setConfirming(true)}
            >
              <Text style={styles.primaryText}>Create Selected Photos</Text>
            </Pressable>
          </SubscriptionLock>
        )}
      </View>

      {!created && !submitted && (
        <Text style={styles.hint}>“Create Selected Photos” becomes available once the customer submits their selection.</Text>
      )}
      {!created && submitted && c.selected === 0 && (
        <Text style={styles.hint}>The customer hasn't selected any photos.</Text>
      )}

      {created && (
        <View style={styles.infoBox}>
          {!!gallery.selectionFolder && (
            <Text style={styles.infoText}>
              Saved in: <Text style={styles.infoStrong}>{gallery.selectionFolder}</Text>
            </Text>
          )}
          <Text style={styles.infoMuted}>
            Last updated {formatDateTime(gallery.selectionSyncedAt)}
          </Text>
        </View>
      )}

      {created && gallery.selectionOutOfSync && !running && (
        <Text style={styles.warnText}>
          The customer changed their selection since the folders were last updated. Press “Sync Selected Photos” to update them.
        </Text>
      )}

      {!!error && <Text style={styles.errorText}>{error}</Text>}

      {job && <JobStatus job={job} />}

      <ConfirmDialog
        visible={confirming}
        syncing={created}
        counts={c}
        onCancel={() => setConfirming(false)}
        onConfirm={start}
      />
      <SelectedPhotosModal gallery={gallery} visible={viewing} onClose={() => setViewing(false)} />
    </View>
  );
}

// ---- Confirmation ----------------------------------------------------------------------------

function ConfirmDialog({
  visible, syncing, counts, onCancel, onConfirm,
}: {
  visible: boolean;
  syncing: boolean;
  counts: OwnerGallery["counts"];
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          <Text style={styles.dialogTitle}>{syncing ? "Sync Selected Photos?" : "Create Selected Photos?"}</Text>

          <Text style={styles.dialogText}>{syncing ? "The customer's selection is now:" : "The customer selected:"}</Text>
          <View style={styles.dialogNumbers}>
            <Text style={styles.dialogLine}>Total: <Text style={styles.strong}>{counts.selected}</Text></Text>
            <Text style={styles.dialogLine}>Normal: <Text style={styles.strong}>{counts.normal}</Text></Text>
            <Text style={styles.dialogLine}>Big Size: <Text style={styles.strong}>{counts.big}</Text></Text>
          </View>

          {syncing ? (
            <Text style={styles.dialogText}>
              The Normal and Big Size folders will be updated to match. Photos the customer unselected, or changed to
              the other size, are taken out of the old folder. Only copies made by this system are ever removed.
            </Text>
          ) : (
            <>
              <Text style={styles.dialogText}>The system will create:</Text>
              <View style={styles.tree}>
                <Text style={styles.treeText}>Customer Selection</Text>
                <Text style={styles.treeText}>├── Normal</Text>
                <Text style={styles.treeText}>└── Big Size</Text>
              </View>
            </>
          )}

          <Text style={styles.dialogSafe}>The original photos will NOT be moved or deleted.</Text>

          <View style={styles.dialogActions}>
            <Pressable style={styles.secondaryButton} onPress={onCancel}>
              <Text style={styles.secondaryText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.primaryButton} onPress={onConfirm}>
              <Text style={styles.primaryText}>{syncing ? "Sync" : "Create"}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ---- Progress and result ---------------------------------------------------------------------

function JobStatus({ job }: { job: CopyJob }) {
  const running = job.status === "Queued" || job.status === "Running";
  const syncing = job.kind === "Sync";
  const percent = job.totalCount > 0 ? Math.min(100, Math.round((job.processedCount / job.totalCount) * 100)) : running ? 0 : 100;

  const stats: { label: string; value: number | string }[] = [
    { label: "Total", value: job.totalCount },
    ...(running ? [{ label: "Processed", value: `${job.processedCount} / ${job.totalCount}` }] : []),
    { label: "Normal", value: job.normalCount },
    { label: "Big Size", value: job.bigCount },
    { label: "Created", value: job.createdCount },
    { label: "Already Exists", value: job.existsCount },
    ...(syncing || job.removedCount > 0 ? [{ label: "Removed", value: job.removedCount }] : []),
    { label: "Failed", value: job.failedCount },
  ];

  const title = running
    ? job.status === "Queued" ? "Waiting to start…" : syncing ? "Syncing Selected Photos..." : "Creating Selected Photos..."
    : job.status === "Completed" ? (syncing ? "✓ Selected Photos Synced Successfully" : "✓ Selected Photos Created Successfully")
    : job.status === "CompletedWithErrors" ? (syncing ? "Synced, with some problems" : "Created, with some problems")
    : "Couldn't finish";
  const tone = running ? "#7fc0e6" : job.status === "Completed" ? "#4cc493" : job.status === "CompletedWithErrors" ? "#f2bd5c" : "#ff7a72";

  return (
    <View style={[styles.jobBox, { borderColor: tone }]}>
      <View style={styles.jobHeader}>
        {running && <ActivityIndicator color="#7fc0e6" size="small" />}
        <Text style={[styles.jobTitle, { color: tone }]}>{title}</Text>
      </View>

      {running && (
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${percent}%` }]} />
        </View>
      )}

      <View style={styles.statGrid}>
        {stats.map((s) => (
          <View key={s.label} style={styles.stat}>
            <Text style={styles.statValue}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      {!running && !!job.errorMessage && <Text style={styles.jobError}>{job.errorMessage}</Text>}
      {!running && job.status === "Completed" && job.existsCount > 0 && (
        <Text style={styles.jobNote}>“Already Exists” means the photo was already in the right folder, so it was left as it is.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { backgroundColor: "#0f1e30", borderRadius: 12, borderWidth: 1, borderColor: "#1b2c42", padding: 18, marginBottom: 16, gap: 12 },
  sectionTitle: { color: "#e8edf3", fontSize: 16, fontWeight: "700" },
  hint: { color: "#a7b7cb", fontSize: 13, lineHeight: 19 },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, alignItems: "center" },
  primaryButton: { backgroundColor: "#ff9a4d", borderRadius: 8, paddingVertical: 11, paddingHorizontal: 18, justifyContent: "center" },
  primaryText: { color: "#0d1826", fontWeight: "700", fontSize: 13 },
  secondaryButton: { backgroundColor: "#132540", borderRadius: 8, paddingVertical: 11, paddingHorizontal: 18, borderWidth: 1, borderColor: "#23405c", justifyContent: "center" },
  secondaryText: { color: "#7fc0e6", fontWeight: "600", fontSize: 13 },
  disabled: { opacity: 0.45 },
  createdBadge: { backgroundColor: "rgba(76,196,147,0.14)", borderRadius: 8, paddingVertical: 11, paddingHorizontal: 14, borderWidth: 1, borderColor: "rgba(76,196,147,0.4)" },
  createdText: { color: "#4cc493", fontWeight: "800", fontSize: 13 },
  infoBox: { backgroundColor: "#132540", borderRadius: 8, borderWidth: 1, borderColor: "#23405c", padding: 12, gap: 3 },
  infoText: { color: "#a7b7cb", fontSize: 13 },
  infoStrong: { color: "#7fc0e6", fontWeight: "600" },
  infoMuted: { color: "#6f83a0", fontSize: 12 },
  warnText: { color: "#f2bd5c", fontSize: 13, lineHeight: 19 },
  errorText: { color: "#ff7a72", fontSize: 13 },

  overlay: { flex: 1, backgroundColor: "rgba(5,10,18,0.72)", alignItems: "center", justifyContent: "center", padding: 20 },
  dialog: { backgroundColor: "#132540", borderRadius: 14, padding: 22, width: "100%", maxWidth: 460, borderWidth: 1, borderColor: "#23405c", gap: 10 },
  dialogTitle: { color: "#e8edf3", fontSize: 19, fontWeight: "700" },
  dialogText: { color: "#a7b7cb", fontSize: 14, lineHeight: 20 },
  dialogNumbers: { backgroundColor: "#0d1826", borderRadius: 8, padding: 12, gap: 3 },
  dialogLine: { color: "#a7b7cb", fontSize: 14 },
  strong: { color: "#e8edf3", fontWeight: "800" },
  tree: { backgroundColor: "#0d1826", borderRadius: 8, padding: 12 },
  treeText: { color: "#7fc0e6", fontSize: 14, fontFamily: "monospace" },
  dialogSafe: { color: "#4cc493", fontSize: 13, fontWeight: "700" },
  dialogActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 8 },

  jobBox: { borderWidth: 1, borderRadius: 10, padding: 14, gap: 12, backgroundColor: "#132540" },
  jobHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  jobTitle: { fontSize: 15, fontWeight: "800" },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: "#0d1826", overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: "#7fc0e6", borderRadius: 4 },
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: 20 },
  stat: { gap: 1 },
  statValue: { color: "#e8edf3", fontSize: 18, fontWeight: "800" },
  statLabel: { color: "#6f83a0", fontSize: 11 },
  jobError: { color: "#f2bd5c", fontSize: 12, lineHeight: 18 },
  jobNote: { color: "#6f83a0", fontSize: 12 },
});
