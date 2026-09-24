import { useState } from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import { useMutation, useQuery } from "@tanstack/react-query";
import { adminConsoleApi } from "../../../../api/adminConsoleApi";
import { extractErrorMessage } from "../../../../api/errorMessage";
import { Button, C, Card, ConfirmDialog, DaysLeft, ErrorState, Field, Loading, StatusBadge, date, s } from "../ui";

type Action = "start" | "extend" | "end";

const QUICK_DAYS = [7, 14, 30];

export function TrialTab({ studioId, onChanged, onConvert }: { studioId: number; onChanged: () => void; onConvert: () => void }) {
  const [days, setDays] = useState("14");
  const [pending, setPending] = useState<Action | null>(null);

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["admin-subscription", studioId],
    queryFn: () => adminConsoleApi.subscription(studioId),
  });

  const run = useMutation({
    mutationFn: (action: Action) =>
      action === "start" ? adminConsoleApi.startTrial(studioId, Number(days))
        : action === "extend" ? adminConsoleApi.extendTrial(studioId, Number(days))
          : adminConsoleApi.endTrial(studioId),
    onSuccess: () => { setPending(null); refetch(); onChanged(); },
  });

  if (isPending) return <Loading />;
  if (isError || !data) return <ErrorState text="Couldn't load the trial." onRetry={refetch} />;

  const n = parseInt(days || "0", 10) || 0;
  const validDays = n >= 1 && n <= 3650;
  const trialRunning = data.isTrial && data.status === "Trial";
  const trialEnded = data.isTrial && data.status === "Expired";
  const paidRunning = !data.isTrial && data.status === "Active" && data.paymentCount > 0;

  const now = new Date();
  const addDays = (from: Date, d: number) => { const x = new Date(from); x.setDate(x.getDate() + d); return x; };
  const end = data.endDate ? new Date(/[zZ]$/.test(data.endDate) ? data.endDate : `${data.endDate}Z`) : null;
  const newEnd = pending === "extend"
    ? addDays(trialRunning && end && end > now ? end : now, n)
    : addDays(now, n);

  const dialog: Record<Action, { title: string; message: string; label: string; danger?: boolean }> = {
    start: { title: `Start a ${n}-day trial?`, message: `The studio gets full access until ${date(newEnd.toISOString())}.`, label: "Start trial" },
    extend: { title: `Extend the trial by ${n} days?`, message: `The trial will end on ${date(newEnd.toISOString())}.`, label: "Extend trial" },
    end: { title: "End the trial now?", message: "The trial stops today and the studio shows as expired until it pays or gets a new trial.", label: "End trial", danger: true },
  };

  return (
    <View style={{ gap: 16 }}>
      <Card title="Trial status">
        <View style={styles.fields}>
          <Field label="Status"><StatusBadge status={data.status} /></Field>
          <Field label="On trial" value={data.isTrial ? "Yes" : "No"} />
          <Field label={data.isTrial ? "Trial started" : "Started"} value={date(data.startDate)} />
          <Field label={data.isTrial ? "Trial ends" : "Ends"} value={date(data.endDate)} />
          <Field label="Days remaining"><DaysLeft status={data.status} days={data.daysRemaining} /></Field>
        </View>
      </Card>

      <Card title={trialRunning ? "Manage the trial" : "Start a trial"}>
        {paidRunning ? (
          <Text style={s.faint}>This studio has a paid subscription running, so a trial can't start until it ends.</Text>
        ) : (
          <>
            <Text style={s.faint}>
              {trialRunning
                ? "Add days to the running trial, end it early, or convert it to a paid subscription."
                : trialEnded
                  ? "The last trial has ended. Extend it (it restarts from today), or convert the studio to a paid subscription."
                  : "Give the studio full access for any number of days. Expiry and days remaining are worked out automatically."}
            </Text>
            <View style={styles.daysRow}>
              <View style={{ width: 120, gap: 6 }}>
                <Text style={s.fieldLabel}>Days</Text>
                <TextInput style={s.input} value={days} onChangeText={(v) => setDays(v.replace(/\D/g, "").slice(0, 4))}
                  keyboardType="number-pad" placeholder="14" placeholderTextColor={C.faint} />
              </View>
              {QUICK_DAYS.map((d) => <Button key={d} label={`${d} days`} small onPress={() => setDays(String(d))} />)}
            </View>
            {!validDays && days.length > 0 && <Text style={s.errorText}>Enter between 1 and 3650 days.</Text>}
            <View style={styles.actions}>
              {trialRunning || trialEnded ? (
                <Button label={`Extend by ${n || 0} days`} kind="primary" icon="add" disabled={!validDays} onPress={() => setPending("extend")} />
              ) : (
                <Button label={`Start ${n || 0}-day trial`} kind="primary" icon="play" disabled={!validDays} onPress={() => setPending("start")} />
              )}
              {trialRunning && <Button label="End trial now" kind="danger" icon="stop-circle-outline" onPress={() => setPending("end")} />}
              {(trialRunning || trialEnded) && <Button label="Convert to paid" icon="card-outline" onPress={onConvert} />}
            </View>
          </>
        )}
      </Card>

      <ConfirmDialog
        visible={!!pending}
        title={pending ? dialog[pending].title : ""}
        message={pending ? dialog[pending].message : ""}
        confirmLabel={pending ? dialog[pending].label : ""}
        danger={pending ? dialog[pending].danger : false}
        busy={run.isPending}
        error={run.isError ? extractErrorMessage(run.error) : null}
        onConfirm={() => pending && run.mutate(pending)}
        onCancel={() => { setPending(null); run.reset(); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fields: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  daysRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, flexWrap: "wrap" },
  actions: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
});
