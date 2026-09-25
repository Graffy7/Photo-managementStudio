import { useState, type ReactNode } from "react";
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../auth/authStore";
import { studiosApi } from "../api/studiosApi";
import { StudioFormScreen } from "../screens/superAdmin/StudioFormScreen";
import { AdminDashboardScreen } from "../screens/superAdmin/console/AdminDashboardScreen";
import { AdminStudiosScreen } from "../screens/superAdmin/console/AdminStudiosScreen";
import { AdminStudioDetailScreen } from "../screens/superAdmin/console/AdminStudioDetailScreen";
import { AdminActivityScreen } from "../screens/superAdmin/console/AdminActivityScreen";
import { AdminPaymentsScreen } from "../screens/superAdmin/console/AdminPaymentsScreen";
import { C, Loading } from "../screens/superAdmin/console/ui";
import type { AdminStudioStatus } from "../types/adminConsole";

type Section = "dashboard" | "studios" | "payments" | "activity";

type View_ =
  | { name: "dashboard" }
  | { name: "studios"; status?: AdminStudioStatus }
  | { name: "studio"; studioId: number }
  | { name: "create" }
  | { name: "edit"; studioId: number; back: View_ }
  | { name: "payments" }
  | { name: "activity" };

const NAV: { section: Section; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { section: "dashboard", label: "Dashboard", icon: "grid-outline" },
  { section: "studios", label: "Studios", icon: "business-outline" },
  { section: "payments", label: "Payments", icon: "wallet-outline" },
  { section: "activity", label: "Activity", icon: "time-outline" },
];

// The platform admin's console: a sidebar (a menu button on narrow screens) and one page at a time.
export function SuperAdminHome() {
  const narrow = useWindowDimensions().width < 900;
  const [view, setView] = useState<View_>({ name: "dashboard" });
  const [menuOpen, setMenuOpen] = useState(false);

  const section: Section = view.name === "dashboard" || view.name === "activity" || view.name === "payments" ? view.name : "studios";
  const go = (v: View_) => { setView(v); setMenuOpen(false); };

  let page: ReactNode;
  switch (view.name) {
    case "dashboard":
      page = <AdminDashboardScreen onOpenStudio={(studioId) => go({ name: "studio", studioId })} onViewStudios={(status) => go({ name: "studios", status })} />;
      break;
    case "studios":
      page = (
        <AdminStudiosScreen
          initialStatus={view.status}
          onOpen={(studioId) => go({ name: "studio", studioId })}
          onCreate={() => go({ name: "create" })}
          onEdit={(studioId) => go({ name: "edit", studioId, back: view })}
        />
      );
      break;
    case "studio":
      page = (
        <AdminStudioDetailScreen
          key={view.studioId}
          studioId={view.studioId}
          onBack={() => go({ name: "studios" })}
          onEdit={() => go({ name: "edit", studioId: view.studioId, back: view })}
        />
      );
      break;
    case "create":
      page = <StudioFormScreen onDone={() => go({ name: "studios" })} onCancel={() => go({ name: "studios" })} />;
      break;
    case "edit":
      page = <EditStudio studioId={view.studioId} onDone={() => go(view.back)} />;
      break;
    case "activity":
      page = <AdminActivityScreen />;
      break;
    case "payments":
      page = <AdminPaymentsScreen onOpenStudio={(studioId) => go({ name: "studio", studioId })} />;
      break;
  }

  const sidebar = (
    <AdminSidebar
      section={section}
      onNavigate={(sct) => go({ name: sct } as View_)}
      onClose={narrow ? () => setMenuOpen(false) : undefined}
    />
  );

  return (
    <View style={[styles.shell, narrow && styles.shellNarrow]}>
      {narrow ? (
        <View style={styles.topBar}>
          <Pressable onPress={() => setMenuOpen(true)} accessibilityRole="button" accessibilityLabel="Open menu" hitSlop={8}>
            <Ionicons name="menu" size={22} color={C.text} />
          </Pressable>
          <Text style={styles.topTitle}>{NAV.find((n) => n.section === section)?.label}</Text>
        </View>
      ) : sidebar}
      <View style={styles.main}>{page}</View>
      {narrow && menuOpen && (
        <View style={styles.overlay}>
          {sidebar}
          <Pressable style={{ flex: 1 }} onPress={() => setMenuOpen(false)} accessibilityLabel="Close menu" />
        </View>
      )}
    </View>
  );
}

