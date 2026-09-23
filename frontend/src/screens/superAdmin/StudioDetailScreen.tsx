import { useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, ActivityIndicator, Platform } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { studiosApi } from "../../api/studiosApi";
import { extractErrorMessage } from "../../api/errorMessage";
import { StatusPill } from "../../components/StatusPill";
import type { Studio } from "../../types/studio";

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";
}

function formatDateTime(value: string | null): string {
  if (!value) return "Never";
  return new Date(value.endsWith("Z") ? value : `${value}Z`).toLocaleString("en-IN", {
    day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit",
  });
}

// Everything the super admin needs about one studio in one place: its details, the owner's login, and
// the controls to change them. The owner's current password is deliberately absent — it is stored only
// as a one-way hash, so nobody (including this screen) can read it back. Set a new one instead.
export function StudioDetailScreen({ studio, onBack, onEdit }: { studio: Studio; onBack: () => void; onEdit: (studio: Studio) => void }) {
  const { data, isPending, refetch } = useQuery({
    queryKey: ["studio", studio.studioId],
    queryFn: () => studiosApi.getById(studio.studioId),
    initialData: studio,
  });

  const s = data ?? studio;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Pressable onPress={onBack} style={{ alignSelf: "flex-start", marginBottom: 8 }}>
            <Text style={styles.crumb}>‹ Studios</Text>
          </Pressable>
          <Text style={styles.title}>{s.studioName}</Text>
          <Text style={styles.subtitle}>Studio #{s.studioId} · added {formatDate(s.createdAt)}</Text>
        </View>
        <View style={styles.headerActions}>
          <StatusPill
            label={s.isBlocked ? "Blocked" : s.isActive ? "Active" : "Inactive"}
            tone={s.isBlocked ? "bad" : s.isActive ? "good" : "neutral"}
          />
          <Pressable style={styles.primary} onPress={() => onEdit(s)}>
            <Text style={styles.primaryText}>Edit details</Text>
          </Pressable>
        </View>
      </View>

      {isPending && <ActivityIndicator color="#7fc0e6" />}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Studio</Text>
        <Field label="Studio name" value={s.studioName} />
        <Field label="Owner name" value={s.ownerName} />
        <Field label="Phone number" value={s.phoneNumber} hint="Used for the WhatsApp reminders" />
        <Field label="Address" value={s.address} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Owner login</Text>
        <Field label="Login email" value={s.loginEmail ?? s.email} hint="What the owner types on the login page" copyable />
        <Field label="Password" value={"•".repeat(10)} hint="Scrambled when saved, so it can never be shown — not even here. Set a new one below if they are locked out." />
        <Field label="Account" value={s.ownerUserId === null ? "No login account" : s.ownerIsActive ? "Active" : "Disabled"} />
        <Field label="Last signed in" value={formatDateTime(s.ownerLastLoginAt)} />
      </View>

      <ResetPasswordCard studio={s} onDone={() => refetch()} />

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Subscription</Text>
        <Field label="Plan" value={s.planName} />
        <Field label="Status" value={s.subscriptionStatus} />
        <Field label="Started" value={formatDate(s.subscriptionStartDate)} />
        <Field label="Renews" value={formatDate(s.subscriptionEndDate)} />
      </View>
    </ScrollView>
  );
}

function Field({ label, value, hint, copyable }: { label: string; value: string | null | undefined; hint?: string; copyable?: boolean }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!value || Platform.OS !== "web" || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked — the value is selectable on screen anyway.
    }
  };

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.fieldValueRow}>
        <Text style={[styles.fieldValue, !value && styles.fieldEmpty]} selectable>
          {value && value.length > 0 ? value : "Not set"}
        </Text>
        {copyable && !!value && (
          <Pressable onPress={copy} hitSlop={6}>
            <Text style={styles.copyLink}>{copied ? "Copied" : "Copy"}</Text>
          </Pressable>
        )}
      </View>
      {!!hint && <Text style={styles.fieldHint}>{hint}</Text>}
    </View>
  );
}

