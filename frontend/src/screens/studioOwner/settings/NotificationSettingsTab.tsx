import { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { settingsApi } from "../../../api/settingsApi";
import { extractErrorMessage } from "../../../api/errorMessage";
import { Toggle } from "../../../components/Toggle";
import type { NotificationSettings } from "../../../types/settings";
import { ReminderTestPanel } from "./ReminderTestPanel";

function ToggleRow({
  label,
  caption,
  value,
  onValueChange,
}: {
  label: string;
  caption?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        {caption ? <Text style={styles.rowCaption}>{caption}</Text> : null}
      </View>
      <Toggle value={value} onValueChange={onValueChange} />
    </View>
  );
}

export function NotificationSettingsTab() {
  const queryClient = useQueryClient();
  const { data, isPending } = useQuery({ queryKey: ["notification-settings"], queryFn: settingsApi.getNotificationSettings });

  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data) setSettings(data);
  }, [data]);

  const mutation = useMutation({
    mutationFn: (next: NotificationSettings) => settingsApi.updateNotificationSettings(next),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-settings"] });
      setError(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
    onError: (err) => setError(extractErrorMessage(err)),
  });

  const update = (patch: Partial<NotificationSettings>) => {
    if (!settings) return;
    const next = { ...settings, ...patch };
    setSettings(next);
    mutation.mutate(next);
  };

  if (isPending || !settings) {
    return <ActivityIndicator color="#6d4aff" style={{ marginTop: 40 }} />;
  }

  return (
    <>
    <View style={styles.list}>
      <ToggleRow label="Event reminder" caption="In-app reminder the day before, and the WhatsApp “Function Details” message to you."
        value={settings.eventReminder} onValueChange={(v) => update({ eventReminder: v })} />
      <ToggleRow label="Payment details" caption="The WhatsApp “Payment Details” message — sent to you only, never to workers."
        value={settings.paymentReminder} onValueChange={(v) => update({ paymentReminder: v })} />
      <ToggleRow label="Quotation notification" value={settings.quotationNotification} onValueChange={(v) => update({ quotationNotification: v })} />
      <ToggleRow
        label="WhatsApp notification"
        caption="Sends you two separate WhatsApp messages 24 hours before each function: Function Details and Payment Details. Delivered once WhatsApp Business is connected on the server."
        value={settings.whatsAppNotification}
        onValueChange={(v) => update({ whatsAppNotification: v })}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {saved ? <Text style={styles.success}>✓ Saved</Text> : null}
    </View>
    <ReminderTestPanel />
    </>
  );
}

const styles = StyleSheet.create({
  list: {
    borderWidth: 1, borderColor: "#d9dbec", borderRadius: 10, backgroundColor: "#f5f3ff", overflow: "hidden",
  },
  row: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: "#e7e9f5",
  },
  rowLabel: { color: "#17172f", fontSize: 14, fontWeight: "600" },
  rowCaption: { color: "#74758c", fontSize: 12, marginTop: 2 },
  error: { color: "#ef4444", fontSize: 13, padding: 12 },
  success: { color: "#16a36a", fontSize: 13, padding: 12, fontWeight: "600" },
});
