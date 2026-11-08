import { useState } from "react";
import { SubscriptionLock } from "../../components/SubscriptionLock";
import { View, Text, StyleSheet, Platform, Share } from "react-native";
import { useQuery } from "@tanstack/react-query";
import type { EventHistoryQuotation, StudioEvent } from "../../types/event";
import { EVENT_STATUS_LABELS } from "../../types/event";
import { StatusPill, eventStatusTone, type Tone } from "../../components/StatusPill";
import { DetailScreen, InfoCard, InfoGrid, InfoItem, SummaryStrip, EmptyLine, ProgressLine, type IconName } from "../../ui/Detail";
import { Ionicons } from "@expo/vector-icons";
import { categorizeEventType, CATEGORY_COLORS } from "../../utils/eventCategory";
import { Button } from "../../ui/Button";
import { Skeleton } from "../../ui/Skeleton";
import { colors, radius, space, type } from "../../ui/theme";
import { DeliveryChecklist } from "../../components/DeliveryChecklist";
import { EventTeam } from "../../components/EventTeam";
import { EventExpenses } from "../../components/EventExpenses";
import { useModules } from "../../hooks/useModules";
import { eventsApi } from "../../api/eventsApi";
import { quotationsApi } from "../../api/quotationsApi";
import { quotationPdfName } from "../../utils/downloadPdf";
import { PdfPreviewModal } from "../../ui/PdfPreviewModal";
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

// "Farhan Samplevel (QA Photographer)" -> "FS".
function initials(name: string): string {
  const words = name.replace(/\(.*?\)/g, "").trim().split(/\s+/).filter(Boolean);
  return (words.slice(0, 2).map((w) => w[0]).join("") || "?").toUpperCase();
}

function paymentIcon(method: string): IconName {
  const m = method.toLowerCase();
  if (m.includes("cash")) return "cash-outline";
  if (m.includes("card")) return "card-outline";
  if (m.includes("upi") || m.includes("gpay") || m.includes("phone")) return "phone-portrait-outline";
  if (m.includes("bank") || m.includes("neft") || m.includes("transfer")) return "business-outline";
  return "wallet-outline";
}

function quotationTone(status: string): Tone {
  if (status === "Accepted") return "good";
  if (status === "Rejected" || status === "Cancelled" || status === "Expired") return "bad";
  if (status === "Sent") return "warn";
  return "neutral";
}

