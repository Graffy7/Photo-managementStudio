import { useEffect, type ReactNode } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { billingApi } from "../../../api/billingApi";
import { setOnSubscriptionExpired } from "../../../api/client";
import { useAuthStore } from "../../../auth/authStore";
import { PaymentHistory, PlanPicker, StatusSummary, T, fmtDate } from "./SubscriptionParts";

// The studio's subscription status, shared by every screen. Rechecked every few minutes and
// whenever the server answers "subscription expired", so expiry is noticed without a reload.
export function useMySubscription() {
  const studioId = useAuthStore((s) => s.user?.studioId);
  return useQuery({
    queryKey: ["my-subscription", studioId],
    queryFn: billingApi.status,
    refetchInterval: 5 * 60_000,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });
}

// Sidebar "Subscription" page.
export function SubscriptionScreen() {
  const { data, isPending, isError, refetch } = useMySubscription();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View>
        <Text style={styles.title}>Subscription</Text>
        <Text style={styles.subtitle}>Your plan, renewals and payment history.</Text>
      </View>

      {isPending ? <ActivityIndicator color={T.accent} style={{ marginTop: 40 }} /> : isError || !data ? (
        <Pressable onPress={() => refetch()}><Text style={styles.error}>Couldn't load your subscription. Tap to try again.</Text></Pressable>
      ) : (
        <>
          <Card title="Current subscription"><StatusSummary status={data} /></Card>
          <Card title={data.hasAccess && !data.isTrial ? "Renew" : "Choose a plan"}><PlanPicker status={data} /></Card>
          <Card title="Payment history"><PaymentHistory items={data.history} /></Card>
        </>
      )}
    </ScrollView>
  );
}

// Wraps the signed-in studio app. A lapsed subscription keeps the app open in read-only mode (the
// banner below explains it and the server refuses changes); only a suspended studio sees this
// full page instead. Nothing is ever deleted.
export function SubscriptionGate({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { data } = useMySubscription();

  useEffect(() => {
    setOnSubscriptionExpired(() => queryClient.invalidateQueries({ queryKey: ["my-subscription"] }));
    return () => setOnSubscriptionExpired(null);
  }, [queryClient]);

  if (data && data.accessLevel === "None") {
    return <SubscriptionExpired />;
  }
  return <>{children}</>;
}

function SubscriptionExpired() {
  const { data } = useMySubscription();
  const logout = useAuthStore((s) => s.logout);
  const studioName = useAuthStore((s) => s.user?.studioName) ?? "Your studio";
  if (!data) return null;

  const blocked = data.accessLevel === "None";
  const title = blocked ? "Studio unavailable" : data.status === "NoSubscription" ? "Choose a plan to get started" : data.isTrial ? "Your free trial has ended" : "Subscription expired";

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, styles.expiredContent]}>
      <View style={styles.hero}>
        <View style={styles.heroIcon}><Ionicons name={blocked ? "ban-outline" : "time-outline"} size={26} color={blocked ? T.bad : T.brand} /></View>
        <Text style={styles.heroTitle}>{title}</Text>
        <Text style={styles.heroText}>
          {blocked
            ? `${studioName} has been paused by the platform. Please contact support.`
            : `${studioName}'s ${data.isTrial ? "trial" : "subscription"}${data.expiryDate ? ` ended on ${fmtDate(data.expiryDate)}` : " isn't active"}. Renew to continue — all your customers, events, payments and photos are safe and come back the moment you renew.`}
        </Text>
      </View>

      {!blocked && <Card title="Renew your subscription"><PlanPicker status={data} highlightRenew /></Card>}
      {data.history.length > 0 && <Card title="Payment history"><PaymentHistory items={data.history} /></Card>}

      <Pressable style={styles.signOut} onPress={() => logout()} accessibilityRole="button">
        <Ionicons name="log-out-outline" size={15} color={T.bad} />
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

// Across the top of the app: read-only mode (red, always), or the last week before expiry (amber).
export function ExpiryBanner({ onRenew }: { onRenew: () => void }) {
  const { data } = useMySubscription();
  if (data?.accessLevel === "ReadOnly") {
    const byAdmin = data.status === "ReadOnly";
    return (
      <View style={[styles.banner, styles.bannerRed]}>
        <Ionicons name="lock-closed" size={14} color={T.bad} />
        <Text style={styles.bannerText}>
          <Text style={{ fontWeight: "800" }}>{byAdmin ? "Read-only mode. " : data.isTrial ? "Trial ended — payment required. " : "Subscription expired — payment required. "}</Text>
          {byAdmin
            ? "Your studio can view everything but can't add or change anything. Contact support to restore full access."
            : "You can view all your data, but adding or changing anything is locked until you renew. Nothing has been deleted."}
        </Text>
        {!byAdmin && <Pressable onPress={onRenew} accessibilityRole="button"><Text style={[styles.bannerLink, { color: T.bad }]}>Renew now →</Text></Pressable>}
      </View>
    );
  }
  if (!data || !data.hasAccess || data.daysRemaining > 7 || data.status === "Complimentary") return null;
  const d = data.daysRemaining;
  return (
    <View style={styles.banner}>
      <Ionicons name="alert-circle-outline" size={15} color={T.warn} />
      <Text style={styles.bannerText}>
        Your {data.isTrial ? "trial" : "subscription"} ends {d <= 1 ? "within a day" : `in ${d} days`} ({fmtDate(data.expiryDate)}).
      </Text>
      <Pressable onPress={onRenew} accessibilityRole="button"><Text style={styles.bannerLink}>Renew now →</Text></Pressable>
    </View>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.page },
  content: { padding: 24, gap: 16, maxWidth: 1200, width: "100%", alignSelf: "center" },
  expiredContent: { maxWidth: 1000, paddingTop: 40 },
  title: { color: T.text, fontSize: 22, fontWeight: "700" },
  subtitle: { color: T.faint, fontSize: 13, marginTop: 4 },
  error: { color: T.bad, marginTop: 30 },
  card: { backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, borderRadius: 12, padding: 18, gap: 14 },
  cardTitle: { color: T.text, fontSize: 15, fontWeight: "700" },
  hero: { alignItems: "center", gap: 10, paddingVertical: 10 },
  heroIcon: { width: 56, height: 56, borderRadius: 16, backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, alignItems: "center", justifyContent: "center" },
  heroTitle: { color: T.text, fontSize: 24, fontWeight: "800", textAlign: "center" },
  heroText: { color: T.muted, fontSize: 14, lineHeight: 21, textAlign: "center", maxWidth: 620 },
  signOut: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "center", padding: 10 },
  signOutText: { color: T.bad, fontWeight: "700", fontSize: 13 },
  banner: {
    flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap", paddingHorizontal: 16, paddingVertical: 9,
    backgroundColor: "rgba(242,189,92,0.1)", borderBottomWidth: 1, borderBottomColor: "rgba(242,189,92,0.35)",
  },
  bannerRed: { backgroundColor: "rgba(255,122,114,0.1)", borderBottomColor: "rgba(255,122,114,0.4)" },
  bannerText: { color: T.text, fontSize: 13, flexShrink: 1 },
  bannerLink: { color: T.warn, fontSize: 13, fontWeight: "700" },
});
