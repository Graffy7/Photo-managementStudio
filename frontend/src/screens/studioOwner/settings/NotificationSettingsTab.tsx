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
    return <ActivityIndicator color="#7fc0e6" style={{ marginTop: 40 }} />;
  }

  return (
    <>
    <View style={styles.list}>
      <ToggleRow label="Event reminder" value={settings.eventReminder} onValueChange={(v) => update({ eventReminder: v })} />
      <ToggleRow label="Customer payment reminder" value={settings.paymentReminder} onValueChange={(v) => update({ paymentReminder: v })} />
      <ToggleRow label="Worker / event notification" value={settings.workerEventNotification} onValueChange={(v) => update({ workerEventNotification: v })} />
      <ToggleRow label="Quotation notification" value={settings.quotationNotification} onValueChange={(v) => update({ quotationNotification: v })} />
      <ToggleRow
        label="WhatsApp notification"
        caption="Turns on the day-before WhatsApp reminders. Messages are only delivered once a WhatsApp provider is set up on the server."
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
    borderWidth: 1, borderColor: "#23405c", borderRadius: 10, backgroundColor: "#132540", overflow: "hidden",
  },
  row: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: "#1b2c42",
  },
  rowLabel: { color: "#e8edf3", fontSize: 14, fontWeight: "600" },
  rowCaption: { color: "#6f83a0", fontSize: 11, marginTop: 2 },
  error: { color: "#ff7a72", fontSize: 13, padding: 12 },
  success: { color: "#4cc493", fontSize: 13, padding: 12, fontWeight: "600" },
});
