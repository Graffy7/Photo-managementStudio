import { Text, StyleSheet } from "react-native";
import { SubscriptionLock } from "../../components/SubscriptionLock";
import { LEAD_OUTCOME_LABELS, type Lead } from "../../types/lead";
import { OUTCOME_TONES } from "./LeadListScreen";
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
      metaItems={[{ icon: "call-outline", text: lead.mobileNumber }, ...(lead.email ? [{ icon: "mail-outline" as const, text: lead.email }] : [])]}
      badges={
        <>
          <StatusPill label={LEAD_OUTCOME_LABELS[lead.outcome]} tone={OUTCOME_TONES[lead.outcome]} />
          {lead.leadSourceName && <StatusPill label={`Via ${lead.leadSourceName}`} tone="neutral" />}
        </>
      }
      actions={<SubscriptionLock><Button label="Edit enquiry" icon="create-outline" variant="primary" onPress={onEdit} /></SubscriptionLock>}
      left={
        <>
          <InfoCard title="What they're looking for" icon="sparkles-outline">
            <InfoGrid>
              <InfoItem icon="pricetag-outline" iconColor="#8B6CFF" label="Event type" value={lead.eventTypeName ?? "—"} />
              <InfoItem icon="calendar-outline" label="Expected date" value={formatDate(lead.expectedEventDate)} />
              <InfoItem icon="wallet-outline" iconColor={colors.success} label="Expected budget" value={formatCurrency(lead.expectedBudget)} />
              <InfoItem icon="location-outline" iconColor={colors.warning} label="Location" value={lead.location ?? "—"} />
            </InfoGrid>
          </InfoCard>
          <InfoCard title="Notes" icon="create-outline">
            <Text style={styles.notes}>{lead.notes || "No notes added."}</Text>
          </InfoCard>
        </>
      }
      right={
        <>
          <InfoCard title="Follow-up" icon="alarm-outline">
            <InfoGrid>
              <InfoItem icon="alarm-outline" iconColor={colors.warning} label="Follow-up date" value={formatDate(lead.followUpDate)} />
              <InfoItem icon="call-outline" iconColor={colors.success} label="Mobile" value={lead.mobileNumber} />
              <InfoItem icon="mail-outline" iconColor={colors.info} label="Email" value={lead.email ?? "—"} />
            </InfoGrid>
          </InfoCard>
          <InfoCard title="Record" icon="time-outline">
            <InfoGrid>
              <InfoItem icon="download-outline" iconColor={colors.textMuted} label="Received" value={formatDateTime(lead.createdAt)} />
              <InfoItem icon="refresh-outline" iconColor={colors.textMuted} label="Last updated" value={formatDateTime(lead.updatedAt)} />
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
