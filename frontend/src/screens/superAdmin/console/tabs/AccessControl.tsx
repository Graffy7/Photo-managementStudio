import { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "@tanstack/react-query";
import { adminConsoleApi } from "../../../../api/adminConsoleApi";
import { subscriptionPlansApi } from "../../../../api/subscriptionPlansApi";
import { extractErrorMessage } from "../../../../api/errorMessage";
import { Button, C, Card, Chips, ConfirmDialog, money, s } from "../ui";
import type { AdminStudioRow } from "../../../../types/adminConsole";

type Mode = "Auto" | "Full" | "ReadOnly" | "Suspended";

const MODES: { key: Mode; title: string; text: string; icon: keyof typeof Ionicons.glyphMap; tone: string }[] = [
  { key: "Auto", title: "Automatic", text: "Follows the subscription: active or trial = full access; expired or unpaid = read-only.", icon: "sync-outline", tone: C.accent },
  { key: "Full", title: "Full access", text: "Full access whatever the subscription says (complimentary / custom).", icon: "lock-open-outline", tone: C.good },
  { key: "ReadOnly", title: "Read-only", text: "Can sign in and view everything; can't add, change, upload or send anything.", icon: "eye-outline", tone: C.warn },
  { key: "Suspended", title: "Suspended", text: "Can't sign in or use anything until restored. Data is kept.", icon: "ban-outline", tone: C.bad },
];

const LEVEL: Record<AdminStudioRow["accessLevel"], { label: string; tone: string }> = {
  Full: { label: "Full access", tone: C.good },
  ReadOnly: { label: "Read-only", tone: C.warn },
  None: { label: "No access", tone: C.bad },
};

// How this studio's access is decided, and what it can do right now.
export function AccessControl({ row, onChanged }: { row: AdminStudioRow; onChanged: () => void }) {
  const current: Mode = row.isBlocked ? "Suspended" : row.accessMode;
  const [pending, setPending] = useState<Mode | null>(null);
  const run = useMutation({
    mutationFn: (m: Mode) => adminConsoleApi.setAccess(row.studioId, m),
    onSuccess: () => { setPending(null); onChanged(); },
  });
  const level = LEVEL[row.accessLevel];

  const confirmText: Record<Mode, string> = {
    Auto: "Access will follow the subscription again. With a running subscription or trial the studio gets full access; otherwise it's read-only.",
    Full: "The studio gets full access even without a paid subscription, until you change this back.",
    ReadOnly: "The studio can still sign in and view everything, but every add, edit, upload and send is refused.",
    Suspended: "The studio is signed out and can't sign in or use anything until you restore it. None of its data is deleted.",
  };

  return (
    <Card title="Access control" action={
      <View style={[s.badge, { borderColor: `${level.tone}55`, backgroundColor: `${level.tone}14` }]}>
        <Text style={[s.badgeText, { color: level.tone }]}>Now: {level.label}</Text>
      </View>
    }>
      <View style={styles.grid}>
        {MODES.map((m) => {
          const on = current === m.key;
          return (
            <Pressable key={m.key} style={[styles.option, on && { borderColor: m.tone, backgroundColor: `${m.tone}10` }]}
              onPress={() => !on && setPending(m.key)} accessibilityRole="radio" accessibilityState={{ checked: on }}>
              <View style={styles.optionTop}>
                <Ionicons name={m.icon} size={16} color={on ? m.tone : C.muted} />
                <Text style={[styles.optionTitle, on && { color: C.text }]}>{m.title}</Text>
                {on && <Ionicons name="checkmark-circle" size={16} color={m.tone} style={{ marginLeft: "auto" }} />}
              </View>
              <Text style={s.faint}>{m.text}</Text>
            </Pressable>
          );
        })}
      </View>
      <ConfirmDialog
        visible={!!pending}
        title={pending ? `Set access to "${MODES.find((m) => m.key === pending)!.title}"?` : ""}
        message={pending ? confirmText[pending] : ""}
        confirmLabel={pending === "Suspended" ? "Suspend studio" : "Apply"}
        danger={pending === "Suspended" || pending === "ReadOnly"}
        busy={run.isPending}
        error={run.isError ? extractErrorMessage(run.error) : null}
        onConfirm={() => pending && run.mutate(pending)}
        onCancel={() => { setPending(null); run.reset(); }}
      />
    </Card>
  );
}

// Moves the current subscription to another plan; its dates don't change.
export function ChangePlan({ studioId, currentPlanId, onChanged }: { studioId: number; currentPlanId: number | null; onChanged: () => void }) {
  const { data: plans } = useQuery({ queryKey: ["subscription-plans"], queryFn: subscriptionPlansApi.getActive });
  const [planId, setPlanId] = useState<string>(String(currentPlanId ?? ""));
  const [confirming, setConfirming] = useState(false);
  const run = useMutation({
    mutationFn: () => adminConsoleApi.changePlan(studioId, Number(planId)),
    onSuccess: () => { setConfirming(false); onChanged(); },
  });
  const chosen = plans?.find((p) => String(p.subscriptionPlanId) === planId);

  return (
    <Card title="Change plan">
      <Text style={s.faint}>Switches the plan on the current subscription. Dates stay the same — use Record payment to add paid time.</Text>
      <Chips options={(plans ?? []).map((p) => ({ key: String(p.subscriptionPlanId), label: `${p.planName} · ${money(p.price)}` }))} value={planId} onChange={setPlanId} />
      <View style={{ alignSelf: "flex-start" }}>
        <Button label="Change plan" icon="swap-horizontal" disabled={!chosen || planId === String(currentPlanId ?? "")} onPress={() => setConfirming(true)} />
      </View>
      <ConfirmDialog
        visible={confirming}
        title={`Change the plan to ${chosen?.planName ?? ""}?`}
        message="The current subscription's plan changes; its start and expiry dates stay as they are."
        confirmLabel="Change plan"
        busy={run.isPending}
        error={run.isError ? extractErrorMessage(run.error) : null}
        onConfirm={() => run.mutate()}
        onCancel={() => { setConfirming(false); run.reset(); }}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  option: { flexGrow: 1, flexBasis: 220, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 12, gap: 6, backgroundColor: C.raised },
  optionTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  optionTitle: { color: C.muted, fontSize: 13.5, fontWeight: "700" },
});
