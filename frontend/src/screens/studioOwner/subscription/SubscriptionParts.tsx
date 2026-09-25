import { useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator, ScrollView, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { billingApi } from "../../../api/billingApi";
import { extractErrorMessage } from "../../../api/errorMessage";
import { openRazorpayCheckout } from "../../../utils/razorpayCheckout";
import type { BillingHistoryItem, Plan, SubscriptionStatus } from "../../../types/billing";

export const T = {
  page: "#0d1826", surface: "#0f1e30", raised: "#132540", border: "#1b2c42", text: "#e8edf3",
  muted: "#a7b7cb", faint: "#6f83a0", accent: "#7fc0e6", brand: "#ff9a4d", good: "#4cc493", warn: "#f2bd5c", bad: "#ff7a72",
};

const asUtc = (v: string) => new Date(/[zZ]|[+-]\d\d:\d\d$/.test(v) ? v : `${v}Z`);
export const fmtDate = (v: string | null | undefined) =>
  v ? asUtc(v).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";
export const fmtMoney = (v: number) => `₹${v.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

const METHOD_LABELS: Record<string, string> = {
  upi: "UPI", card: "Card", netbanking: "Net banking", wallet: "Wallet", emi: "EMI",
  UPI: "UPI", Card: "Card", BankTransfer: "Bank transfer", Cash: "Cash", Other: "Other",
};

type Stage = { kind: "idle" } | { kind: "busy"; planId: number; text: string } | { kind: "done"; text: string } | { kind: "error"; text: string };

// The four plans with a Buy / Renew button each. Buying opens the payment provider's checkout;
// access changes only after the server has verified the payment.
export function PlanPicker({ status, highlightRenew }: { status: SubscriptionStatus; highlightRenew?: boolean }) {
  const queryClient = useQueryClient();
  const [stage, setStage] = useState<Stage>({ kind: "idle" });
  const wide = useWindowDimensions().width >= 1000;
  const bestValue = status.plans.reduce<Plan | null>((best, p) => (!best || p.pricePerMonth < best.pricePerMonth ? p : best), null);
  const renewing = status.hasAccess && !status.isTrial;

  const buy = async (plan: Plan) => {
    setStage({ kind: "busy", planId: plan.planId, text: "Opening secure payment…" });
    try {
      const checkout = await billingApi.checkout(plan.planId);
      const outcome = await openRazorpayCheckout(checkout, (reason) =>
        setStage({ kind: "busy", planId: plan.planId, text: `${reason} You can try another payment method.` }));

      if (outcome.kind === "paid") {
        setStage({ kind: "busy", planId: plan.planId, text: "Confirming your payment…" });
        const updated = await billingApi.verify(outcome);
        // Everything the studio sees may have been waiting on this (e.g. after an expiry).
        queryClient.invalidateQueries();
        setStage({ kind: "done", text: `Payment received — ${plan.name} is active until ${fmtDate(updated.expiryDate)}.` });
      } else if (outcome.kind === "failed") {
        await billingApi.failed(outcome.orderId, outcome.reason).catch(() => undefined);
        queryClient.invalidateQueries({ queryKey: ["my-subscription"] });
        setStage({ kind: "error", text: `${outcome.reason} No money was taken for the plan.` });
      } else {
        setStage({ kind: "idle" });
      }
    } catch (err) {
      setStage({ kind: "error", text: extractErrorMessage(err, "Couldn't complete the payment. Please try again.") });
    }
  };

  const busy = stage.kind === "busy";

  return (
    <View style={{ gap: 12 }}>
      {!status.onlinePaymentsAvailable && (
        <View style={[styles.notice, { borderColor: `${T.warn}66` }]}>
          <Ionicons name="information-circle-outline" size={16} color={T.warn} />
          <Text style={styles.noticeText}>Online payment isn't switched on yet. Please contact support to renew — your data is safe.</Text>
        </View>
      )}

      <View style={[styles.plans, wide && styles.plansWide]}>
        {status.plans.map((p) => {
          const isBest = p.planId === bestValue?.planId && status.plans.length > 1;
          const thisBusy = busy && stage.planId === p.planId;
          return (
            <View key={p.planId} style={[styles.plan, isBest && styles.planBest]}>
              {isBest && <Text style={styles.bestTag}>Best value</Text>}
              <Text style={styles.planName}>{p.name}</Text>
              <Text style={styles.planPrice}>{fmtMoney(p.price)}</Text>
              <Text style={styles.planMeta}>
                {p.months} month{p.months === 1 ? "" : "s"}{p.months > 1 ? ` · ${fmtMoney(p.pricePerMonth)}/month` : ""}
              </Text>
              <Text style={styles.planExpiry}>
                {renewing ? "New expiry " : "Active until "}<Text style={{ color: T.text, fontWeight: "700" }}>{fmtDate(p.newExpiry)}</Text>
              </Text>
              <Pressable
                style={[styles.buy, isBest && styles.buyBest, (busy || !status.onlinePaymentsAvailable) && styles.disabled]}
                disabled={busy || !status.onlinePaymentsAvailable}
                onPress={() => buy(p)}
                accessibilityRole="button"
                accessibilityLabel={`${renewing ? "Renew with" : "Buy"} ${p.name} for ${fmtMoney(p.price)}`}
              >
                {thisBusy ? <ActivityIndicator size="small" color={isBest ? "#0d1826" : T.text} /> : (
                  <Text style={[styles.buyText, isBest && styles.buyTextBest]}>{renewing || highlightRenew ? "Renew" : "Buy"}</Text>
                )}
              </Pressable>
            </View>
          );
        })}
      </View>

      {renewing && <Text style={styles.small}>Renewing early adds the new months after your current expiry — you don't lose any days.</Text>}
      {stage.kind !== "idle" && (
        <View style={[styles.notice, {
          borderColor: stage.kind === "done" ? `${T.good}66` : stage.kind === "error" ? `${T.bad}66` : T.border,
        }]}>
          {stage.kind === "busy" ? <ActivityIndicator size="small" color={T.accent} /> : (
            <Ionicons name={stage.kind === "done" ? "checkmark-circle" : "alert-circle-outline"} size={16} color={stage.kind === "done" ? T.good : T.bad} />
          )}
          <Text style={styles.noticeText}>{stage.text}</Text>
        </View>
      )}
      <View style={styles.secure}>
        <Ionicons name="lock-closed-outline" size={12} color={T.faint} />
        <Text style={styles.small}>Pay by UPI, card or net banking on Razorpay's secure page. Your card and UPI details never reach Studio OS.</Text>
      </View>
    </View>
  );
}

export function StatusSummary({ status }: { status: SubscriptionStatus }) {
  const tone = status.status === "Active" || status.status === "Complimentary" ? T.good : status.status === "Trial" ? T.accent : T.bad;
  const label = ({ NoSubscription: "No subscription", ReadOnly: "Read-only (set by support)", Expired: "Expired — read-only" } as Record<string, string>)[status.status] ?? status.status;
  return (
    <View style={styles.fields}>
      <Field label="Status">
        <View style={[styles.badge, { borderColor: `${tone}66`, backgroundColor: `${tone}18` }]}>
          <Text style={[styles.badgeText, { color: tone }]}>{label}</Text>
        </View>
      </Field>
      <Field label="Current plan" value={status.planName ?? "—"} />
      <Field label="Start date" value={fmtDate(status.startDate)} />
      <Field label="Expiry date" value={fmtDate(status.expiryDate)} />
      <Field label="Days remaining">
        <Text style={[styles.fieldValue, status.hasAccess && status.daysRemaining <= 7 && { color: T.warn }]}>
          {status.hasAccess ? `${status.daysRemaining} day${status.daysRemaining === 1 ? "" : "s"}` : "0"}
        </Text>
      </Field>
      <Field label="Amount paid" value={status.lastAmountPaid != null ? fmtMoney(status.lastAmountPaid) : "—"} />
      <Field label="Payment status" value={status.lastPaymentStatus ?? "—"} />
      <Field label="Auto-renewal" value={status.autoRenew ? "On" : "Off — renew manually"} />
    </View>
  );
}

function Field({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children ?? <Text style={styles.fieldValue}>{value}</Text>}
    </View>
  );
}

export function PaymentHistory({ items }: { items: BillingHistoryItem[] }) {
  const narrow = useWindowDimensions().width < 820;
  if (items.length === 0) {
    return <Text style={[styles.small, { paddingVertical: 12 }]}>No payments yet.</Text>;
  }

  const statusColor = (s: string) => (s === "Paid" ? T.good : s === "Failed" ? T.bad : T.warn);
  if (narrow) {
    return (
      <View style={{ gap: 8 }}>
        {items.map((h, i) => (
          <View key={i} style={styles.hCard}>
            <View style={styles.hTop}>
              <Text style={styles.hAmount}>{fmtMoney(h.amount)}</Text>
              <Text style={[styles.hStatus, { color: statusColor(h.status) }]}>{h.status}</Text>
            </View>
            <Text style={styles.small}>{fmtDate(h.date)} · {h.planName ?? "—"}{h.months ? ` · ${h.months} mo` : ""} · {METHOD_LABELS[h.method ?? ""] ?? h.method ?? "—"}</Text>
            {!!h.transactionId && <Text style={styles.small} selectable>Transaction: {h.transactionId}</Text>}
            {!!h.failureReason && <Text style={[styles.small, { color: T.bad }]}>{h.failureReason}</Text>}
          </View>
        ))}
      </View>
    );
  }

  return (
    <ScrollView horizontal contentContainerStyle={{ minWidth: "100%" }}>
      <View style={{ width: "100%", minWidth: 820 }}>
        <View style={[styles.tr, styles.thead]}>
          {["Date", "Plan", "Amount", "Status", "Method", "Period", "Transaction / reference ID"].map((h, i) => (
            <Text key={h} style={[styles.th, { flex: COLS[i] }]}>{h}</Text>
          ))}
        </View>
        {items.map((h, i) => (
          <View key={i} style={styles.tr}>
            <Text style={[styles.td, { flex: COLS[0] }]}>{fmtDate(h.date)}</Text>
            <Text style={[styles.td, { flex: COLS[1] }]}>{h.planName ?? "—"}{h.months ? ` (${h.months} mo)` : ""}</Text>
            <Text style={[styles.td, styles.tdStrong, { flex: COLS[2] }]}>{fmtMoney(h.amount)}</Text>
            <Text style={[styles.td, { flex: COLS[3], color: statusColor(h.status), fontWeight: "700" }]}>{h.status}</Text>
            <Text style={[styles.td, { flex: COLS[4] }]}>{METHOD_LABELS[h.method ?? ""] ?? h.method ?? "—"}</Text>
            <Text style={[styles.td, { flex: COLS[5] }]}>{h.periodStart ? `${fmtDate(h.periodStart)} – ${fmtDate(h.periodEnd)}` : "—"}</Text>
            <Text style={[styles.td, styles.tdMuted, { flex: COLS[6] }]} selectable numberOfLines={1}>
              {h.transactionId ?? (h.failureReason ? h.failureReason : h.orderId ?? "—")}
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const COLS = [1, 1.2, 0.9, 0.8, 1, 1.9, 1.8];

const styles = StyleSheet.create({
  plans: { gap: 12 },
  plansWide: { flexDirection: "row" },
  plan: { flex: 1, minWidth: 0, backgroundColor: T.raised, borderWidth: 1, borderColor: T.border, borderRadius: 12, padding: 16, gap: 4 },
  planBest: { borderColor: T.brand },
  bestTag: { alignSelf: "flex-start", color: T.brand, fontSize: 10.5, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 2 },
  planName: { color: T.muted, fontSize: 13, fontWeight: "700" },
  planPrice: { color: T.text, fontSize: 26, fontWeight: "800", fontVariant: ["tabular-nums"] },
  planMeta: { color: T.faint, fontSize: 12 },
  planExpiry: { color: T.faint, fontSize: 12, marginTop: 6, marginBottom: 10 },
  buy: { marginTop: "auto", borderRadius: 8, borderWidth: 1, borderColor: T.border, backgroundColor: T.surface, paddingVertical: 10, alignItems: "center" },
  buyBest: { backgroundColor: T.brand, borderColor: T.brand },
  buyText: { color: T.text, fontWeight: "700", fontSize: 13.5 },
  buyTextBest: { color: "#0d1826" },
  disabled: { opacity: 0.5 },
  notice: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 10, padding: 12, backgroundColor: T.surface },
  noticeText: { color: T.muted, fontSize: 13, flex: 1, lineHeight: 19 },
  secure: { flexDirection: "row", alignItems: "center", gap: 6 },
  small: { color: T.faint, fontSize: 12 },
  fields: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  field: { flexBasis: 170, flexGrow: 1, gap: 4 },
  fieldLabel: { color: T.faint, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  fieldValue: { color: T.text, fontSize: 14.5, fontWeight: "600" },
  badge: { alignSelf: "flex-start", borderWidth: 1, borderRadius: 100, paddingHorizontal: 10, paddingVertical: 2 },
  badgeText: { fontSize: 12, fontWeight: "700" },
  tr: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: T.border },
  thead: { paddingVertical: 8 },
  th: { color: T.faint, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  td: { color: T.text, fontSize: 13 },
  tdStrong: { fontWeight: "700", fontVariant: ["tabular-nums"] },
  tdMuted: { color: T.muted, fontSize: 12 },
  hCard: { borderWidth: 1, borderColor: T.border, borderRadius: 10, padding: 12, gap: 3, backgroundColor: T.raised },
  hTop: { flexDirection: "row", justifyContent: "space-between" },
  hAmount: { color: T.text, fontWeight: "700", fontSize: 14 },
  hStatus: { fontWeight: "700", fontSize: 12.5 },
});
