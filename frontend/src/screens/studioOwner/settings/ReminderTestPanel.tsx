import { useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator, StyleSheet } from "react-native";
import { settingsApi } from "../../../api/settingsApi";
import { extractErrorMessage } from "../../../api/errorMessage";
import type { ReminderMessagePreview, ReminderPreview } from "../../../types/settings";

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

// "Test Event Reminder": shows the two WhatsApp messages for the upcoming functions, exactly as they
// would be sent, so the owner can see that Function Details carries no money and that both go to them alone.
export function ReminderTestPanel() {
  const [preview, setPreview] = useState<ReminderPreview | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [runResult, setRunResult] = useState<string | null>(null);

  const run = async (key: string, action: () => Promise<void>) => {
    setLoading(key);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(null);
    }
  };

  const showTest = (sendToOwner: boolean) =>
    run(sendToOwner ? "send" : "test", async () => {
      setRunResult(null);
      setPreview(await settingsApi.testWhatsAppReminder({ sendToOwner }));
    });

  const sendNow = () =>
    run("now", async () => {
      const result = await settingsApi.sendWhatsAppRemindersNow();
      setRunResult(
        result.sent + result.failed + result.skipped === 0
          ? "Nothing to send: no function starts in the next two days, or its messages have already gone out."
          : `Sent ${result.sent}, failed ${result.failed}, skipped ${result.skipped}.`
      );
    });

  return (
    <View style={styles.panel}>
      <Text style={styles.title}>WhatsApp messages 24 hours before each function</Text>
      <Text style={styles.caption}>
        Two separate messages go to your WhatsApp number: Function Details (client, date, time, place, photographers) and
        Payment Details (total, advance, paid, balance). Workers don't receive anything.
      </Text>

      <View style={styles.buttonRow}>
        <Pressable style={[styles.primary, loading !== null && styles.disabled]} disabled={loading !== null} onPress={() => showTest(false)}>
          <Text style={styles.primaryText}>{loading === "test" ? "Building…" : "Test Event Reminder"}</Text>
        </Pressable>
        <Pressable style={[styles.secondary, loading !== null && styles.disabled]} disabled={loading !== null} onPress={() => showTest(true)}>
          <Text style={styles.secondaryText}>{loading === "send" ? "Sending…" : "Send test to me"}</Text>
        </Pressable>
        <Pressable style={[styles.secondary, loading !== null && styles.disabled]} disabled={loading !== null} onPress={sendNow}>
          <Text style={styles.secondaryText}>{loading === "now" ? "Sending…" : "Send upcoming now"}</Text>
        </Pressable>
      </View>

      {!!error && <Text style={styles.error}>{error}</Text>}
      {!!runResult && <Text style={styles.info}>{runResult}</Text>}

      {preview && (
        <View style={styles.previewWrap}>
          <Text style={styles.previewHeading}>
            From {formatDate(preview.date)} · {preview.eventCount} function{preview.eventCount === 1 ? "" : "s"}
          </Text>

          {preview.warnings.map((w) => (
            <Text key={w} style={styles.warn}>• {w}</Text>
          ))}
          {preview.sendResults.map((r) => (
            <Text key={r} style={styles.info}>• {r}</Text>
          ))}

          <View style={styles.checks}>
            <Check ok={preview.checks.eventMessageHasNoPaymentInfo} text="Message 1 contains no money information" />
            <Check ok={preview.checks.paymentMessageIsOwnerOnly} text="Message 2 goes to the owner only" />
            <Check ok={preview.checks.workersReceivingPaymentMessage === 0} text="Workers receive nothing" />
          </View>

          {preview.eventCount > 0 && (
            <>
              <MessageCard message={preview.eventMessage} accent="#8cc8f0" />
              <MessageCard message={preview.paymentMessage} accent="#f5c66b" />
            </>
          )}
        </View>
      )}

      {loading !== null && !preview && <ActivityIndicator color="#8cc8f0" style={{ marginTop: 14 }} />}
    </View>
  );
}

function Check({ ok, text }: { ok: boolean; text: string }) {
  return (
    <Text style={[styles.check, { color: ok ? "#6ee0ad" : "#ff9a93" }]}>
      {ok ? "✓" : "✕"} {text}
    </Text>
  );
}

function MessageCard({ message, accent }: { message: ReminderMessagePreview; accent: string }) {
  return (
    <View style={[styles.messageCard, { borderColor: accent }]}>
      <Text style={[styles.messageTitle, { color: accent }]}>{message.title}</Text>

      <ScrollView style={styles.messageBox} contentContainerStyle={{ padding: 12 }}>
        <Text style={styles.messageText} selectable>{message.text}</Text>
      </ScrollView>

      <Text style={styles.recipientsLabel}>Sent to</Text>
      {message.recipients.map((r) => (
        <View key={`${r.kind}-${r.name}`} style={styles.recipient}>
          <Text
            style={[
              styles.recipientTag,
              {
                backgroundColor: r.kind === "Owner" ? "rgba(242,189,92,0.18)" : "rgba(127,192,230,0.18)",
                color: r.kind === "Owner" ? "#f5c66b" : "#8cc8f0",
              },
            ]}
          >
            {r.kind}
          </Text>
          <Text style={styles.recipientName} numberOfLines={1}>
            {r.name}{r.phone ? ` · ${r.phone}` : ""}
          </Text>
          <Text style={[styles.recipientState, { color: r.willReceive ? "#6ee0ad" : "#6f83a0" }]}>
            {r.willReceive ? "will receive" : r.note ?? "not sent"}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { borderWidth: 1, borderColor: "#2c4463", borderRadius: 10, backgroundColor: "#172a42", padding: 16, marginTop: 16, gap: 10 },
  title: { color: "#e8edf3", fontSize: 15, fontWeight: "700" },
  caption: { color: "#9fb0c5", fontSize: 12, lineHeight: 18 },
  buttonRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 4 },
  primary: { backgroundColor: "#ff9a4d", borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16 },
  primaryText: { color: "#0b1522", fontWeight: "700", fontSize: 13 },
  secondary: { backgroundColor: "#0b1522", borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16, borderWidth: 1, borderColor: "#2c4463" },
  secondaryText: { color: "#8cc8f0", fontWeight: "600", fontSize: 13 },
  disabled: { opacity: 0.45 },
  error: { color: "#ff9a93", fontSize: 13 },
  info: { color: "#8cc8f0", fontSize: 12 },
  warn: { color: "#f5c66b", fontSize: 12, lineHeight: 18 },
  previewWrap: { gap: 10, marginTop: 6 },
  previewHeading: { color: "#e8edf3", fontSize: 13, fontWeight: "700" },
  checks: { backgroundColor: "#0b1522", borderRadius: 8, padding: 10, gap: 4 },
  check: { fontSize: 12, fontWeight: "600" },
  messageCard: { borderWidth: 1, borderRadius: 10, padding: 12, gap: 8, backgroundColor: "#122033" },
  messageTitle: { fontSize: 13, fontWeight: "800", letterSpacing: 0.4 },
  messageBox: { backgroundColor: "#0b1522", borderRadius: 8, maxHeight: 320 },
  messageText: { color: "#e8edf3", fontSize: 12.5, lineHeight: 19, fontFamily: "monospace" },
  recipientsLabel: { color: "#6f83a0", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 },
  recipient: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  recipientTag: { fontSize: 10, fontWeight: "800", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5, overflow: "hidden" },
  recipientName: { color: "#e8edf3", fontSize: 12, flexShrink: 1 },
  recipientState: { fontSize: 11 },
});