function ResetPasswordCard({ studio, onDone }: { studio: Studio; onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const tooShort = password.length > 0 && password.length < 8;
  const mismatch = confirm.length > 0 && password !== confirm;
  const canSave = password.length >= 8 && password === confirm && !saving;

  const save = async () => {
    setSaving(true);
    setError(null);
    setDone(null);
    try {
      const result = await studiosApi.resetOwnerPassword(studio.studioId, password);
      // Shown once, here, so it can be passed on — it is never stored anywhere readable.
      setDone(`New password set for ${result.loginEmail}: ${password}`);
      setPassword("");
      setConfirm("");
      onDone();
    } catch (err) {
      setError(extractErrorMessage(err, "Couldn't set the new password."));
    } finally {
      setSaving(false);
    }
  };

  if (studio.ownerUserId === null) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Set a new password</Text>
        <Text style={styles.warn}>This studio has no owner login account, so there is no password to set.</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Set a new password</Text>
      <Text style={styles.cardHint}>
        Use this when the owner is locked out. It replaces their password straight away — tell them the new one,
        and ask them to change it after signing in.
      </Text>

      <View style={styles.inputRow}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          value={password}
          onChangeText={setPassword}
          placeholder="New password (at least 8 characters)"
          placeholderTextColor="#6f83a0"
          secureTextEntry={!show}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Pressable style={styles.secondary} onPress={() => setShow((v) => !v)}>
          <Text style={styles.secondaryText}>{show ? "Hide" : "Show"}</Text>
        </Pressable>
      </View>
      {tooShort && <Text style={styles.error}>Use at least 8 characters.</Text>}

      <TextInput
        style={styles.input}
        value={confirm}
        onChangeText={setConfirm}
        placeholder="Type it again"
        placeholderTextColor="#6f83a0"
        secureTextEntry={!show}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {mismatch && <Text style={styles.error}>The two passwords don't match.</Text>}

      <Pressable style={[styles.primary, !canSave && styles.disabled]} disabled={!canSave} onPress={save}>
        <Text style={styles.primaryText}>{saving ? "Saving…" : "Set new password"}</Text>
      </Pressable>

      {!!error && <Text style={styles.error}>{error}</Text>}
      {!!done && (
        <View style={styles.doneBox}>
          <Text style={styles.doneText} selectable>{done}</Text>
          <Text style={styles.doneHint}>Copy this now — it can't be shown again once you leave this screen.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0d1826" },
  content: { padding: 24, paddingBottom: 48, width: "100%", maxWidth: 900, alignSelf: "center" },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 18, flexWrap: "wrap" },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  crumb: { color: "#7fc0e6", fontWeight: "600", fontSize: 13 },
  title: { fontSize: 24, fontWeight: "700", color: "#e8edf3" },
  subtitle: { fontSize: 13, color: "#6f83a0", marginTop: 3 },

  card: { backgroundColor: "#132540", borderRadius: 12, borderWidth: 1, borderColor: "#23405c", padding: 18, marginBottom: 14, gap: 4 },
  cardTitle: { color: "#e8edf3", fontSize: 15, fontWeight: "700", marginBottom: 6 },
  cardHint: { color: "#a7b7cb", fontSize: 12, lineHeight: 18, marginBottom: 8 },

  field: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#1b2c42", gap: 2 },
  fieldLabel: { color: "#6f83a0", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 },
  fieldValueRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  fieldValue: { color: "#e8edf3", fontSize: 14, flexShrink: 1 },
  fieldEmpty: { color: "#4a5d78", fontStyle: "italic" },
  fieldHint: { color: "#6f83a0", fontSize: 11 },
  copyLink: { color: "#7fc0e6", fontSize: 12, fontWeight: "700" },

  inputRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  input: {
    borderWidth: 1, borderColor: "#23405c", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
    color: "#e8edf3", backgroundColor: "#0d1826", fontSize: 14, marginTop: 8,
  },
  primary: { backgroundColor: "#ff9a4d", borderRadius: 8, paddingVertical: 11, paddingHorizontal: 18, alignItems: "center", marginTop: 12, alignSelf: "flex-start" },
  primaryText: { color: "#0d1826", fontWeight: "700", fontSize: 13 },
  secondary: { backgroundColor: "#0d1826", borderRadius: 8, paddingVertical: 10, paddingHorizontal: 14, borderWidth: 1, borderColor: "#23405c", marginTop: 8 },
  secondaryText: { color: "#7fc0e6", fontWeight: "600", fontSize: 13 },
  disabled: { opacity: 0.45 },

  error: { color: "#ff7a72", fontSize: 12, marginTop: 6 },
  warn: { color: "#f2bd5c", fontSize: 13 },
  doneBox: { backgroundColor: "rgba(76,196,147,0.12)", borderRadius: 8, borderWidth: 1, borderColor: "rgba(76,196,147,0.4)", padding: 12, marginTop: 12, gap: 4 },
  doneText: { color: "#8fdcbc", fontSize: 13, fontWeight: "700" },
  doneHint: { color: "#6f83a0", fontSize: 11 },
});
