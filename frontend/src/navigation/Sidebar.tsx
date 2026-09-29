import { View, Text, Pressable, StyleSheet, ScrollView, Image } from "react-native";
import type { NavigationContainerRefWithCurrent } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "../auth/authStore";
import { notificationsApi } from "../api/notificationsApi";
import { settingsApi } from "../api/settingsApi";
import { API_BASE_URL } from "../constants/config";
import { ROUTE_MODULES, useModules } from "../hooks/useModules";
import { NAV_GROUPS } from "./navItems";
import { colors, radius, space, type } from "../ui/theme";

interface SidebarProps {
  navigationRef: NavigationContainerRefWithCurrent<any>;
  activeRoute: string;
}

export function useUnreadCount() {
  const isOn = useModules();
  const { data } = useQuery({
    queryKey: ["notifications-unread-count"],
    queryFn: notificationsApi.getUnreadCount,
    enabled: isOn("NOTIFICATIONS"),
  });
  return data ?? 0;
}

export function useStudioLogo(): string | null {
  const { data: profile } = useQuery({ queryKey: ["studio-profile"], queryFn: settingsApi.getProfile });
  return profile?.logoUrl ? `${API_BASE_URL}${profile.logoUrl}` : null;
}

export function StudioMark({ size = 36 }: { size?: number }) {
  const logoUrl = useStudioLogo();
  return (
    <View style={[styles.mark, { width: size, height: size, borderRadius: size / 3.6 }]}>
      {logoUrl ? (
        <Image source={{ uri: logoUrl }} style={styles.markLogo} resizeMode="cover" />
      ) : (
        <Ionicons name="camera" size={size * 0.55} color={colors.onPrimary} />
      )}
    </View>
  );
}

// The grouped menu - used by the desktop sidebar and the phone "More" sheet.
export function NavList({ activeRoute, onNavigate, large }: { activeRoute: string; onNavigate: (route: string) => void; large?: boolean }) {
  const isOn = useModules();
  const unread = useUnreadCount();
  return (
    <View style={{ gap: space.md }}>
      {NAV_GROUPS.map((group) => {
        // Modules the platform admin switched off for this studio are left out.
        const items = group.items.filter((item) => isOn(ROUTE_MODULES[item.route] ?? ""));
        if (items.length === 0) return null;
        return (
          <View key={group.title}>
            <Text style={styles.groupTitle}>{group.title}</Text>
            {items.map((item) => {
              const active = activeRoute === item.route;
              const badge = item.route === "Notifications" ? unread : 0;
              return (
                <Pressable
                  key={item.route}
                  style={({ pressed }) => [styles.item, large && styles.itemLarge, active && styles.itemActive, pressed && !active && styles.itemPressed]}
                  onPress={() => onNavigate(item.route)}
                  accessibilityRole="link"
                  accessibilityState={{ selected: active }}
                >
                  <Ionicons name={item.icon} size={large ? 22 : 18} color={active ? colors.primary : colors.textMuted} />
                  <Text style={[styles.label, large && styles.labelLarge, active && styles.labelActive]} numberOfLines={1}>{item.label}</Text>
                  {badge > 0 && (
                    <View style={styles.badge}><Text style={styles.badgeText}>{badge > 9 ? "9+" : badge}</Text></View>
                  )}
                </Pressable>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

export function Sidebar({ navigationRef, activeRoute }: SidebarProps) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const studioName = user?.studioName ?? "Studio";

  return (
    <View style={styles.sidebar}>
      <View style={styles.brand}>
        <StudioMark />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.brandName} numberOfLines={1}>{studioName}</Text>
          <Text style={styles.brandSub} numberOfLines={1}>{user?.fullName ?? "Studio owner"}</Text>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: space.md }} showsVerticalScrollIndicator={false}>
        <NavList activeRoute={activeRoute} onNavigate={(route) => navigationRef.current?.navigate(route as never)} />
      </ScrollView>

      <Pressable style={({ pressed }) => [styles.signOut, pressed && styles.itemPressed]} onPress={() => logout()} accessibilityRole="button">
        <Ionicons name="log-out-outline" size={18} color={colors.textMuted} />
        <Text style={styles.label}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 250, backgroundColor: colors.bar, borderRightWidth: 1, borderRightColor: colors.border,
    paddingTop: space.lg, paddingHorizontal: space.md,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.xs, marginBottom: space.lg },
  mark: { backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  markLogo: { width: "100%", height: "100%" },
  brandName: { ...type.body, fontWeight: "700", color: colors.text },
  brandSub: { ...type.caption, color: colors.textFaint },
  groupTitle: { ...type.caption, color: colors.textFaint, fontWeight: "600", paddingHorizontal: space.md, marginBottom: 2, letterSpacing: 0.3 },
  item: {
    flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 38, paddingHorizontal: space.md,
    borderRadius: radius.control, marginBottom: 1,
  },
  itemLarge: { minHeight: 48 },
  itemActive: { backgroundColor: colors.primarySoft },
  itemPressed: { backgroundColor: colors.cardRaised },
  label: { ...type.small, fontWeight: "600", color: colors.textMuted, flex: 1 },
  labelLarge: { fontSize: 16 },
  labelActive: { color: colors.primary },
  badge: {
    backgroundColor: colors.danger, borderRadius: radius.pill, minWidth: 20, height: 20, paddingHorizontal: 5,
    alignItems: "center", justifyContent: "center",
  },
  badgeText: { color: colors.page, fontSize: 11, fontWeight: "700" },
  signOut: {
    flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 44, paddingHorizontal: space.md,
    borderTopWidth: 1, borderTopColor: colors.border, marginBottom: space.sm, borderRadius: radius.control,
  },
});
