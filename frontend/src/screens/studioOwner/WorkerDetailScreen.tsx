import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { SubscriptionLock } from "../../components/SubscriptionLock";
import type { Worker } from "../../types/worker";
import { StatusPill } from "../../components/StatusPill";

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("en-IN", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}

export function WorkerDetailScreen({ worker, onBack, onEdit }: { worker: Worker; onBack: () => void; onEdit: () => void }) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Pressable onPress={onBack} style={styles.backButton}>
            <Text style={styles.backText}>‹ Workers</Text>
          </Pressable>
          <Text style={styles.title}>{worker.fullName}</Text>
          <Text style={styles.subtitle}>Worker details</Text>
        </View>
        <SubscriptionLock>
          <Pressable style={styles.editButton} onPress={onEdit}>
            <Text style={styles.editButtonText}>Edit</Text>
          </Pressable>
        </SubscriptionLock>
      </View>

      <View style={styles.pillRow}>
        <StatusPill label={worker.isActive ? "Active" : "Inactive"} tone={worker.isActive ? "good" : "neutral"} />
        {worker.workerTypeName && <StatusPill label={worker.workerTypeName} tone="neutral" />}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Contact</Text>
        <View style={styles.grid}>
          <Field label="Mobile number" value={worker.mobileNumber ?? "—"} />
          <Field label="Email" value={worker.email ?? "—"} />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Notes</Text>
        <Text style={styles.notes}>{worker.notes || "No notes added."}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>History</Text>
        <View style={styles.grid}>
          <Field label="Created" value={formatDateTime(worker.createdAt)} />
          <Field label="Last updated" value={formatDateTime(worker.updatedAt)} />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0d1826" },
  content: { padding: 24, maxWidth: 640, width: "100%", alignSelf: "center" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 },
  backButton: { marginBottom: 10 },
  backText: { color: "#7fc0e6", fontSize: 13, fontWeight: "600" },
  title: { fontSize: 24, fontWeight: "700", color: "#e8edf3" },
  subtitle: { fontSize: 13, color: "#6f83a0", marginTop: 2 },
  editButton: { backgroundColor: "#ff9a4d", borderRadius: 8, paddingVertical: 10, paddingHorizontal: 18 },
  editButtonText: { color: "#0d1826", fontWeight: "700", fontSize: 13 },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 18 },
  card: { backgroundColor: "#132540", borderRadius: 12, borderWidth: 1, borderColor: "#23405c", padding: 18, marginBottom: 14 },
  sectionLabel: {
    fontSize: 12, color: "#7fc0e6", fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  field: { minWidth: 140, gap: 3 },
  fieldLabel: { color: "#6f83a0", fontSize: 11 },
  fieldValue: { color: "#e8edf3", fontSize: 14, fontWeight: "600" },
  notes: { color: "#a7b7cb", fontSize: 14, lineHeight: 20 },
});
