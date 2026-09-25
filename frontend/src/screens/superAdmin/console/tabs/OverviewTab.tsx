import { useState } from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { studiosApi } from "../../../../api/studiosApi";
import { adminConsoleApi } from "../../../../api/adminConsoleApi";
import { extractErrorMessage } from "../../../../api/errorMessage";
import { Button, C, Card, DaysLeft, Field, StatCard, StatusBadge, ago, date, dateTime, minutes, money, s } from "../ui";
import type { AdminStudioDetail } from "../../../../types/adminConsole";

export function OverviewTab({ detail, onRefresh }: { detail: AdminStudioDetail; onRefresh: () => void }) {
  const st = detail.studio;
  const u = detail.usage;
  const running = st.status === "Active" || st.status === "Trial";

  return (
    <View style={{ gap: 16 }}>
      <View style={styles.stats}>
        <StatCard label="Days remaining" value={running ? String(st.daysRemaining) : "—"} icon="calendar-outline"
          tone={running && st.daysRemaining <= 7 ? C.warn : undefined} hint={st.endDate ? `Ends ${date(st.endDate)}` : "No end date"} />
        <StatCard label="Months subscribed" value={String(st.monthsSubscribed)} icon="repeat-outline" hint={`${st.paymentCount} payment${st.paymentCount === 1 ? "" : "s"}`} />
        <StatCard label="Total paid" value={money(st.totalPaid)} icon="wallet-outline" tone={C.good} />
        <StatCard label="Last login" value={ago(detail.lastLoginAt)} icon="log-in-outline" hint={dateTime(detail.lastLoginAt)} />
      </View>

      <View style={styles.row}>
        <Card title="Subscription" style={styles.flex}>
          <View style={styles.fields}>
            <Field label="Status"><StatusBadge status={st.status} /></Field>
            <Field label="Plan" value={st.planName} />
            <Field label="Days remaining"><DaysLeft status={st.status} days={st.daysRemaining} /></Field>
            <Field label={st.isTrial ? "Trial started" : "Started"} value={date(st.startDate)} />
            <Field label={st.isTrial ? "Trial ends" : "Ends"} value={date(st.endDate)} />
            <Field label="Member since" value={date(st.createdAt)} />
          </View>
        </Card>

        <Card title="Usage" style={styles.flex}>
          <View style={styles.fields}>
            <Field label="Today" value={minutes(u.todayMinutes)} />
            <Field label="Last 7 days" value={minutes(u.last7DaysMinutes)} />
            <Field label="Last 30 days" value={minutes(u.last30DaysMinutes)} />
            <Field label="Active days (30)" value={`${u.activeDaysLast30} of 30`} />
            <Field label="Last active" value={ago(st.lastActiveAt)} />
          </View>
          <Text style={s.faint}>Active time counts while the studio is using the app (idle for 5 minutes ends a stretch).</Text>
        </Card>
      </View>

      <View style={styles.row}>
        <Card title="Studio details" style={styles.flex}>
          <View style={styles.fields}>
            <Field label="Owner" value={st.ownerName} />
            <Field label="Login email" value={detail.loginEmail} />
            <Field label="Phone" value={st.phoneNumber} />
            <Field label="Address" value={[detail.address, detail.city].filter(Boolean).join(", ")} />
          </View>
        </Card>
        <ResetPasswordCard studioId={st.studioId} onDone={onRefresh} />
      </View>

      <View style={styles.row}>
        <PhotoRootCard studioId={st.studioId} />
      </View>
    </View>
  );
}

