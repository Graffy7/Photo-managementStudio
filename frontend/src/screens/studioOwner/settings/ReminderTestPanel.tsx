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
              <MessageCard message={preview.eventMessage} accent="#6d4aff" />
              <MessageCard message={preview.paymentMessage} accent="#f59e0b" />
            </>
          )}
        </View>
      )}

      {loading !== null && !preview && <ActivityIndicator color="#6d4aff" style={{ marginTop: 14 }} />}
    </View>
  );
}

function Check({ ok, text }: { ok: boolean; text: string }) {
  return (
    <Text style={[styles.check, { color: ok ? "#16a36a" : "#ef4444" }]}>
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
                backgroundColor: r.kind === "Owner" ? "rgba(245,158,11,0.18)" : "rgba(109,74,255,0.18)",
                color: r.kind === "Owner" ? "#f59e0b" : "#6d4aff",
              },
            ]}
          >
            {r.kind}
          </Text>
          <Text style={styles.recipientName} numberOfLines={1}>
            {r.name}{r.phone ? ` · ${r.phone}` : ""}
          </Text>
          <Text style={[styles.recipientState, { color: r.willReceive ? "#16a36a" : "#74758c" }]}>
            {r.willReceive ? "will receive" : r.note ?? "not sent"}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { borderWidth: 1, borderColor: "#d9dbec", borderRadius: 10, backgroundColor: "#f5f3ff", padding: 16, marginTop: 16, gap: 10 },
  title: { color: "#17172f", fontSize: 15, fontWeight: "700" },
  caption: { color: "#74758c", fontSize: 12, lineHeight: 18 },
  buttonRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 4 },
  primary: { backgroundColor: "#6d4aff", borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16 },
  primaryText: { color: "#f7f7ff", fontWeight: "700", fontSize: 13 },
  secondary: { backgroundColor: "#f7f7ff", borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16, borderWidth: 1, borderColor: "#d9dbec" },
  secondaryText: { color: "#6d4aff", fontWeight: "600", fontSize: 13 },
  disabled: { opacity: 0.45 },
  error: { color: "#ef4444", fontSize: 13 },
  info: { color: "#6d4aff", fontSize: 12 },
  warn: { color: "#f59e0b", fontSize: 12, lineHeight: 18 },
  previewWrap: { gap: 10, marginTop: 6 },
  previewHeading: { color: "#17172f", fontSize: 13, fontWeight: "700" },
  checks: { backgroundColor: "#f7f7ff", borderRadius: 8, padding: 10, gap: 4 },
  check: { fontSize: 12, fontWeight: "600" },
  messageCard: { borderWidth: 1, borderRadius: 10, padding: 12, gap: 8, backgroundColor: "#FFFFFF" },
  messageTitle: { fontSize: 13, fontWeight: "800", letterSpacing: 0.4 },
  messageBox: { backgroundColor: "#f7f7ff", borderRadius: 8, maxHeight: 320 },
  messageText: { color: "#17172f", fontSize: 13, lineHeight: 19, fontFamily: "monospace" },
  recipientsLabel: { color: "#74758c", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 },
  recipient: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  recipientTag: { fontSize: 12, fontWeight: "800", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5, overflow: "hidden" },
  recipientName: { color: "#17172f", fontSize: 12, flexShrink: 1 },
  recipientState: { fontSize: 12 },
});
