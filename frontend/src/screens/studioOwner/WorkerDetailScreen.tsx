import { Text, StyleSheet } from "react-native";
import { SubscriptionLock } from "../../components/SubscriptionLock";
import type { Worker } from "../../types/worker";
import { StatusPill } from "../../components/StatusPill";
import { DetailScreen, InfoCard, InfoGrid, InfoItem } from "../../ui/Detail";
import { Button } from "../../ui/Button";
import { colors, type } from "../../ui/theme";

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("en-IN", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function WorkerDetailScreen({ worker, onBack, onEdit }: { worker: Worker; onBack: () => void; onEdit: () => void }) {
  return (
    <DetailScreen
      backLabel="Workers"
      onBack={onBack}
      title={worker.fullName}
      metaItems={[...(worker.workerTypeName ? [{ icon: "briefcase-outline" as const, text: worker.workerTypeName }] : []), ...(worker.mobileNumber ? [{ icon: "call-outline" as const, text: worker.mobileNumber }] : [])]}
      badges={<StatusPill label={worker.isActive ? "Active" : "Inactive"} tone={worker.isActive ? "good" : "neutral"} />}
      actions={<SubscriptionLock><Button label="Edit worker" icon="create-outline" variant="primary" onPress={onEdit} /></SubscriptionLock>}
      left={
        <>
          <InfoCard title="Contact" icon="person-circle-outline">
            <InfoGrid>
              <InfoItem icon="call-outline" iconColor={colors.success} label="Mobile" value={worker.mobileNumber ?? "—"} />
              <InfoItem icon="mail-outline" iconColor={colors.info} label="Email" value={worker.email ?? "—"} />
              <InfoItem icon="briefcase-outline" iconColor="#8B6CFF" label="Role" value={worker.workerTypeName ?? "—"} />
            </InfoGrid>
          </InfoCard>
          <InfoCard title="Notes" icon="create-outline">
            <Text style={styles.notes}>{worker.notes || "No notes added."}</Text>
          </InfoCard>
        </>
      }
      right={
        <InfoCard title="Record" icon="time-outline">
          <InfoGrid>
            <InfoItem icon="add-circle-outline" iconColor={colors.textMuted} label="Added" value={formatDateTime(worker.createdAt)} />
            <InfoItem icon="refresh-outline" iconColor={colors.textMuted} label="Last updated" value={formatDateTime(worker.updatedAt)} />
          </InfoGrid>
        </InfoCard>
      }
    />
  );
}

const styles = StyleSheet.create({
  notes: { ...type.body, color: colors.textMuted },
});