// Where this studio's original photos live on the server. The studio can only browse, import and
// copy photos inside it, and no two studios may share or nest folders.
function PhotoRootCard({ studioId }: { studioId: number }) {
  const { data, refetch } = useQuery({ queryKey: ["admin-photo-root", studioId], queryFn: () => adminConsoleApi.getPhotoRoot(studioId) });
  const [path, setPath] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const value = path ?? (data?.setByAdmin ? data.root ?? "" : "");

  const save = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await adminConsoleApi.setPhotoRoot(studioId, value.trim());
      setPath(null);
      setSaved(true);
      await refetch();
    } catch (err) {
      setError(extractErrorMessage(err, "Couldn't save the photo folder."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title="Photo folder" style={styles.flex}>
      <Text style={s.faint}>
        The only folder on the server this studio can pick photos from. Folders outside it, other studios' folders,
        drive roots and system folders are refused.
      </Text>
      <View style={styles.fields}>
        <Field label="Current folder" value={data?.root ?? "Not set — this studio can't import photos"} />
      </View>
      {data?.fromBaseFolder && <Text style={s.faint}>Using the default folder for every studio (PhotoGallery:StudioRootBase).</Text>}
      <View style={styles.inputRow}>
        <TextInput style={[s.input, { flex: 1 }]} value={value} onChangeText={(v) => { setPath(v); setSaved(false); }}
          placeholder={"e.g. D:\\Studios\\Shagul Photography"} placeholderTextColor={C.faint} autoCapitalize="none" autoCorrect={false} />
        <Button label="Save" kind="primary" onPress={save} busy={saving} disabled={saving || path === null} small />
      </View>
      {!!error && <Text style={s.errorText}>{error}</Text>}
      {saved && <Text style={{ color: C.good, fontSize: 13 }}>Saved.</Text>}
    </Card>
  );
}

// Carried over from the old studio page: sets a new owner password when they're locked out.
function ResetPasswordCard({ studioId, onDone }: { studioId: number; onDone: () => void }) {
  const { data: studio } = useQuery({ queryKey: ["studio", studioId], queryFn: () => studiosApi.getById(studioId) });
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const canSave = password.length >= 8 && password === confirm && !saving;

  const save = async () => {
    setSaving(true);
    setError(null);
    setDone(null);
    try {
      const result = await studiosApi.resetOwnerPassword(studioId, password);
      // Shown once, here, so it can be passed on - it is never stored anywhere readable.
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

  return (
    <Card title="Owner password" style={styles.flex}>
      {studio && studio.ownerUserId === null ? (
        <Text style={s.faint}>This studio has no owner login account, so there is no password to set.</Text>
      ) : (
        <View style={{ gap: 8 }}>
          <Text style={s.faint}>For a locked-out owner: replaces their password straight away. Tell them the new one and ask them to change it.</Text>
          <View style={styles.inputRow}>
            <TextInput style={[s.input, { flex: 1 }]} value={password} onChangeText={setPassword} placeholder="New password (8+ characters)"
              placeholderTextColor={C.faint} secureTextEntry={!show} autoCapitalize="none" autoCorrect={false} />
            <Button label={show ? "Hide" : "Show"} onPress={() => setShow((v) => !v)} small />
          </View>
          <TextInput style={s.input} value={confirm} onChangeText={setConfirm} placeholder="Type it again" placeholderTextColor={C.faint}
            secureTextEntry={!show} autoCapitalize="none" autoCorrect={false} />
          {password.length > 0 && password.length < 8 && <Text style={s.errorText}>Use at least 8 characters.</Text>}
          {confirm.length > 0 && password !== confirm && <Text style={s.errorText}>The two passwords don't match.</Text>}
          <View style={{ alignSelf: "flex-start" }}>
            <Button label="Set new password" kind="primary" onPress={save} disabled={!canSave} busy={saving} small />
          </View>
          {!!error && <Text style={s.errorText}>{error}</Text>}
          {!!done && (
            <View style={styles.doneBox}>
              <Text style={styles.doneText} selectable>{done}</Text>
              <Text style={s.faint}>Copy it now — it isn't shown again once you leave.</Text>
            </View>
          )}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  flex: { flexGrow: 1, flexBasis: 360, minWidth: 0 },
  fields: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  inputRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  doneBox: { borderWidth: 1, borderColor: "rgba(76,196,147,0.4)", backgroundColor: "rgba(76,196,147,0.08)", borderRadius: 8, padding: 10, gap: 4 },
  doneText: { color: C.good, fontSize: 13, fontWeight: "600" },
});