export function EventDetailScreen({
  event, onBack, onEdit, backLabel = "Events",
}: {
  event: StudioEvent;
  onBack: () => void;
  onEdit: () => void;
  // Where Back goes, e.g. "Calendar" when opened from the Calendar.
  backLabel?: string;
}) {
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const isOn = useModules();

  // The event's permanent record. Everything below is read-only: old quotations and their PDFs are
  // never rewritten, so a customer coming back in two years still sees what they were quoted.
  const { data: history, isPending } = useQuery({
    queryKey: ["event-history", event.eventId],
    queryFn: () => eventsApi.history(event.eventId),
  });

  const current = history?.event ?? event;

  // PDF opens a preview pop-up (Download is inside it); the file is fetched once per click.
  const [preview, setPreview] = useState<{ quotation: EventHistoryQuotation; bytes: ArrayBuffer | null; error: string | null } | null>(null);
  const openPdf = async (quotation: EventHistoryQuotation) => {
    setDownloadingId(quotation.quotationId);
    setError(null);
    setPreview({ quotation, bytes: null, error: null });
    try {
      const bytes = await quotationsApi.downloadPdf(quotation.quotationId);
      setPreview((p) => (p?.quotation.quotationId === quotation.quotationId ? { ...p, bytes } : p));
    } catch (err) {
      const message = extractErrorMessage(err, "Couldn't load the PDF.");
      setPreview((p) => (p?.quotation.quotationId === quotation.quotationId ? { ...p, error: message } : p));
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

  const timeText = current.startTime ? `${current.startTime.slice(0, 5)}${current.endTime ? ` – ${current.endTime.slice(0, 5)}` : ""}` : "All day";
  const typeColor = CATEGORY_COLORS[categorizeEventType(current.eventTypeName)];
  const balanceLabel = current.balance < 0 ? "Overpaid" : "Balance";
  const balanceTone = current.balance > 0 ? colors.warning : current.balance < 0 ? colors.danger : colors.success;
  const when = [formatDate(current.eventDate), current.startTime ? `${current.startTime.slice(0, 5)}${current.endTime ? `–${current.endTime.slice(0, 5)}` : ""}` : null]
    .filter(Boolean).join(" · ");

  const historyLoading = <View style={{ gap: space.sm }}><Skeleton height={56} /><Skeleton height={56} /></View>;

  return (
    <>
    <DetailScreen
      backLabel={backLabel}
      onBack={onBack}
      title={current.customerName}
      metaItems={[
        { icon: "calendar-outline", text: formatDate(current.eventDate) },
        { icon: "time-outline", text: timeText },
        ...(current.venue ? [{ icon: "location-outline" as const, text: current.venue }] : []),
      ]}
      badges={
        <>
          <View style={[styles.typeBadge, { backgroundColor: `${typeColor}22`, borderColor: typeColor }]}>
            <View style={[styles.typeDot, { backgroundColor: typeColor }]} />
            <Text style={[styles.typeBadgeText, { color: typeColor }]}>{current.eventTypeName ?? "Event"}</Text>
          </View>
          <StatusPill label={EVENT_STATUS_LABELS[current.eventStatus]} tone={eventStatusTone(current.eventStatus)} />
        </>
      }
      actions={<SubscriptionLock><Button label="Edit event" icon="create-outline" variant="primary" onPress={onEdit} /></SubscriptionLock>}
      summary={
        <SummaryStrip
          items={[
            { label: "Total", value: formatCurrency(current.budget), icon: "wallet-outline", color: colors.primaryFill },
            // The accepted quotation's total is what the customer agreed to; the total is only the
            // figure the studio started from, so both are shown rather than one replacing the other.
            { label: "Approved quotation", value: history?.approvedQuotation ? formatCurrency(history.approvedQuotation.grandTotal) : isPending ? "…" : "Not quoted", icon: "document-text-outline", color: "#8B6CFF" },
            { label: "Paid", value: formatCurrency(current.amountPaid), tone: colors.success, icon: "checkmark-circle-outline", color: "#1FA978" },
            // A negative balance means more was collected than the event is worth.
            { label: balanceLabel, value: formatCurrency(Math.abs(current.balance)), tone: balanceTone, icon: "hourglass-outline", color: current.balance > 0 ? "#E08A12" : current.balance < 0 ? "#D92D4A" : "#1FA978" },
          ]}
          footer={current.budget ? (
            <ProgressLine
              label={`${formatCurrency(current.amountPaid)} of ${formatCurrency(current.budget)} paid`}
              value={current.amountPaid / current.budget}
              color={current.balance > 0 ? colors.warning : colors.success}
            />
          ) : undefined}
        />
      }
      left={
        <>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <InfoCard title="Details" icon="information-circle-outline">
            <InfoGrid>
              <InfoItem icon="calendar-outline" label="Date" value={formatDate(current.eventDate)} />
              <InfoItem icon="time-outline" iconColor={colors.info} label="Time" value={timeText} />
              <InfoItem icon="person-outline" iconColor="#8B6CFF" label="Customer" value={current.customerName} />
              <InfoItem icon="call-outline" iconColor={colors.success} label="Mobile" value={current.customerMobileNumber} />
              <InfoItem icon="location-outline" iconColor={colors.warning} label="Venue" value={current.venue ?? "—"} />
              <InfoItem icon="map-outline" iconColor={colors.warning} label="Address" value={current.venueAddress ?? "—"} />
              {current.eventStatus === "Completed" && (
                <InfoItem icon="checkmark-done-outline" iconColor={colors.success} label="Completed on" value={current.completedAt ? formatDateTime(current.completedAt) : "Not recorded"} />
              )}
            </InfoGrid>
          </InfoCard>

          <InfoCard title={current.eventStatus === "Completed" ? "Team on the day" : "Team"} icon="people-outline">
            {/* Until the shoot is done the team can still change; afterwards it stays on record as it was. */}
            {current.eventStatus !== "Completed" ? (
              <EventTeam eventId={current.eventId} assigned={current.assignedWorkers ?? []} />
            ) : isPending ? historyLoading : history && history.workers.length > 0 ? (
              <View style={{ gap: space.xs }}>
                {history.workers.map((w) => (
                  <View key={w.workerId} style={styles.personRow}>
                    <View style={styles.avatar}><Text style={styles.avatarText}>{initials(w.workerName)}</Text></View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.workerName} numberOfLines={1}>{w.workerName}</Text>
                      {!!w.workerTypeName && <Text style={styles.workerType} numberOfLines={1}>{w.workerTypeName}</Text>}
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <EmptyLine>No workers were assigned.</EmptyLine>
            )}
          </InfoCard>

          {isOn("EXPENSES") && <EventExpenses eventId={current.eventId} />}

          {current.eventStatus === "Completed" && (
            <InfoCard title="Delivery" icon="cube-outline">
              <DeliveryChecklist eventId={current.eventId} items={current.deliveryItems} showLabel={false} />
            </InfoCard>
          )}

          {!!current.fileLocation?.trim() && (
            <InfoCard title="Where the files are" icon="folder-open-outline">
              <Text style={styles.path} selectable>{current.fileLocation}</Text>
              <Button
                label={copied ? "Copied" : "Copy location"}
                icon={copied ? "checkmark" : "copy-outline"}
                onPress={copyLocation}
                style={{ alignSelf: "flex-start" }}
              />
            </InfoCard>
          )}

          <InfoCard title="Notes" icon="create-outline">
            <Text style={styles.notes}>{current.notes || "No notes added."}</Text>
          </InfoCard>
        </>
      }
      right={
        <>
          <InfoCard title="Quotations" icon="document-text-outline">
            {isPending ? historyLoading : history && history.quotations.length > 0 ? (
              <View style={{ gap: space.sm }}>
                {history.quotations.map((q) => (
                  <QuotationRow
                    key={q.quotationId}
                    quotation={q}
                    approved={history.approvedQuotation?.quotationId === q.quotationId}
                    downloading={downloadingId === q.quotationId}
                    onDownload={openPdf}
                  />
                ))}
                <Text style={styles.hint}>Every version stays here permanently, including rejected or replaced ones.</Text>
              </View>
            ) : (
              <EmptyLine>No quotations yet for this event.</EmptyLine>
            )}
          </InfoCard>

          <InfoCard title="Payments" icon="cash-outline">
            {isPending ? historyLoading : history && history.payments.length > 0 ? (
              <View style={{ gap: 2 }}>
                {history.payments.map((p) => (
                  <View key={p.paymentId} style={styles.row}>
                    <View style={[styles.payIcon, { backgroundColor: `${p.paymentStatus === "Completed" ? colors.success : colors.textFaint}22` }]}>
                      <Ionicons name={paymentIcon(p.paymentMethod)} size={16} color={p.paymentStatus === "Completed" ? colors.success : colors.textMuted} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.rowTitle}>{formatCurrency(p.amount)}</Text>
                      <Text style={styles.rowSub} numberOfLines={1}>
                        {formatDate(p.paymentDate)} · {p.paymentMethod}{p.referenceNumber ? ` · ${p.referenceNumber}` : ""}
                      </Text>
                    </View>
                    <StatusPill label={p.paymentStatus} tone={p.paymentStatus === "Completed" ? "good" : p.paymentStatus === "Failed" || p.paymentStatus === "Cancelled" ? "bad" : "warn"} />
                  </View>
                ))}
              </View>
            ) : (
              <EmptyLine>No payments recorded yet.</EmptyLine>
            )}
          </InfoCard>

          <InfoCard title="Record" icon="time-outline">
            <InfoGrid>
              <InfoItem icon="add-circle-outline" iconColor={colors.textMuted} label="Created" value={formatDateTime(current.createdAt)} />
              <InfoItem icon="refresh-outline" iconColor={colors.textMuted} label="Last updated" value={formatDateTime(current.updatedAt)} />
            </InfoGrid>
          </InfoCard>
        </>
      }
    />
    <PdfPreviewModal
      visible={!!preview}
      title={preview ? `${preview.quotation.version} · ${preview.quotation.quotationNumber}` : ""}
      filename={preview ? quotationPdfName(current.customerName, preview.quotation.quotationNumber) : "quotation.pdf"}
      bytes={preview?.bytes ?? null}
      loading={!!preview && !preview.bytes && !preview.error}
      error={preview?.error}
      onClose={() => setPreview(null)}
    />
    </>
  );
}

function QuotationRow({
  quotation, approved, downloading, onDownload,
}: {
  quotation: EventHistoryQuotation;
  approved: boolean;
  downloading: boolean;
  onDownload: (quotation: EventHistoryQuotation) => void;
}) {
  return (
    <View style={[styles.quote, approved && styles.quoteApproved]}>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <View style={styles.quoteTop}>
          <Text style={styles.version}>{quotation.version}</Text>
          <Text style={styles.rowTitle}>{formatCurrency(quotation.grandTotal)}</Text>
          <StatusPill label={approved ? "Approved" : quotation.status} tone={approved ? "good" : quotationTone(quotation.status)} />
        </View>
        <Text style={styles.rowSub}>{quotation.quotationNumber} · {formatDate(quotation.quotationDate)}</Text>
      </View>
      <Button
        label="PDF"
        icon="document-text-outline"
        variant="link"
        loading={downloading}
        onPress={() => onDownload(quotation)}
        accessibilityLabel={`View PDF ${quotation.version}`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  error: { ...type.small, color: colors.danger },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  worker: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.control, paddingVertical: 8, paddingHorizontal: space.md, backgroundColor: colors.page },
  workerName: { ...type.small, fontWeight: "700", color: colors.text },
  personRow: {
    flexDirection: "row", alignItems: "center", gap: space.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.control,
    paddingVertical: 6, paddingHorizontal: space.sm, backgroundColor: colors.page,
  },
  avatar: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: colors.primarySoft },
  avatarText: { ...type.caption, fontWeight: "800", color: colors.primary },
  payIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  typeBadge: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: radius.pill, paddingVertical: 3, paddingHorizontal: 10 },
  typeDot: { width: 7, height: 7, borderRadius: 4 },
  typeBadgeText: { ...type.caption, fontWeight: "800" },
  workerType: { ...type.caption, color: colors.textMuted },
  path: { ...type.body, fontWeight: "600", color: colors.text },
  notes: { ...type.body, color: colors.textMuted },
  hint: { ...type.caption, color: colors.textFaint, marginTop: space.xs },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 52, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowTitle: { ...type.body, fontWeight: "700", color: colors.text, fontVariant: ["tabular-nums"] },
  rowSub: { ...type.small, color: colors.textMuted },
  quote: { flexDirection: "row", alignItems: "center", gap: space.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.control, padding: space.md, backgroundColor: colors.page },
  quoteApproved: { borderColor: colors.success },
  quoteTop: { flexDirection: "row", alignItems: "center", gap: space.sm, flexWrap: "wrap" },
  version: { ...type.caption, fontWeight: "700", color: colors.textMuted, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
});
