import { useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminConsoleApi } from "../../../api/adminConsoleApi";
import { studiosApi } from "../../../api/studiosApi";
import { extractErrorMessage } from "../../../api/errorMessage";
import { useRefetchOnFocus } from "../../../hooks/useRefetchOnFocus";
import { Button, C, ConfirmDialog, ErrorState, Loading, StatusBadge, s } from "./ui";
import { OverviewTab } from "./tabs/OverviewTab";
import { ModulesTab } from "./tabs/ModulesTab";
import { SubscriptionTab } from "./tabs/SubscriptionTab";
import { UsageTab } from "./tabs/UsageTab";
import { ActivityTable } from "./ActivityTable";
import { TrialTab } from "./tabs/TrialTab";

export type DetailTab = "overview" | "modules" | "subscription" | "usage" | "activity" | "trial";

const TABS: { key: DetailTab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "overview", label: "Overview", icon: "speedometer-outline" },
  { key: "modules", label: "Modules", icon: "apps-outline" },
  { key: "subscription", label: "Subscription & Payments", icon: "card-outline" },
  { key: "usage", label: "Usage & Storage", icon: "server-outline" },
  { key: "activity", label: "Activity", icon: "time-outline" },
  { key: "trial", label: "Trial", icon: "hourglass-outline" },
];

// Everything about one studio, one tab at a time.
export function AdminStudioDetailScreen({ studioId, onBack, onEdit }: { studioId: number; onBack: () => void; onEdit: () => void }) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<DetailTab>("overview");
  const [openPaymentForm, setOpenPaymentForm] = useState(false);
  const [pending, setPending] = useState<"block" | "unblock" | "activate" | "deactivate" | null>(null);

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["admin-studio", studioId],
    queryFn: () => adminConsoleApi.studio(studioId),
  });
  useRefetchOnFocus(refetch);

  // Anything that changes the studio's standing refreshes every view of it.
  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-studio", studioId] });
    queryClient.invalidateQueries({ queryKey: ["admin-subscription", studioId] });
    queryClient.invalidateQueries({ queryKey: ["admin-activity"] });
    queryClient.invalidateQueries({ queryKey: ["admin-studios"] });
    queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    queryClient.invalidateQueries({ queryKey: ["studio", studioId] });
  };

  const standing = useMutation({
    mutationFn: (action: NonNullable<typeof pending>) =>
      action === "block" ? studiosApi.block(studioId)
        : action === "unblock" ? studiosApi.unblock(studioId)
          : action === "activate" ? studiosApi.activate(studioId)
            : studiosApi.deactivate(studioId),
    onSuccess: () => { setPending(null); refreshAll(); },
  });

  if (isPending) return <View style={styles.screen}><Loading /></View>;
  if (isError || !data) return <View style={styles.screen}><ErrorState text="Couldn't load this studio." onRetry={refetch} /></View>;

  const st = data.studio;
  const dialog = {
    block: { title: `Block ${st.studioName}?`, message: "The owner can't sign in and customer links stop working until it is unblocked. No data is deleted.", label: "Block studio", danger: true },
    unblock: { title: `Unblock ${st.studioName}?`, message: "The owner can sign in again and customer links work again.", label: "Unblock", danger: false },
    deactivate: { title: `Deactivate ${st.studioName}?`, message: "The studio is switched off: the owner can't sign in and reminders stop. Its data stays and it can be activated again.", label: "Deactivate", danger: true },
    activate: { title: `Activate ${st.studioName}?`, message: "The studio is switched back on.", label: "Activate", danger: false },
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Pressable onPress={onBack} style={styles.back} accessibilityRole="link">
        <Ionicons name="chevron-back" size={14} color={C.accent} />
        <Text style={styles.backText}>Studios</Text>
      </Pressable>

      <View style={styles.header}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{st.studioName.charAt(0).toUpperCase()}</Text></View>
        <View style={{ flex: 1, minWidth: 200 }}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1}>{st.studioName}</Text>
            <StatusBadge status={st.status} />
          </View>
          <Text style={s.faint}>{st.ownerName ?? "—"} · {data.loginEmail ?? st.ownerEmail ?? "no login"}{st.phoneNumber ? ` · ${st.phoneNumber}` : ""}</Text>
        </View>
        <View style={styles.headerActions}>
          <Button label="Edit details" icon="create-outline" onPress={onEdit} small />
          <Button label={st.isActive ? "Deactivate" : "Activate"} icon={st.isActive ? "pause-outline" : "play-outline"}
            onPress={() => setPending(st.isActive ? "deactivate" : "activate")} small />
          <Button label={st.isBlocked ? "Unblock" : "Block"} icon={st.isBlocked ? "lock-open-outline" : "ban-outline"}
            kind={st.isBlocked ? "secondary" : "danger"} onPress={() => setPending(st.isBlocked ? "unblock" : "block")} small />
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        {TABS.map((t) => (
          <Pressable key={t.key} onPress={() => setTab(t.key)} style={[styles.tab, tab === t.key && styles.tabOn]} accessibilityRole="tab"
            accessibilityState={{ selected: tab === t.key }}>
            <Ionicons name={t.icon} size={14} color={tab === t.key ? C.text : C.faint} />
            <Text style={[styles.tabText, tab === t.key && styles.tabTextOn]}>{t.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {tab === "overview" && <OverviewTab detail={data} onRefresh={refreshAll} />}
      {tab === "modules" && <ModulesTab studioId={studioId} studioName={st.studioName} />}
      {tab === "subscription" && (
        <SubscriptionTab studioId={studioId} openForm={openPaymentForm} onFormOpened={() => setOpenPaymentForm(false)} onChanged={refreshAll} />
      )}
      {tab === "usage" && <UsageTab studioId={studioId} />}
      {tab === "activity" && <ActivityTable studioId={studioId} />}
      {tab === "trial" && (
        <TrialTab
          studioId={studioId}
          onChanged={refreshAll}
          onConvert={() => { setOpenPaymentForm(true); setTab("subscription"); }}
        />
      )}

      <ConfirmDialog
        visible={!!pending}
        title={pending ? dialog[pending].title : ""}
        message={pending ? dialog[pending].message : ""}
        confirmLabel={pending ? dialog[pending].label : ""}
        danger={pending ? dialog[pending].danger : false}
        busy={standing.isPending}
        error={standing.isError ? extractErrorMessage(standing.error) : null}
        onConfirm={() => pending && standing.mutate(pending)}
        onCancel={() => { setPending(null); standing.reset(); }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.page },
  content: { padding: 24, gap: 16, maxWidth: 1400, width: "100%", alignSelf: "center" },
  back: { flexDirection: "row", alignItems: "center", gap: 2, alignSelf: "flex-start" },
  backText: { color: C.accent, fontSize: 12.5, fontWeight: "700" },
  header: { flexDirection: "row", alignItems: "center", gap: 14, flexWrap: "wrap" },
  avatar: { width: 46, height: 46, borderRadius: 12, backgroundColor: C.raised, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" },
  avatarText: { color: C.accent, fontSize: 19, fontWeight: "700" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  title: { color: C.text, fontSize: 21, fontWeight: "700", flexShrink: 1 },
  headerActions: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  tabs: { gap: 4, borderBottomWidth: 1, borderBottomColor: C.border, flexGrow: 1 },
  tab: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: "transparent", marginBottom: -1 },
  tabOn: { borderBottomColor: C.accent },
  tabText: { color: C.faint, fontSize: 13, fontWeight: "600" },
  tabTextOn: { color: C.text },
});