// The existing studio form needs the full studio record for editing.
function EditStudio({ studioId, onDone }: { studioId: number; onDone: () => void }) {
  const { data } = useQuery({ queryKey: ["studio", studioId], queryFn: () => studiosApi.getById(studioId) });
  if (!data) return <View style={{ flex: 1, backgroundColor: C.page }}><Loading /></View>;
  return <StudioFormScreen studio={data} onDone={onDone} onCancel={onDone} />;
}

function AdminSidebar({ section, onNavigate, onClose }: { section: Section; onNavigate: (s: Section) => void; onClose?: () => void }) {
  const navigation = useNavigation<any>();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  return (
    <View style={styles.sidebar}>
      <View style={styles.brand}>
        <View style={styles.brandIcon}><Ionicons name="shield-checkmark" size={17} color="#0d1826" /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.brandName}>Studio OS</Text>
          <Text style={styles.brandSub}>Platform admin</Text>
        </View>
        {onClose && (
          <Pressable onPress={onClose} accessibilityLabel="Close menu" hitSlop={8}>
            <Ionicons name="close" size={20} color={C.muted} />
          </Pressable>
        )}
      </View>

      <View style={styles.nav}>
        {NAV.map((n) => {
          const active = n.section === section;
          return (
            <Pressable key={n.section} onPress={() => onNavigate(n.section)} accessibilityRole="button"
              style={({ hovered }: any) => [styles.navItem, active && styles.navItemOn, hovered && !active && styles.navItemHover]}>
              <Ionicons name={n.icon} size={17} color={active ? C.text : C.muted} />
              <Text style={[styles.navLabel, active && styles.navLabelOn]}>{n.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.footer}>
        <View style={styles.userRow}>
          <View style={styles.userAvatar}><Text style={styles.userAvatarText}>{(user?.fullName ?? "A").charAt(0).toUpperCase()}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.userName} numberOfLines={1}>{user?.fullName ?? "Admin"}</Text>
            <Text style={styles.userRole}>Super admin</Text>
          </View>
        </View>
        <Pressable style={styles.footerLink} onPress={() => navigation.navigate("ChangePassword")} accessibilityRole="button">
          <Ionicons name="key-outline" size={14} color={C.muted} />
          <Text style={styles.footerText}>Change password</Text>
        </Pressable>
        <Pressable style={styles.footerLink} onPress={() => logout()} accessibilityRole="button">
          <Ionicons name="log-out-outline" size={14} color={C.bad} />
          <Text style={[styles.footerText, { color: C.bad }]}>Sign out</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, flexDirection: "row", backgroundColor: C.page },
  shellNarrow: { flexDirection: "column" },
  main: { flex: 1, minWidth: 0 },
  sidebar: { width: 232, backgroundColor: "#0d1a2a", borderRightWidth: 1, borderRightColor: C.border, paddingVertical: 18, paddingHorizontal: 12 },
  brand: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 6, marginBottom: 22 },
  brandIcon: { width: 34, height: 34, borderRadius: 9, backgroundColor: C.accent, alignItems: "center", justifyContent: "center" },
  brandName: { color: C.text, fontSize: 15, fontWeight: "700" },
  brandSub: { color: C.faint, fontSize: 11 },
  nav: { gap: 2, flex: 1 },
  navItem: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 10, paddingVertical: 9, borderRadius: 8 },
  navItemOn: { backgroundColor: C.raised },
  navItemHover: { backgroundColor: "rgba(127,192,230,0.06)" },
  navLabel: { color: C.muted, fontSize: 13.5, fontWeight: "600" },
  navLabelOn: { color: C.text },
  footer: { borderTopWidth: 1, borderTopColor: C.border, paddingTop: 14, gap: 8 },
  userRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 6, marginBottom: 4 },
  userAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: C.raised, alignItems: "center", justifyContent: "center" },
  userAvatarText: { color: C.accent, fontWeight: "700" },
  userName: { color: C.text, fontSize: 12.5, fontWeight: "600" },
  userRole: { color: C.faint, fontSize: 11 },
  footerLink: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 8, paddingVertical: 5 },
  footerText: { color: C.muted, fontSize: 12.5, fontWeight: "600" },
  topBar: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: "#0d1a2a" },
  topTitle: { color: C.text, fontSize: 16, fontWeight: "700" },
  overlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, flexDirection: "row", backgroundColor: "rgba(4,9,16,0.6)", zIndex: 50 },
});
