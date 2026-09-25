import { useRef, type ReactNode } from "react";
import { View, Text, Pressable, StyleSheet, Modal, ActivityIndicator, type ViewStyle, type StyleProp } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { MiniDatePicker } from "../../../components/MiniDatePicker";
import type { AdminStudioStatus } from "../../../types/adminConsole";

// Shared look for the platform admin console: calm navy surfaces, one blue accent for data, the
// app's orange only for the main action on a screen, and green/amber/red kept for status.
export const C = {
  page: "#0b1522",
  surface: "#101d2e",
  raised: "#14243a",
  border: "#1f3047",
  text: "#e6edf5",
  muted: "#8a9bb3",
  faint: "#5f7390",
  accent: "#7fc0e6",
  brand: "#ff9a4d",
  good: "#4cc493",
  warn: "#f2bd5c",
  bad: "#ff7a72",
};

// ---- Formatting --------------------------------------------------------------------------------

const asUtc = (v: string) => new Date(/[zZ]|[+-]\d\d:\d\d$/.test(v) ? v : `${v}Z`);

export function money(v: number): string {
  return `₹${v.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export function bytes(v: number): string {
  if (v <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(v) / Math.log(1024)));
  const n = v / 1024 ** i;
  return `${n >= 100 || i === 0 ? n.toFixed(0) : n.toFixed(1)} ${units[i]}`;
}

export function date(v: string | null | undefined): string {
  return v ? asUtc(v).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";
}

export function dateTime(v: string | null | undefined): string {
  return v
    ? asUtc(v).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })
    : "—";
}

export function ago(v: string | null | undefined): string {
  if (!v) return "Never";
  const mins = Math.round((Date.now() - asUtc(v).getTime()) / 60000);
  if (mins < 2) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 31) return `${days} day${days === 1 ? "" : "s"} ago`;
  return date(v);
}

export function minutes(v: number): string {
  if (v < 60) return `${v} min`;
  const h = Math.floor(v / 60);
  const m = v % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function monthLabel(yyyyMm: string): string {
  const [y, m] = yyyyMm.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
}

export function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ---- Status ------------------------------------------------------------------------------------

export const STATUS_META: Record<AdminStudioStatus, { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }> = {
  Active: { label: "Active", color: C.good, icon: "checkmark-circle" },
  Trial: { label: "Trial", color: C.accent, icon: "hourglass-outline" },
  Expired: { label: "Expired", color: C.bad, icon: "alert-circle-outline" },
  NoPlan: { label: "No plan", color: C.faint, icon: "remove-circle-outline" },
  Blocked: { label: "Suspended", color: C.bad, icon: "ban-outline" },
  Inactive: { label: "Inactive", color: C.faint, icon: "pause-circle-outline" },
};

export function StatusBadge({ status }: { status: AdminStudioStatus }) {
  const meta = STATUS_META[status];
  return (
    <View style={[s.badge, { borderColor: `${meta.color}55`, backgroundColor: `${meta.color}14` }]}>
      <Ionicons name={meta.icon} size={11} color={meta.color} />
      <Text style={[s.badgeText, { color: meta.color }]}>{meta.label}</Text>
    </View>
  );
}

export function Pill({ text, color = C.muted }: { text: string; color?: string }) {
  return (
    <View style={[s.badge, { borderColor: C.border }]}>
      <Text style={[s.badgeText, { color }]}>{text}</Text>
    </View>
  );
}

// Days left, coloured by urgency.
export function DaysLeft({ status, days }: { status: AdminStudioStatus; days: number }) {
  if (status !== "Active" && status !== "Trial") return <Text style={s.faint}>—</Text>;
  const color = days <= 3 ? C.bad : days <= 7 ? C.warn : C.text;
  return <Text style={[s.cellStrong, { color }]}>{days} day{days === 1 ? "" : "s"}</Text>;
}

// ---- Layout pieces -----------------------------------------------------------------------------

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <View style={s.header}>
      <View style={{ flexShrink: 1 }}>
        <Text style={s.title}>{title}</Text>
        {!!subtitle && <Text style={s.subtitle}>{subtitle}</Text>}
      </View>
      {actions && <View style={s.headerActions}>{actions}</View>}
    </View>
  );
}

export function Card({ title, action, children, style }: { title?: string; action?: ReactNode; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[s.card, style]}>
      {(title || action) && (
        <View style={s.cardHeader}>
          {!!title && <Text style={s.cardTitle}>{title}</Text>}
          {action}
        </View>
      )}
      {children}
    </View>
  );
}

export function StatCard({ label, value, hint, icon, tone }: {
  label: string; value: string; hint?: string; icon: keyof typeof Ionicons.glyphMap; tone?: string;
}) {
  return (
    <View style={s.stat}>
      <View style={s.statTop}>
        <Text style={s.statLabel}>{label}</Text>
        <View style={s.statIcon}>
          <Ionicons name={icon} size={15} color={tone ?? C.accent} />
        </View>
      </View>
      <Text style={s.statValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      {!!hint && <Text style={s.statHint} numberOfLines={1}>{hint}</Text>}
    </View>
  );
}

export function Field({ label, value, children }: { label: string; value?: string | null; children?: ReactNode }) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      {children ?? <Text style={s.fieldValue} selectable>{value || "—"}</Text>}
    </View>
  );
}

type ButtonKind = "primary" | "secondary" | "danger" | "ghost";

export function Button({ label, onPress, kind = "secondary", icon, disabled, busy, small }: {
  label: string; onPress: () => void; kind?: ButtonKind; icon?: keyof typeof Ionicons.glyphMap; disabled?: boolean; busy?: boolean; small?: boolean;
}) {
  const color = kind === "primary" ? "#0d1826" : kind === "danger" ? C.bad : kind === "ghost" ? C.accent : C.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      style={({ hovered }: any) => [
        s.button, small && s.buttonSmall, s[`button_${kind}`], hovered && !disabled && s.buttonHover, (disabled || busy) && s.disabled,
      ]}
    >
      {busy ? <ActivityIndicator size="small" color={color} /> : icon ? <Ionicons name={icon} size={small ? 13 : 15} color={color} /> : null}
      <Text style={[s.buttonText, small && s.buttonTextSmall, { color }]}>{label}</Text>
    </Pressable>
  );
}

export function Loading() {
  return (
    <View style={s.centerBox}>
      <ActivityIndicator color={C.accent} />
    </View>
  );
}

export function EmptyState({ icon = "file-tray-outline", title, text }: { icon?: keyof typeof Ionicons.glyphMap; title: string; text?: string }) {
  return (
    <View style={s.centerBox}>
      <Ionicons name={icon} size={28} color={C.faint} />
      <Text style={s.emptyTitle}>{title}</Text>
      {!!text && <Text style={s.emptyText}>{text}</Text>}
    </View>
  );
}

export function ErrorState({ text, onRetry }: { text: string; onRetry?: () => void }) {
  return (
    <View style={s.centerBox}>
      <Ionicons name="cloud-offline-outline" size={26} color={C.bad} />
      <Text style={s.emptyTitle}>{text}</Text>
      {onRetry && <Button label="Try again" onPress={onRetry} small />}
    </View>
  );
}

export function Chips<T extends string>({ options, value, onChange }: {
  options: { key: T; label: string }[]; value: T; onChange: (v: T) => void;
}) {
  return (
    <View style={s.chips}>
      {options.map((o) => (
        <Pressable key={o.key} onPress={() => onChange(o.key)} style={[s.chip, value === o.key && s.chipOn]} accessibilityRole="button">
          <Text style={[s.chipText, value === o.key && s.chipTextOn]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function Pagination({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(total, page * pageSize);
  return (
    <View style={s.pagination}>
      <Text style={s.faint}>{first}–{last} of {total}</Text>
      <View style={s.pageButtons}>
        <Button label="Previous" small icon="chevron-back" onPress={() => onPage(page - 1)} disabled={page <= 1} />
        <Text style={s.pageText}>Page {page} of {pages}</Text>
        <Button label="Next" small onPress={() => onPage(page + 1)} disabled={page >= pages} />
      </View>
    </View>
  );
}

export function DateRange({ from, to, onChange }: { from: string; to: string; onChange: (from: string, to: string) => void }) {
  const preset = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - (days - 1));
    onChange(isoDay(start), isoDay(end));
  };
  return (
    <View style={s.range}>
      <MiniDatePicker value={from} onChange={(v) => onChange(v, to)} placeholder="From" />
      <Text style={s.faint}>to</Text>
      <MiniDatePicker value={to} onChange={(v) => onChange(from, v)} placeholder="To" />
      <Pressable onPress={() => preset(7)} style={s.rangeQuick}><Text style={s.rangeQuickText}>7d</Text></Pressable>
      <Pressable onPress={() => preset(30)} style={s.rangeQuick}><Text style={s.rangeQuickText}>30d</Text></Pressable>
      <Pressable onPress={() => preset(365)} style={s.rangeQuick}><Text style={s.rangeQuickText}>12m</Text></Pressable>
    </View>
  );
}

// A sensitive action is confirmed in a dialog that says exactly what will happen.
export function ConfirmDialog({ visible, title, message, confirmLabel, danger, busy, error, onConfirm, onCancel, children }: {
  visible: boolean; title: string; message: string; confirmLabel: string; danger?: boolean; busy?: boolean; error?: string | null;
  onConfirm: () => void; onCancel: () => void; children?: ReactNode;
}) {
  // Keep the last wording while the dialog fades out, so it never flashes empty text.
  const shown = useRef({ title, message, confirmLabel, danger });
  if (visible) shown.current = { title, message, confirmLabel, danger };
  ({ title, message, confirmLabel, danger } = shown.current);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={s.backdrop}>
        <View style={s.dialog} accessibilityRole="alert">
          <View style={s.dialogHead}>
            <Ionicons name={danger ? "warning-outline" : "help-circle-outline"} size={20} color={danger ? C.bad : C.accent} />
            <Text style={s.dialogTitle}>{title}</Text>
          </View>
          <Text style={s.dialogText}>{message}</Text>
          {children}
          {!!error && <Text style={s.errorText}>{error}</Text>}
          <View style={s.dialogActions}>
            <Button label="Cancel" onPress={onCancel} kind="ghost" disabled={busy} />
            <Button label={confirmLabel} onPress={onConfirm} kind={danger ? "danger" : "primary"} busy={busy} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

export const s = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 20 },
  headerActions: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
  title: { color: C.text, fontSize: 22, fontWeight: "700", letterSpacing: -0.2 },
  subtitle: { color: C.muted, fontSize: 13, marginTop: 4 },

  card: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 18, gap: 12 },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  cardTitle: { color: C.text, fontSize: 14, fontWeight: "700" },

  stat: { flexGrow: 1, flexBasis: 170, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 16, gap: 6, minWidth: 150 },
  statTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  statLabel: { color: C.muted, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 },
  statIcon: { width: 28, height: 28, borderRadius: 8, backgroundColor: C.raised, alignItems: "center", justifyContent: "center" },
  statValue: { color: C.text, fontSize: 24, fontWeight: "700", fontVariant: ["tabular-nums"] },
  statHint: { color: C.faint, fontSize: 11.5 },

  field: { flexBasis: 200, flexGrow: 1, gap: 3, minWidth: 150 },
  fieldLabel: { color: C.faint, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  fieldValue: { color: C.text, fontSize: 14, fontWeight: "600" },

  badge: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", borderWidth: 1, borderRadius: 100, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 11, fontWeight: "700" },

  button: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 8, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 9 },
  buttonSmall: { paddingHorizontal: 10, paddingVertical: 6 },
  button_primary: { backgroundColor: C.brand, borderColor: C.brand },
  button_secondary: { backgroundColor: C.raised, borderColor: C.border },
  button_danger: { backgroundColor: "rgba(255,122,114,0.1)", borderColor: "rgba(255,122,114,0.45)" },
  button_ghost: { backgroundColor: "transparent", borderColor: "transparent" },
  buttonHover: { opacity: 0.88 },
  buttonText: { fontSize: 13, fontWeight: "700" },
  buttonTextSmall: { fontSize: 12 },
  disabled: { opacity: 0.45 },

  centerBox: { alignItems: "center", justifyContent: "center", paddingVertical: 36, gap: 8 },
  emptyTitle: { color: C.text, fontSize: 14, fontWeight: "600", textAlign: "center" },
  emptyText: { color: C.muted, fontSize: 12.5, textAlign: "center", maxWidth: 360 },
  errorText: { color: C.bad, fontSize: 12.5 },
  faint: { color: C.faint, fontSize: 12 },
  cellStrong: { color: C.text, fontSize: 13, fontWeight: "600", fontVariant: ["tabular-nums"] },

  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { borderWidth: 1, borderColor: C.border, borderRadius: 100, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: C.surface },
  chipOn: { borderColor: C.accent, backgroundColor: "rgba(127,192,230,0.12)" },
  chipText: { color: C.muted, fontSize: 12, fontWeight: "600" },
  chipTextOn: { color: C.accent },

  pagination: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, paddingTop: 12 },
  pageButtons: { flexDirection: "row", alignItems: "center", gap: 8 },
  pageText: { color: C.muted, fontSize: 12 },

  range: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 },
  rangeQuick: { borderWidth: 1, borderColor: C.border, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 5 },
  rangeQuickText: { color: C.muted, fontSize: 11.5, fontWeight: "700" },

  backdrop: { flex: 1, backgroundColor: "rgba(4,9,16,0.72)", alignItems: "center", justifyContent: "center", padding: 16 },
  dialog: { width: "100%", maxWidth: 440, backgroundColor: C.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 20, gap: 12 },
  dialogHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  dialogTitle: { color: C.text, fontSize: 16, fontWeight: "700" },
  dialogText: { color: C.muted, fontSize: 13, lineHeight: 19 },
  dialogActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 4 },

  input: {
    borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9,
    fontSize: 14, color: C.text, backgroundColor: C.raised,
  },
});
