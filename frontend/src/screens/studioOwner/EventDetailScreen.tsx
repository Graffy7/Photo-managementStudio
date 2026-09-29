import { useState } from "react";
import { SubscriptionLock } from "../../components/SubscriptionLock";
import { View, Text, StyleSheet, Platform, Share } from "react-native";
import { useQuery } from "@tanstack/react-query";
import type { EventHistoryQuotation, StudioEvent } from "../../types/event";
import { EVENT_STATUS_LABELS } from "../../types/event";
import { StatusPill, eventStatusTone, type Tone } from "../../components/StatusPill";
import { DetailScreen, InfoCard, InfoGrid, InfoItem, SummaryStrip, EmptyLine } from "../../ui/Detail";
import { Button } from "../../ui/Button";
import { Skeleton } from "../../ui/Skeleton";
import { colors, radius, space, type } from "../../ui/theme";
import { DeliveryChecklist } from "../../components/DeliveryChecklist";
import { EventTeam } from "../../components/EventTeam";
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

function quotationTone(status: string): Tone {
  if (status === "Accepted") return "good";
  if (status === "Rejected" || status === "Cancelled" || status === "Expired") return "bad";
  if (status === "Sent") return "warn";
  return "neutral";
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

  const balanceLabel = current.balance < 0 ? "Overpaid" : "Balance";
  const balanceTone = current.balance > 0 ? colors.warning : current.balance < 0 ? colors.danger : colors.success;
  const when = [formatDate(current.eventDate), current.startTime ? `${current.startTime.slice(0, 5)}${current.endTime ? `–${current.endTime.slice(0, 5)}` : ""}` : null]
    .filter(Boolean).join(" · ");

  const historyLoading = <View style={{ gap: space.sm }}><Skeleton height={56} /><Skeleton height={56} /></View>;

  return (
    <DetailScreen
      backLabel="Events"
      onBack={onBack}
      title={current.customerName}
      meta={[current.eventTypeName ?? "Event", when, current.venue].filter(Boolean).join("  ·  ")}
      badges={<StatusPill label={EVENT_STATUS_LABELS[current.eventStatus]} tone={eventStatusTone(current.eventStatus)} />}
      actions={<SubscriptionLock><Button label="Edit event" icon="create-outline" variant="primary" onPress={onEdit} /></SubscriptionLock>}
      summary={
        <SummaryStrip items={[
          { label: "Total", value: formatCurrency(current.budget) },
          // The accepted quotation's total is what the customer agreed to; the total is only the
          // figure the studio started from, so both are shown rather than one replacing the other.
          { label: "Approved", value: history?.approvedQuotation ? formatCurrency(history.approvedQuotation.grandTotal) : isPending ? "…" : "Not quoted" },
          { label: "Paid", value: formatCurrency(current.amountPaid), tone: colors.success },
          // A negative balance means more was collected than the event is worth.
          { label: balanceLabel, value: formatCurrency(Math.abs(current.balance)), tone: balanceTone },
        ]} />
      }
      left={
        <>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <InfoCard title="Details">
            <InfoGrid>
              <InfoItem label="Date" value={formatDate(current.eventDate)} />
              <InfoItem label="Time" value={current.startTime ? `${current.startTime.slice(0, 5)}${current.endTime ? ` – ${current.endTime.slice(0, 5)}` : ""}` : "All day"} />
              <InfoItem label="Customer" value={current.customerName} />
              <InfoItem label="Mobile" value={current.customerMobileNumber} />
              <InfoItem label="Venue" value={current.venue ?? "—"} />
              <InfoItem label="Address" value={current.venueAddress ?? "—"} />
              {current.eventStatus === "Completed" && (
                <InfoItem label="Completed on" value={current.completedAt ? formatDateTime(current.completedAt) : "Not recorded"} />
              )}
            </InfoGrid>
          </InfoCard>

          <InfoCard title={current.eventStatus === "Completed" ? "Team on the day" : "Team"}>
            {/* Until the shoot is done the team can still change; afterwards it stays on record as it was. */}
            {current.eventStatus !== "Completed" ? (
              <EventTeam eventId={current.eventId} assigned={current.assignedWorkers ?? []} />
            ) : isPending ? historyLoading : history && history.workers.length > 0 ? (
              <View style={styles.chips}>
                {history.workers.map((w) => (
                  <View key={w.workerId} style={styles.worker}>
                    <Text style={styles.workerName}>{w.workerName}</Text>
                    {!!w.workerTypeName && <Text style={styles.workerType}>{w.workerTypeName}</Text>}
                  </View>
                ))}
              </View>
            ) : (
              <EmptyLine>No workers were assigned.</EmptyLine>
            )}
          </InfoCard>

          {current.eventStatus === "Completed" && (
            <InfoCard title="Delivery">
              <DeliveryChecklist eventId={current.eventId} items={current.deliveryItems} showLabel={false} />
            </InfoCard>
          )}

          {!!current.fileLocation?.trim() && (
            <InfoCard title="Where the files are">
              <Text style={styles.path} selectable>{current.fileLocation}</Text>
              <Button
                label={copied ? "Copied" : "Copy location"}
                icon={copied ? "checkmark" : "copy-outline"}
                onPress={copyLocation}
                style={{ alignSelf: "flex-start" }}
              />
            </InfoCard>
          )}

          <InfoCard title="Notes">
            <Text style={styles.notes}>{current.notes || "No notes added."}</Text>
          </InfoCard>
        </>
      }
      right={
        <>
          <InfoCard title="Quotations">
            {isPending ? historyLoading : history && history.quotations.length > 0 ? (
              <View style={{ gap: space.sm }}>
                {history.quotations.map((q) => (
                  <QuotationRow
                    key={q.quotationId}
                    quotation={q}
                    approved={history.approvedQuotation?.quotationId === q.quotationId}
                    downloading={downloadingId === q.quotationId}
                    onDownload={downloadPdf}
                  />
                ))}
                <Text style={styles.hint}>Every version stays here permanently, including rejected or replaced ones.</Text>
              </View>
            ) : (
              <EmptyLine>No quotations yet for this event.</EmptyLine>
            )}
          </InfoCard>

          <InfoCard title="Payments">
            {isPending ? historyLoading : history && history.payments.length > 0 ? (
              <View style={{ gap: 2 }}>
                {history.payments.map((p) => (
                  <View key={p.paymentId} style={styles.row}>
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

          <InfoCard title="Record">
            <InfoGrid>
              <InfoItem label="Created" value={formatDateTime(current.createdAt)} />
              <InfoItem label="Last updated" value={formatDateTime(current.updatedAt)} />
            </InfoGrid>
          </InfoCard>
        </>
      }
    />
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
  workerName: { ...type.small, fontWeight: "600", color: colors.text },
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
