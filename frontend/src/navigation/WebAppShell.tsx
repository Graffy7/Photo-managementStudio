import { useEffect, useState, type ReactNode } from "react";
import { Platform, View, Text, Pressable, StyleSheet, useWindowDimensions } from "react-native";
import type { NavigationContainerRefWithCurrent } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Sidebar } from "./Sidebar";
import { useAuthStore } from "../auth/authStore";
import { ExpiryBanner } from "../screens/studioOwner/subscription/SubscriptionScreens";

interface WebAppShellProps {
  children: ReactNode;
  navigationRef: NavigationContainerRefWithCurrent<any>;
  activeRoute: string;
}

// Below this width the sidebar would squeeze the page to nothing (a 250px sidebar on a 375px
// phone leaves ~125px), so it becomes a slide-out menu opened from a top bar instead.
const COMPACT_BREAKPOINT = 900;

// Sidebar navigation is a web-only layout — native (iOS/Android) keeps rendering screens
// full-width with no shell.
export function WebAppShell({ children, navigationRef, activeRoute }: WebAppShellProps) {
  const { width } = useWindowDimensions();
  const [menuOpen, setMenuOpen] = useState(false);
  const studioName = useAuthStore((s) => s.user?.studioName) ?? "Studio";
  const compact = width < COMPACT_BREAKPOINT;

  // Picking a page closes the menu, as does growing the window back to desktop width.
  useEffect(() => {
    setMenuOpen(false);
  }, [activeRoute, compact]);

  // Escape closes the open menu.
  useEffect(() => {
    if (Platform.OS !== "web" || !menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  if (Platform.OS !== "web") {
    return <>{children}</>;
  }

  // The page content always sits in the same slot of this tree, so switching between the
  // desktop and compact layouts never remounts the navigator (which would reset the page).
  return (
    <View style={[styles.shell, compact && styles.shellCompact]}>
      {!compact && <Sidebar navigationRef={navigationRef} activeRoute={activeRoute} />}

      {compact && (
        <View style={styles.topBar}>
          <Pressable
            style={styles.menuButton}
            onPress={() => setMenuOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Open menu"
            hitSlop={8}
          >
            <Ionicons name="menu" size={24} color="#e8edf3" />
          </Pressable>
          <Text style={styles.topTitle} numberOfLines={1}>{studioName}</Text>
        </View>
      )}

      <View style={styles.content}>
        <ExpiryBanner onRenew={() => navigationRef.current?.navigate("Subscription" as never)} />
        {children}
      </View>

      {compact && menuOpen && (
        <View style={styles.overlay}>
          <Pressable style={styles.backdrop} onPress={() => setMenuOpen(false)} accessibilityLabel="Close menu" />
          <View style={styles.drawer}>
            <Sidebar navigationRef={navigationRef} activeRoute={activeRoute} />
            <Pressable
              style={styles.closeButton}
              onPress={() => setMenuOpen(false)}
              accessibilityRole="button"
              accessibilityLabel="Close menu"
              hitSlop={8}
            >
              <Ionicons name="close" size={22} color="#a7b7cb" />
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, flexDirection: "row", backgroundColor: "#0d1826" },
  shellCompact: { flexDirection: "column" },
  content: { flex: 1 },

  topBar: {
    height: 56, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12,
    backgroundColor: "#0f1e30", borderBottomWidth: 1, borderBottomColor: "#1b2c42",
  },
  menuButton: { width: 40, height: 40, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  topTitle: { color: "#e8edf3", fontSize: 16, fontWeight: "700", flex: 1 },

  overlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 100, flexDirection: "row" },
  backdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(3, 8, 15, 0.6)" },
  // Row, so the sidebar inside stretches to the full height of the screen.
  drawer: { flexDirection: "row", height: "100%", maxWidth: "85%", boxShadow: "4px 0 24px rgba(0, 0, 0, 0.45)" },
  closeButton: { position: "absolute", top: 16, right: 10, width: 34, height: 34, alignItems: "center", justifyContent: "center" },
});
