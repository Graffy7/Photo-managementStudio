import { View, Text, Pressable, StyleSheet, ScrollView, Image } from "react-native";
import type { NavigationContainerRefWithCurrent } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../auth/authStore";
import { useQuery } from "@tanstack/react-query";
import { notificationsApi } from "../api/notificationsApi";
import { settingsApi } from "../api/settingsApi";
import { API_BASE_URL } from "../constants/config";
import { ROUTE_MODULES, useModules } from "../hooks/useModules";

const NAV_ITEMS: { route: string; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { route: "Home", label: "Dashboard", icon: "grid-outline" },
  { route: "Calendar", label: "Calendar", icon: "calendar-number-outline" },
  { route: "Leads", label: "Enquiry", icon: "person-add-outline" },
  { route: "Customers", label: "Customers", icon: "people-outline" },
  { route: "Events", label: "Events", icon: "calendar-outline" },
  { route: "PhotoSelection", label: "Photo Selection", icon: "images-outline" },
  { route: "Workers", label: "Workers", icon: "briefcase-outline" },
  { route: "Services", label: "Services", icon: "pricetags-outline" },
  { route: "Quotations", label: "Quotations", icon: "document-text-outline" },
  { route: "Payments", label: "Payments", icon: "cash-outline" },
  { route: "Expenses", label: "Expenses", icon: "receipt-outline" },
  { route: "Reports", label: "Reports", icon: "bar-chart-outline" },
  { route: "DayBoard", label: "Day Board", icon: "today-outline" },
  { route: "Notifications", label: "Notifications", icon: "notifications-outline" },
];

interface SidebarProps {
  navigationRef: NavigationContainerRefWithCurrent<any>;
  activeRoute: string;
}

export function Sidebar({ navigationRef, activeRoute }: SidebarProps) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const isOn = useModules();
  const { data: unreadCount } = useQuery({
    queryKey: ["notifications-unread-count"],
    queryFn: notificationsApi.getUnreadCount,
    enabled: isOn("NOTIFICATIONS"),
  });

  const { data: profile } = useQuery({
    queryKey: ["studio-profile"],
    queryFn: settingsApi.getProfile,
  });

  const studioName = user?.studioName ?? "Studio";
  const logoUrl = profile?.logoUrl ? `${API_BASE_URL}${profile.logoUrl}` : null;

  return (
    <View style={styles.sidebar}>
      <View style={styles.brand}>
        <View style={styles.brandIcon}>
          {logoUrl ? (
            <Image source={{ uri: logoUrl }} style={styles.brandLogo} resizeMode="cover" />
          ) : (
            <Ionicons name="camera" size={20} color="#0d1826" />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.brandName} numberOfLines={1}>{studioName}</Text>
          <Text style={styles.brandSubtitle}>Photo Studio</Text>
        </View>
      </View>

      <ScrollView style={styles.navList} contentContainerStyle={{ paddingBottom: 12 }} showsVerticalScrollIndicator={false}>
        {/* Modules the platform admin switched off for this studio are left out. */}
        {NAV_ITEMS.filter((item) => isOn(ROUTE_MODULES[item.route] ?? "")).map((item) => {
          const isActive = activeRoute === item.route;
          const badge = item.route === "Notifications" ? unreadCount : undefined;
          return (
            <Pressable
              key={item.route}
              style={[styles.navItem, isActive && styles.navItemActive]}
              onPress={() => navigationRef.current?.navigate(item.route as never)}
            >
              <Ionicons name={item.icon} size={18} color={isActive ? "#ffffff" : "#7fa3c9"} />
              <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>{item.label}</Text>
              {!!badge && (
                <View style={styles.navBadge}>
                  <Text style={styles.navBadgeText}>{badge > 9 ? "9+" : badge}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      <Pressable
        style={styles.profile}
        onPress={() => isOn("SETTINGS") && navigationRef.current?.navigate("Settings" as never)}
        disabled={!isOn("SETTINGS")}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(user?.fullName ?? "S").charAt(0).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.profileName} numberOfLines={1}>{studioName}</Text>
          <Text style={styles.profileRole}>Studio Owner</Text>
        </View>
        {isOn("SETTINGS") && <Ionicons name="chevron-forward" size={16} color="#6f83a0" />}
      </Pressable>

      <Pressable style={styles.signOut} onPress={() => logout()}>
        <Ionicons name="log-out-outline" size={16} color="#ff7a72" />
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 250,
    backgroundColor: "#0f1e30",
    borderRightWidth: 1,
    borderRightColor: "#1b2c42",
    paddingTop: 20,
    paddingHorizontal: 14,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 6, marginBottom: 22 },
  brandIcon: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: "#7fc0e6",
    alignItems: "center", justifyContent: "center", overflow: "hidden",
  },
  brandLogo: { width: "100%", height: "100%" },
  brandName: { color: "#e8edf3", fontSize: 15, fontWeight: "700" },
  brandSubtitle: { color: "#6f83a0", fontSize: 11, marginTop: 1 },
  navList: { flexGrow: 0 },
  navItem: {
    flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, paddingHorizontal: 12,
    borderRadius: 8, marginBottom: 2,
  },
  navItemActive: { backgroundColor: "#7fc0e6" },
  navLabel: { color: "#a7b7cb", fontSize: 13, fontWeight: "600", flex: 1 },
  navLabelActive: { color: "#ffffff" },
  navBadge: {
    backgroundColor: "#ff7a72", borderRadius: 100, minWidth: 18, height: 18, paddingHorizontal: 4,
    alignItems: "center", justifyContent: "center",
  },
  navBadgeText: { color: "#0d1826", fontSize: 10, fontWeight: "700" },
  profile: {
    flexDirection: "row", alignItems: "center", gap: 10, borderTopWidth: 1, borderTopColor: "#1b2c42",
    paddingTop: 14, marginTop: 14, paddingHorizontal: 6, paddingBottom: 4,
  },
  avatar: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: "#23405c",
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { color: "#e8edf3", fontWeight: "700", fontSize: 13 },
  profileName: { color: "#e8edf3", fontSize: 13, fontWeight: "600" },
  profileRole: { color: "#6f83a0", fontSize: 11 },
  signOut: {
    flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 6, paddingVertical: 12,
  },
  signOutText: { color: "#ff7a72", fontSize: 12, fontWeight: "600" },
});
