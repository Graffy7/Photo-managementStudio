import { Text, StyleSheet } from "react-native";
import { SubscriptionLock } from "../../components/SubscriptionLock";
import type { Lead } from "../../types/lead";
import { StatusPill } from "../../components/StatusPill";
import { DetailScreen, InfoCard, InfoGrid, InfoItem } from "../../ui/Detail";
import { Button } from "../../ui/Button";
import { colors, type } from "../../ui/theme";

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

export function LeadDetailScreen({ lead, onBack, onEdit }: { lead: Lead; onBack: () => void; onEdit: () => void }) {
  return (
    <DetailScreen
      backLabel="Enquiries"
      onBack={onBack}
      title={lead.fullName}
      meta={[lead.mobileNumber, lead.email].filter(Boolean).join("  ·  ")}
      badges={
        <>
          {lead.convertedCustomerId ? <StatusPill label="Converted to customer" tone="good" /> : lead.leadStatusName ? <StatusPill label={lead.leadStatusName} tone="info" /> : null}
          {lead.leadSourceName && <StatusPill label={`Via ${lead.leadSourceName}`} tone="neutral" />}
        </>
      }
      actions={<SubscriptionLock><Button label="Edit enquiry" icon="create-outline" variant="primary" onPress={onEdit} /></SubscriptionLock>}
      left={
        <>
          <InfoCard title="What they're looking for">
            <InfoGrid>
              <InfoItem label="Event type" value={lead.eventTypeName ?? "—"} />
              <InfoItem label="Expected date" value={formatDate(lead.expectedEventDate)} />
              <InfoItem label="Expected budget" value={formatCurrency(lead.expectedBudget)} />
              <InfoItem label="Location" value={lead.location ?? "—"} />
            </InfoGrid>
          </InfoCard>
          <InfoCard title="Notes">
            <Text style={styles.notes}>{lead.notes || "No notes added."}</Text>
          </InfoCard>
        </>
      }
      right={
        <>
          <InfoCard title="Follow-up">
            <InfoGrid>
              <InfoItem label="Follow-up date" value={formatDate(lead.followUpDate)} />
              <InfoItem label="Mobile" value={lead.mobileNumber} />
              <InfoItem label="Email" value={lead.email ?? "—"} />
            </InfoGrid>
          </InfoCard>
          <InfoCard title="Record">
            <InfoGrid>
              <InfoItem label="Received" value={formatDateTime(lead.createdAt)} />
              <InfoItem label="Last updated" value={formatDateTime(lead.updatedAt)} />
            </InfoGrid>
          </InfoCard>
        </>
      }
    />
  );
}

const styles = StyleSheet.create({
  notes: { ...type.body, color: colors.textMuted },
});
