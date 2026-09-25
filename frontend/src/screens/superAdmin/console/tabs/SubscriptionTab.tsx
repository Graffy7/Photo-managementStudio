import { useEffect, useMemo, useState } from "react";
import { View, Text, TextInput, ScrollView, StyleSheet, useWindowDimensions } from "react-native";
import { useMutation, useQuery } from "@tanstack/react-query";
import { adminConsoleApi } from "../../../../api/adminConsoleApi";
import { subscriptionPlansApi } from "../../../../api/subscriptionPlansApi";
import { extractErrorMessage } from "../../../../api/errorMessage";
import { MiniDatePicker } from "../../../../components/MiniDatePicker";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from "../../../../types/payment";
import type { AdminStudioRow } from "../../../../types/adminConsole";
import { AccessControl, ChangePlan } from "./AccessControl";
import {
  Button, C, Card, Chips, ConfirmDialog, DaysLeft, EmptyState, ErrorState, Field, Loading, StatusBadge,
  date, isoDay, money, s,
} from "../ui";

export function SubscriptionTab({ studioId, row, openForm, onFormOpened, onChanged }: {
  studioId: number; row: AdminStudioRow; openForm: boolean; onFormOpened: () => void; onChanged: () => void;
}) {
  const narrow = useWindowDimensions().width < 760;
  const [showForm, setShowForm] = useState(openForm);
  useEffect(() => { if (openForm) { setShowForm(true); onFormOpened(); } }, [openForm, onFormOpened]);

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["admin-subscription", studioId],
    queryFn: () => adminConsoleApi.subscription(studioId),
  });

  if (isPending) return <Loading />;
  if (isError || !data) return <ErrorState text="Couldn't load the subscription." onRetry={refetch} />;

  return (
    <View style={{ gap: 16 }}>
      <Card title="Current subscription" action={!showForm && <Button label="Record payment" icon="add" kind="primary" small onPress={() => setShowForm(true)} />}>
        <View style={styles.fields}>
          <Field label="Status"><StatusBadge status={data.status} /></Field>
          <Field label="Plan" value={data.planName} />
          <Field label="Start" value={date(data.startDate)} />
          <Field label="End" value={date(data.endDate)} />
          <Field label="Days remaining"><DaysLeft status={data.status} days={data.daysRemaining} /></Field>
          <Field label="Months purchased" value={String(data.monthsPurchased)} />
          <Field label="Payments" value={String(data.paymentCount)} />
          <Field label="Total paid" value={money(data.totalPaid)} />
        </View>
      </Card>

      <AccessControl row={row} onChanged={() => { refetch(); onChanged(); }} />

      <ManualControl studioId={studioId} running={data.status === "Active" || data.status === "Trial"} endDate={data.endDate} onChanged={() => { refetch(); onChanged(); }} />

      {showForm && (
        <PaymentForm
          studioId={studioId}
          isTrial={data.isTrial && data.status === "Trial"}
          currentPlanId={data.subscriptionPlanId}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); refetch(); onChanged(); }}
        />
      )}

      <ChangePlan studioId={studioId} currentPlanId={data.isTrial ? null : data.subscriptionPlanId} onChanged={() => { refetch(); onChanged(); }} />

      <Card title="Payment history">
        {data.payments.length === 0 ? (
          <EmptyState icon="receipt-outline" title="No payments yet" text="Payments you record here appear in this list." />
        ) : narrow ? (
          <View style={{ gap: 10 }}>
            {data.payments.map((p) => (
              <View key={p.paymentId} style={styles.mRow}>
                <View style={styles.mTop}>
                  <Text style={styles.amount}>{money(p.amount)}</Text>
                  <Text style={s.faint}>{date(p.paymentDate)}</Text>
                </View>
                <Text style={s.faint}>
                  {p.periodStart ? `${date(p.periodStart)} – ${date(p.periodEnd)}` : "Period not recorded"} · {p.months} month{p.months === 1 ? "" : "s"}
                </Text>
                <Text style={s.faint}>{methodLabel(p.paymentMethod)}{p.referenceNumber ? ` · ${p.referenceNumber}` : ""}</Text>
              </View>
            ))}
          </View>
        ) : (
          <ScrollView horizontal contentContainerStyle={{ minWidth: "100%" }}>
            <View style={{ width: "100%", minWidth: 760 }}>
              <View style={[styles.tr, styles.thead]}>
                {["Amount", "Payment date", "Subscription period", "Months", "Method", "Transaction / reference"].map((h, i) => (
                  <Text key={h} style={[styles.th, { flex: WIDTHS[i] }]}>{h}</Text>
                ))}
              </View>
              {data.payments.map((p) => (
                <View key={p.paymentId} style={styles.tr}>
                  <Text style={[styles.amount, { flex: WIDTHS[0] }]}>{money(p.amount)}</Text>
                  <Text style={[styles.cell, { flex: WIDTHS[1] }]}>{date(p.paymentDate)}</Text>
                  <Text style={[styles.cell, { flex: WIDTHS[2] }]}>{p.periodStart ? `${date(p.periodStart)} – ${date(p.periodEnd)}` : "—"}</Text>
                  <Text style={[styles.cell, { flex: WIDTHS[3] }]}>{p.months || "—"}</Text>
                  <Text style={[styles.cell, { flex: WIDTHS[4] }]}>{methodLabel(p.paymentMethod)}</Text>
                  <Text style={[styles.cellMuted, { flex: WIDTHS[5] }]} numberOfLines={1}>{p.referenceNumber ?? p.notes ?? "—"}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        )}
      </Card>
    </View>
  );
}

const WIDTHS = [1, 1.1, 1.8, 0.6, 0.9, 1.6];

// Free days (goodwill, support) or ending access now. Paid time is added with "Record payment".
function ManualControl({ studioId, running, endDate, onChanged }: { studioId: number; running: boolean; endDate: string | null; onChanged: () => void }) {
  const [days, setDays] = useState("7");
  const [pending, setPending] = useState<"extend" | "expire" | null>(null);
  const n = parseInt(days || "0", 10) || 0;
  const valid = n >= 1 && n <= 3650;
  const base = running && endDate ? new Date(/[zZ]$/.test(endDate) ? endDate : `${endDate}Z`) : new Date();
  const newEnd = new Date(base); newEnd.setDate(newEnd.getDate() + n);

  const run = useMutation({
    mutationFn: (a: "extend" | "expire") => (a === "extend" ? adminConsoleApi.extendSubscription(studioId, n) : adminConsoleApi.expireSubscription(studioId)),
    onSuccess: () => { setPending(null); onChanged(); },
  });

  return (
    <Card title="Manual control">
      <Text style={s.faint}>Give free days (the studio keeps its plan) or end access now. The studio's data is never deleted.</Text>
      <View style={styles.controlRow}>
        <View style={{ width: 110, gap: 6 }}>
          <Text style={s.fieldLabel}>Days</Text>
          <TextInput style={s.input} value={days} onChangeText={(v) => setDays(v.replace(/\D/g, "").slice(0, 4))} keyboardType="number-pad" />
        </View>
        <Button label={`Extend by ${n || 0} days`} icon="add" disabled={!valid} onPress={() => setPending("extend")} />
        {running && <Button label="Expire now" kind="danger" icon="stop-circle-outline" onPress={() => setPending("expire")} />}
      </View>
      <ConfirmDialog
        visible={!!pending}
        title={pending === "expire" ? "Expire this subscription now?" : `Add ${n} free days?`}
        message={pending === "expire"
          ? "The studio loses access straight away and sees the renewal page. Nothing is deleted; paying again restores access."
          : `Access will run until ${date(newEnd.toISOString())}.`}
        confirmLabel={pending === "expire" ? "Expire now" : "Add days"}
        danger={pending === "expire"}
        busy={run.isPending}
        error={run.isError ? extractErrorMessage(run.error) : null}
        onConfirm={() => pending && run.mutate(pending)}
        onCancel={() => { setPending(null); run.reset(); }}
      />
    </Card>
  );
}

function methodLabel(m: string): string {
  return (PAYMENT_METHOD_LABELS as Record<string, string>)[m] ?? m;
}

function PaymentForm({ studioId, isTrial, currentPlanId, onClose, onSaved }: {
  studioId: number; isTrial: boolean; currentPlanId: number | null; onClose: () => void; onSaved: () => void;
}) {
  const { data: plans } = useQuery({ queryKey: ["subscription-plans"], queryFn: subscriptionPlansApi.getActive });
  const [planId, setPlanId] = useState<number | null>(currentPlanId);
  const [months, setMonths] = useState("1");
  // Picking a plan fills in its own length (still editable).
  const pickPlan = (id: number) => {
    setPlanId(id);
    const p = plans?.find((x) => x.subscriptionPlanId === id);
    if (p?.durationMonths) setMonths(String(p.durationMonths));
    setAmountTouched(false);
  };
  const [amount, setAmount] = useState("");
  const [amountTouched, setAmountTouched] = useState(false);
  const [paymentDate, setPaymentDate] = useState(isoDay(new Date()));
  const [method, setMethod] = useState<string>("UPI");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [confirming, setConfirming] = useState(false);

  useEffect(() => { if (planId === null && plans?.length) setPlanId(plans[0].subscriptionPlanId); }, [plans, planId]);
  const plan = plans?.find((p) => p.subscriptionPlanId === planId);
  const monthsNum = Math.max(0, parseInt(months || "0", 10) || 0);

  // Suggested amount: the plan's monthly price times the months (still editable).
  const suggested = useMemo(() => {
    if (!plan || monthsNum === 0) return null;
    const perMonth = plan.price / Math.max(1, plan.durationMonths || plan.durationInDays / 30.4375);
    return Math.round(perMonth * monthsNum);
  }, [plan, monthsNum]);
  useEffect(() => { if (!amountTouched && suggested !== null) setAmount(String(suggested)); }, [suggested, amountTouched]);

  const save = useMutation({
    mutationFn: () => adminConsoleApi.recordPayment(studioId, {
      subscriptionPlanId: planId ?? undefined,
      months: monthsNum,
      amount: Number(amount),
      paymentDate,
      paymentMethod: method,
      referenceNumber: reference.trim() || undefined,
      notes: notes.trim() || undefined,
    }),
    onSuccess: () => { setConfirming(false); onSaved(); },
  });

  const valid = Number(amount) > 0 && monthsNum <= 120 && !!paymentDate;
  const effect = monthsNum === 0
    ? "Only the payment is recorded; the subscription dates don't change."
    : isTrial
      ? `The trial ends now and a paid ${plan?.planName ?? ""} subscription starts today for ${monthsNum} month${monthsNum === 1 ? "" : "s"}.`
      : `${monthsNum} month${monthsNum === 1 ? "" : "s"} ${monthsNum === 1 ? "is" : "are"} added after the current end date (or from today if it has already ended).`;

  return (
    <Card title={isTrial ? "Convert trial to paid" : "Record a payment"} action={<Button label="Cancel" kind="ghost" small onPress={onClose} />}>
      <View style={styles.form}>
        <View style={styles.formField}>
          <Text style={s.fieldLabel}>Plan</Text>
          <Chips options={(plans ?? []).map((p) => ({ key: String(p.subscriptionPlanId), label: `${p.planName} · ${money(p.price)}` }))}
            value={String(planId ?? "")} onChange={(v) => pickPlan(Number(v))} />
        </View>
        <View style={styles.formRow}>
          <View style={styles.formField}>
            <Text style={s.fieldLabel}>Months</Text>
            <TextInput style={s.input} value={months} onChangeText={(v) => { setMonths(v.replace(/\D/g, "").slice(0, 3)); setAmountTouched(false); }}
              keyboardType="number-pad" placeholder="0" placeholderTextColor={C.faint} />
          </View>
          <View style={styles.formField}>
            <Text style={s.fieldLabel}>Amount (₹)</Text>
            <TextInput style={s.input} value={amount} onChangeText={(v) => { setAmount(v.replace(/[^0-9.]/g, "")); setAmountTouched(true); }}
              keyboardType="numeric" placeholder="Amount paid" placeholderTextColor={C.faint} />
          </View>
          <View style={styles.formField}>
            <Text style={s.fieldLabel}>Payment date</Text>
            <MiniDatePicker variant="form" value={paymentDate} onChange={setPaymentDate} />
          </View>
        </View>
        <View style={styles.formField}>
          <Text style={s.fieldLabel}>Method</Text>
          <Chips options={PAYMENT_METHODS.map((m) => ({ key: m, label: PAYMENT_METHOD_LABELS[m] }))} value={method} onChange={setMethod} />
        </View>
        <View style={styles.formRow}>
          <View style={styles.formField}>
            <Text style={s.fieldLabel}>Transaction / reference ID</Text>
            <TextInput style={s.input} value={reference} onChangeText={setReference} placeholder="Optional" placeholderTextColor={C.faint} maxLength={100} />
          </View>
          <View style={styles.formField}>
            <Text style={s.fieldLabel}>Notes</Text>
            <TextInput style={s.input} value={notes} onChangeText={setNotes} placeholder="Optional" placeholderTextColor={C.faint} maxLength={500} />
          </View>
        </View>
        <Text style={s.faint}>{effect}</Text>
        <View style={{ alignSelf: "flex-start" }}>
          <Button label={isTrial ? "Convert to paid" : "Record payment"} kind="primary" icon="checkmark" disabled={!valid} onPress={() => setConfirming(true)} />
        </View>
      </View>

      <ConfirmDialog
        visible={confirming}
        title={`Record ${money(Number(amount) || 0)}?`}
        message={`${methodLabel(method)} payment on ${date(paymentDate)}. ${effect}`}
        confirmLabel="Record payment"
        busy={save.isPending}
        error={save.isError ? extractErrorMessage(save.error) : null}
        onConfirm={() => save.mutate()}
        onCancel={() => { setConfirming(false); save.reset(); }}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  fields: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  tr: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: C.border },
  thead: { paddingVertical: 8 },
  th: { color: C.faint, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  amount: { color: C.text, fontSize: 13.5, fontWeight: "700", fontVariant: ["tabular-nums"] },
  cell: { color: C.text, fontSize: 13 },
  cellMuted: { color: C.muted, fontSize: 12.5 },
  mRow: { borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 12, gap: 4, backgroundColor: C.raised },
  mTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  form: { gap: 14 },
  formRow: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  formField: { flexGrow: 1, flexBasis: 200, gap: 6 },
  controlRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, flexWrap: "wrap" },
});
