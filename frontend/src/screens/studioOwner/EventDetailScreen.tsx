import { useState } from "react";
import { SubscriptionLock } from "../../components/SubscriptionLock";
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator, Platform, Share } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import type { EventStatus, EventHistoryQuotation, StudioEvent } from "../../types/event";
import { EVENT_STATUS_LABELS } from "../../types/event";
import { StatusPill } from "../../components/StatusPill";
import { DeliveryChecklist } from "../../components/DeliveryChecklist";
import { eventsApi } from "../../api/eventsApi";
import { quotationsApi } from "../../api/quotationsApi";
import { downloadAndSharePdf } from "../../utils/downloadPdf";
import { extractErrorMessage } from "../../api/errorMessage";

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("en-IN", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatCurrency(value: number | null): string {
  if (value === null) return "—";
  return `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function statusTone(status: EventStatus): "good" | "bad" | "warn" | "neutral" {
  if (status === "Completed") return "good";
  if (status === "Cancelled") return "bad";
  return "neutral";
}

function quotationTone(status: string): "good" | "bad" | "warn" | "neutral" {
  if (status === "Accepted") return "good";
  if (status === "Rejected" || status === "Cancelled" || status === "Expired") return "bad";
  if (status === "Sent") return "warn";
  return "neutral";
}

function Field({ label, value, tone }: { label: string; value: string; tone?: "warn" }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={[styles.fieldValue, tone === "warn" && styles.fieldValueWarn]}>{value}</Text>
    </View>
  );
}

export function EventDetailScreen({
  event, onBack, onEdit,
}: {
  event: StudioEvent;
  onBack: () => void;
  onEdit: () => void;
}) {
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // The event's permanent record. Everything below is read-only: old quotations and their PDFs are
  // never rewritten, so a customer coming back in two years still sees what they were quoted.
  const { data: history, isPending } = useQuery({
    queryKey: ["event-history", event.eventId],
    queryFn: () => eventsApi.history(event.eventId),
  });

  const current = history?.event ?? event;

  const downloadPdf = async (quotation: EventHistoryQuotation) => {
    setDownloadingId(quotation.quotationId);
    setError(null);
    try {
      const bytes = await quotationsApi.downloadPdf(quotation.quotationId);
      await downloadAndSharePdf(bytes, `${quotation.quotationNumber}.pdf`);
    } catch (err) {
      setError(extractErrorMessage(err, "Couldn't download the PDF."));
    } finally {
      setDownloadingId(null);
    }
  };

  const copyLocation = async () => {
    const location = current.fileLocation;
    if (!location) return;
    try {
      if (Platform.OS === "web" && navigator.clipboard) {
        await navigator.clipboard.writeText(location);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } else {
        await Share.share({ message: location });
      }
    } catch {
      setError("Couldn't copy the location.");
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable onPress={onBack} style={styles.backButton}>
            <Text style={styles.backText}>‹ Events</Text>
          </Pressable>
          <Text style={styles.title}>{current.eventTypeName ?? "Event"} — {current.customerName}</Text>
          <Text style={styles.subtitle}>{formatDate(current.eventDate)} · Event history</Text>
        </View>
        <SubscriptionLock>
          <Pressable style={styles.editButton} onPress={onEdit}>
            <Text style={styles.editButtonText}>Edit</Text>
          </Pressable>
        </SubscriptionLock>
      </View>

      <View style={styles.pillRow}>
        <StatusPill label={EVENT_STATUS_LABELS[current.eventStatus]} tone={statusTone(current.eventStatus)} />
        {current.eventTypeName && <StatusPill label={current.eventTypeName} tone="neutral" />}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Schedule</Text>
        <View style={styles.grid}>
          <Field label="Event date" value={formatDate(current.eventDate)} />
          <Field label="Start time" value={current.startTime ?? "—"} />
          <Field label="End time" value={current.endTime ?? "—"} />
          {current.eventStatus === "Completed" && (
            <Field label="Completed on" value={current.completedAt ? formatDateTime(current.completedAt) : "Not recorded"} />
          )}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Customer</Text>
        <View style={styles.grid}>
          <Field label="Name" value={current.customerName} />
          <Field label="Mobile number" value={current.customerMobileNumber} />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Event location</Text>
        <View style={styles.grid}>
          <Field label="Venue" value={current.venue ?? "—"} />
          <Field label="Address" value={current.venueAddress ?? "—"} />
        </View>
      </View>

      {!!current.fileLocation?.trim() && (
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Event file location</Text>
          <Text style={styles.path} selectable>{current.fileLocation}</Text>
          <Pressable style={styles.copyButton} onPress={copyLocation} accessibilityRole="button" accessibilityLabel="Copy location">
            <Ionicons name={copied ? "checkmark" : "copy-outline"} size={14} color={copied ? "#4cc493" : "#7fc0e6"} />
            <Text style={[styles.copyText, copied && { color: "#4cc493" }]}>{copied ? "Copied" : "Copy location"}</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Money</Text>
        <View style={styles.grid}>
          <Field label="Budget" value={formatCurrency(current.budget)} />
          {/* The accepted quotation's total is what the customer agreed to; the budget is only the
              figure the studio started from, so both are shown rather than one replacing the other. */}
          <Field
            label="Approved amount"
            value={history?.approvedQuotation ? formatCurrency(history.approvedQuotation.grandTotal) : "Not quoted"}
          />
          <Field label="Paid" value={formatCurrency(current.amountPaid)} />
          {/* A negative balance means more was collected than the event is worth — say so rather
              than showing a bare minus figure. */}
          <Field
            label={current.balance < 0 ? "Overpaid by" : "Balance"}
            value={formatCurrency(Math.abs(current.balance))}
            tone={current.balance < 0 ? "warn" : undefined}
          />
        </View>
      </View>

      {current.eventStatus === "Completed" && (
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Delivery status</Text>
          <DeliveryChecklist eventId={current.eventId} items={current.deliveryItems} showLabel={false} />
        </View>
      )}

      {isPending ? (
        <ActivityIndicator color="#ff9a4d" style={{ marginVertical: 24 }} />
      ) : (
        <>
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Approved quotation</Text>
            {history?.approvedQuotation ? (
              <QuotationRow
                quotation={history.approvedQuotation}
                downloading={downloadingId === history.approvedQuotation.quotationId}
                onDownload={downloadPdf}
                highlight
              />
            ) : (
              <Text style={styles.empty}>No quotation has been accepted for this event.</Text>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Quotation history</Text>
            {history && history.quotations.length > 0 ? (
              <View style={styles.list}>
                {history.quotations.map((q) => (
                  <QuotationRow
                    key={q.quotationId}
                    quotation={q}
                    downloading={downloadingId === q.quotationId}
                    onDownload={downloadPdf}
                  />
                ))}
              </View>
            ) : (
              <Text style={styles.empty}>No quotations were raised for this event.</Text>
            )}
            <Text style={styles.hint}>
              Every version stays here permanently, including the ones that were rejected or replaced.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Assigned workers</Text>
            {history && history.workers.length > 0 ? (
              <View style={styles.chipRow}>
                {history.workers.map((w) => (
                  <View key={w.workerId} style={styles.workerChip}>
                    <Text style={styles.workerName}>{w.workerName}</Text>
                    {!!w.workerTypeName && <Text style={styles.workerType}>{w.workerTypeName}</Text>}
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.empty}>No workers were assigned.</Text>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Payment history</Text>
            {history && history.payments.length > 0 ? (
              <View style={styles.list}>
                {history.payments.map((p) => (
                  <View key={p.paymentId} style={styles.row}>
                    <View style={styles.rowMain}>
                      <Text style={styles.rowTitle}>{formatCurrency(p.amount)}</Text>
                      <Text style={styles.rowSub}>
                        {formatDate(p.paymentDate)} · {p.paymentMethod}
                        {p.referenceNumber ? ` · ${p.referenceNumber}` : ""}
                      </Text>
                    </View>
                    <StatusPill
                      label={p.paymentStatus}
                      tone={p.paymentStatus === "Completed" ? "good" : p.paymentStatus === "Failed" ? "bad" : "warn"}
                    />
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.empty}>No payments were recorded.</Text>
            )}
          </View>
        </>
      )}

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Notes</Text>
        <Text style={styles.notes}>{current.notes || "No notes added."}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Record</Text>
        <View style={styles.grid}>
          <Field label="Created" value={formatDateTime(current.createdAt)} />
          <Field label="Last updated" value={formatDateTime(current.updatedAt)} />
        </View>
      </View>
    </ScrollView>
  );
}

function QuotationRow({
  quotation, downloading, onDownload, highlight,
}: {
  quotation: EventHistoryQuotation;
  downloading: boolean;
  onDownload: (quotation: EventHistoryQuotation) => void;
  highlight?: boolean;
}) {
  return (
    <View style={[styles.row, highlight && styles.rowHighlight]}>
      <View style={styles.rowMain}>
        <View style={styles.rowTitleLine}>
          <Text style={styles.version}>{quotation.version}</Text>
          <Text style={styles.rowTitle}>{formatCurrency(quotation.grandTotal)}</Text>
          <StatusPill label={quotation.status} tone={quotationTone(quotation.status)} />
        </View>
        <Text style={styles.rowSub}>{quotation.quotationNumber} · {formatDate(quotation.quotationDate)}</Text>
      </View>
      <Pressable
        style={styles.pdfButton}
        onPress={() => onDownload(quotation)}
        disabled={downloading}
        accessibilityRole="button"
        accessibilityLabel={`View PDF ${quotation.version}`}
      >
        {downloading ? (
          <ActivityIndicator color="#7fc0e6" size="small" />
        ) : (
          <>
            <Ionicons name="document-text-outline" size={14} color="#7fc0e6" />
            <Text style={styles.pdfButtonText}>View PDF</Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0d1826" },
  content: { padding: 24, maxWidth: 720, width: "100%", alignSelf: "center" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, gap: 12, flexWrap: "wrap" },
  headerLeft: { flexGrow: 1, flexShrink: 1, flexBasis: 240 },
  backButton: { marginBottom: 10 },
  backText: { color: "#7fc0e6", fontSize: 13, fontWeight: "600" },
  title: { fontSize: 22, fontWeight: "700", color: "#e8edf3" },
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
  fieldValueWarn: { color: "#f2bd5c" },
  notes: { color: "#a7b7cb", fontSize: 14, lineHeight: 20 },

  path: { color: "#e8edf3", fontSize: 13, fontWeight: "600" },
  copyButton: {
    flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", marginTop: 10,
    borderWidth: 1, borderColor: "#23405c", borderRadius: 8, paddingVertical: 7, paddingHorizontal: 12, backgroundColor: "#0f1e30",
  },
  copyText: { color: "#7fc0e6", fontSize: 12, fontWeight: "600" },

  list: { gap: 10 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" },
  rowHighlight: { borderWidth: 1, borderColor: "rgba(76, 196, 147, 0.4)", backgroundColor: "rgba(76, 196, 147, 0.07)", borderRadius: 10, padding: 12 },
  rowMain: { flexGrow: 1, flexShrink: 1, flexBasis: 200, gap: 4 },
  rowTitleLine: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  version: {
    color: "#a78bfa", fontSize: 12, fontWeight: "700", borderWidth: 1, borderColor: "#3b2f63",
    backgroundColor: "rgba(167, 139, 250, 0.12)", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
  },
  rowTitle: { color: "#e8edf3", fontSize: 15, fontWeight: "700" },
  rowSub: { color: "#6f83a0", fontSize: 12 },
  pdfButton: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, minWidth: 104,
    borderWidth: 1, borderColor: "#23405c", borderRadius: 8, paddingVertical: 7, paddingHorizontal: 12, backgroundColor: "#0f1e30",
  },
  pdfButtonText: { color: "#7fc0e6", fontSize: 12, fontWeight: "600" },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  workerChip: { borderWidth: 1, borderColor: "#23405c", borderRadius: 8, paddingVertical: 7, paddingHorizontal: 11, backgroundColor: "#0f1e30" },
  workerName: { color: "#e8edf3", fontSize: 13, fontWeight: "600" },
  workerType: { color: "#6f83a0", fontSize: 11, marginTop: 1 },

  empty: { color: "#6f83a0", fontSize: 13 },
  hint: { color: "#6f83a0", fontSize: 11, marginTop: 12 },
  error: { color: "#ff7a72", fontSize: 13, marginBottom: 12 },
});
