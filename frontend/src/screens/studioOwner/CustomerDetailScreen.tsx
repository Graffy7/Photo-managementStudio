import { Text, StyleSheet } from "react-native";
import { SubscriptionLock } from "../../components/SubscriptionLock";
import type { Customer } from "../../types/customer";
import { StatusPill } from "../../components/StatusPill";
import { CustomerEventsList } from "../../components/CustomerEventsList";
import { DetailScreen, InfoCard, InfoGrid, InfoItem } from "../../ui/Detail";
import { Button } from "../../ui/Button";
import { colors, type } from "../../ui/theme";

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("en-IN", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function CustomerDetailScreen({ customer, onBack, onEdit }: { customer: Customer; onBack: () => void; onEdit: () => void }) {
  return (
    <DetailScreen
      backLabel="Customers"
      onBack={onBack}
      title={customer.fullName}
      meta={[customer.mobileNumber, customer.email].filter(Boolean).join("  ·  ")}
      badges={<StatusPill label={customer.isActive ? "Active" : "Inactive"} tone={customer.isActive ? "good" : "neutral"} />}
      actions={<SubscriptionLock><Button label="Edit customer" icon="create-outline" variant="primary" onPress={onEdit} /></SubscriptionLock>}
      left={
        <InfoCard title="Events">
          <CustomerEventsList customerId={customer.customerId} />
        </InfoCard>
      }
      right={
        <>
          <InfoCard title="Contact">
            <InfoGrid>
              <InfoItem label="Mobile" value={customer.mobileNumber} />
              <InfoItem label="Email" value={customer.email ?? "—"} />
              <InfoItem label="Address" value={customer.address ?? "—"} />
            </InfoGrid>
          </InfoCard>
          <InfoCard title="Notes">
            <Text style={styles.notes}>{customer.notes || "No notes added."}</Text>
          </InfoCard>
          <InfoCard title="Record">
            <InfoGrid>
              <InfoItem label="Added" value={formatDateTime(customer.createdAt)} />
              <InfoItem label="Last updated" value={formatDateTime(customer.updatedAt)} />
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
