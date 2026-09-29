import { useEffect, useState, type ReactNode } from "react";
import { Platform, View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import type { NavigationContainerRefWithCurrent } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { NavList, Sidebar, StudioMark, useUnreadCount } from "./Sidebar";
import { BOTTOM_TABS } from "./navItems";
import { useAuthStore } from "../auth/authStore";
import { ROUTE_MODULES, useModules } from "../hooks/useModules";
import { ExpiryBanner } from "../screens/studioOwner/subscription/SubscriptionScreens";
import { useBreakpoint } from "../ui/useBreakpoint";
import { colors, radius, space, touch, type } from "../ui/theme";

interface WebAppShellProps {
  children: ReactNode;
  navigationRef: NavigationContainerRefWithCurrent<any>;
  activeRoute: string;
}

// Desktop (>= 1024px): sidebar | page. Phones and tablets: top bar, page, and a bottom bar with the
// four most-used places plus "More" (a sheet with everything else) - reachable with one thumb.
// Web-only layout; native renders the screens full-width with no shell.
export function WebAppShell({ children, navigationRef, activeRoute }: WebAppShellProps) {
  const { isDesktop } = useBreakpoint();
  const [moreOpen, setMoreOpen] = useState(false);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const isOn = useModules();
  const unread = useUnreadCount();
  const studioName = user?.studioName ?? "Studio";

  // Picking a page closes the sheet, as does growing the window to desktop width.
  useEffect(() => {
    setMoreOpen(false);
  }, [activeRoute, isDesktop]);

  // Escape closes the sheet.
  useEffect(() => {
    if (Platform.OS !== "web" || !moreOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMoreOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [moreOpen]);

  if (Platform.OS !== "web") {
    return <>{children}</>;
  }

  const go = (route: string) => navigationRef.current?.navigate(route as never);
  const tabs = BOTTOM_TABS.filter((t) => isOn(ROUTE_MODULES[t.route] ?? ""));
  const onTab = tabs.some((t) => t.route === activeRoute);

  // The page content always sits in the same slot of this tree, so switching between the
  // desktop and phone layouts never remounts the navigator (which would reset the page).
  return (
    <View style={[styles.shell, !isDesktop && styles.shellCompact]}>
      {isDesktop && <Sidebar navigationRef={navigationRef} activeRoute={activeRoute} />}

      {!isDesktop && (
        <View style={styles.topBar}>
          <StudioMark size={32} />
          <Text style={styles.topTitle} numberOfLines={1}>{studioName}</Text>
          {isOn("NOTIFICATIONS") && (
            <Pressable style={styles.topIcon} onPress={() => go("Notifications")} accessibilityRole="button" accessibilityLabel={`Notifications${unread ? `, ${unread} unread` : ""}`}>
              <Ionicons name="notifications-outline" size={22} color={activeRoute === "Notifications" ? colors.primary : colors.text} />
              {unread > 0 && (
                <View style={styles.dot}><Text style={styles.dotText}>{unread > 9 ? "9+" : unread}</Text></View>
              )}
            </Pressable>
          )}
        </View>
      )}

      <View style={styles.content}>
        <ExpiryBanner onRenew={() => go("Subscription")} />
        {children}
      </View>

      {!isDesktop && (
        <View style={styles.tabBar} accessibilityRole="tablist">
          {tabs.map((t) => {
            const active = activeRoute === t.route;
            return (
              <Pressable key={t.route} style={styles.tab} onPress={() => go(t.route)} accessibilityRole="tab" accessibilityState={{ selected: active }} accessibilityLabel={t.label}>
                <Ionicons name={active ? (t.icon.replace("-outline", "") as typeof t.icon) : t.icon} size={22} color={active ? colors.primary : colors.textMuted} />
                <Text style={[styles.tabLabel, active && styles.tabLabelActive]} numberOfLines={1}>{t.label}</Text>
              </Pressable>
            );
          })}
          <Pressable style={styles.tab} onPress={() => setMoreOpen(true)} accessibilityRole="tab" accessibilityState={{ selected: !onTab }} accessibilityLabel="More">
            <Ionicons name={!onTab ? "menu" : "menu-outline"} size={22} color={!onTab ? colors.primary : colors.textMuted} />
            <Text style={[styles.tabLabel, !onTab && styles.tabLabelActive]}>More</Text>
          </Pressable>
        </View>
      )}

      {!isDesktop && moreOpen && (
        <View style={styles.overlay}>
          <Pressable style={styles.backdrop} onPress={() => setMoreOpen(false)} accessibilityLabel="Close menu" />
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Menu</Text>
              <Pressable style={styles.topIcon} onPress={() => setMoreOpen(false)} accessibilityRole="button" accessibilityLabel="Close menu">
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.sheetBody}>
              <NavList activeRoute={activeRoute} onNavigate={go} large />
              <Pressable style={styles.signOut} onPress={() => logout()} accessibilityRole="button">
                <Ionicons name="log-out-outline" size={22} color={colors.textMuted} />
                <Text style={styles.signOutText}>Sign out</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, flexDirection: "row", backgroundColor: colors.page },
  shellCompact: { flexDirection: "column" },
  content: { flex: 1, minHeight: 0 },

  topBar: {
    height: 56, flexDirection: "row", alignItems: "center", gap: space.md, paddingLeft: space.lg, paddingRight: space.sm,
    backgroundColor: colors.bar, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  topTitle: { ...type.body, fontWeight: "700", color: colors.text, flex: 1 },
  topIcon: { width: touch, height: touch, alignItems: "center", justifyContent: "center" },
  dot: {
    position: "absolute", top: 6, right: 4, backgroundColor: colors.danger, borderRadius: radius.pill,
    minWidth: 18, height: 18, paddingHorizontal: 4, alignItems: "center", justifyContent: "center",
  },
  dotText: { color: colors.page, fontSize: 10, fontWeight: "700" },

  tabBar: {
    height: 64, flexDirection: "row", backgroundColor: colors.bar, borderTopWidth: 1, borderTopColor: colors.border,
  },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", gap: 2 },
  tabLabel: { fontSize: 11, fontWeight: "600", color: colors.textMuted },
  tabLabelActive: { color: colors.primary },

  overlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 100, justifyContent: "flex-end" },
  backdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(3,8,15,0.6)" },
  sheet: {
    maxHeight: "85%", backgroundColor: colors.bar, borderTopLeftRadius: 16, borderTopRightRadius: 16,
    borderTopWidth: 1, borderColor: colors.border,
  },
  sheetHeader: { flexDirection: "row", alignItems: "center", paddingLeft: space.xl, paddingRight: space.sm, paddingTop: space.sm },
  sheetTitle: { ...type.heading, color: colors.text, flex: 1 },
  sheetBody: { paddingHorizontal: space.md, paddingBottom: space.xl },
  signOut: {
    flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 48, paddingHorizontal: space.md,
    marginTop: space.md, borderTopWidth: 1, borderTopColor: colors.border,
  },
  signOutText: { fontSize: 16, fontWeight: "600", color: colors.textMuted },
});
