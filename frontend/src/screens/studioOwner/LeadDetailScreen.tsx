import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { SubscriptionLock } from "../../components/SubscriptionLock";
import type { Lead } from "../../types/lead";
import { StatusPill } from "../../components/StatusPill";

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("en-IN", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatCurrency(value: number | null): string {
  if (value === null) return "—";
  return `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}

export function LeadDetailScreen({ lead, onBack, onEdit }: { lead: Lead; onBack: () => void; onEdit: () => void }) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Pressable onPress={onBack} style={styles.backButton}>
            <Text style={styles.backText}>‹ Enquiry</Text>
          </Pressable>
          <Text style={styles.title}>{lead.fullName}</Text>
          <Text style={styles.subtitle}>Enquiry details</Text>
        </View>
        <SubscriptionLock>
          <Pressable style={styles.editButton} onPress={onEdit}>
            <Text style={styles.editButtonText}>Edit</Text>
          </Pressable>
        </SubscriptionLock>
      </View>

      <View style={styles.pillRow}>
        {lead.leadStatusName && <StatusPill label={lead.leadStatusName} tone="neutral" />}
        {lead.leadSourceName && <StatusPill label={lead.leadSourceName} tone="neutral" />}
        {lead.eventTypeName && <StatusPill label={lead.eventTypeName} tone="neutral" />}
        {lead.convertedCustomerId && <StatusPill label="Converted" tone="good" />}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Contact</Text>
        <View style={styles.grid}>
          <Field label="Mobile number" value={lead.mobileNumber} />
          <Field label="Email" value={lead.email ?? "—"} />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Event</Text>
        <View style={styles.grid}>
          <Field label="Expected event date" value={formatDate(lead.expectedEventDate)} />
          <Field label="Expected budget" value={formatCurrency(lead.expectedBudget)} />
          <Field label="Location" value={lead.location ?? "—"} />
          <Field label="Follow-up date" value={formatDate(lead.followUpDate)} />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Notes</Text>
        <Text style={styles.notes}>{lead.notes || "No notes added."}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>History</Text>
        <View style={styles.grid}>
          <Field label="Created" value={formatDateTime(lead.createdAt)} />
          <Field label="Last updated" value={formatDateTime(lead.updatedAt)} />
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
