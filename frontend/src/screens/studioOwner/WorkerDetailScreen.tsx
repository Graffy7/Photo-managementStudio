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
      meta={[worker.workerTypeName, worker.mobileNumber].filter(Boolean).join("  ·  ")}
      badges={<StatusPill label={worker.isActive ? "Active" : "Inactive"} tone={worker.isActive ? "good" : "neutral"} />}
      actions={<SubscriptionLock><Button label="Edit worker" icon="create-outline" variant="primary" onPress={onEdit} /></SubscriptionLock>}
      left={
        <>
          <InfoCard title="Contact">
            <InfoGrid>
              <InfoItem label="Mobile" value={worker.mobileNumber ?? "—"} />
              <InfoItem label="Email" value={worker.email ?? "—"} />
              <InfoItem label="Role" value={worker.workerTypeName ?? "—"} />
            </InfoGrid>
          </InfoCard>
          <InfoCard title="Notes">
            <Text style={styles.notes}>{worker.notes || "No notes added."}</Text>
          </InfoCard>
        </>
      }
      right={
        <InfoCard title="Record">
          <InfoGrid>
            <InfoItem label="Added" value={formatDateTime(worker.createdAt)} />
            <InfoItem label="Last updated" value={formatDateTime(worker.updatedAt)} />
          </InfoGrid>
        </InfoCard>
      }
    />
  );
}

const styles = StyleSheet.create({
  notes: { ...type.body, color: colors.textMuted },
});
