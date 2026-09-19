import { useState } from "react";
import { View, Text, Pressable, StyleSheet, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function dateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function todayKey(): string {
  const now = new Date();
  return dateKey(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

interface MiniDatePickerProps {
  label?: string;
  value: string;
  onChange: (date: string) => void;
  placeholder?: string;
  // "form" matches a full-width form input (used where a screen used to have a typed YYYY-MM-DD
  // field); "compact" is the small inline trigger used in filter bars.
  variant?: "compact" | "form";
  // Shows a Clear action — for optional dates that can legitimately be left empty.
  clearable?: boolean;
}

export function MiniDatePicker({ label, value, onChange, placeholder = "Select date", variant = "compact", clearable }: MiniDatePickerProps) {
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(() => (value ? new Date(`${value}T00:00:00`).getFullYear() : new Date().getFullYear()));
  const [viewMonth, setViewMonth] = useState(() => (value ? new Date(`${value}T00:00:00`).getMonth() + 1 : new Date().getMonth() + 1));

  const openPicker = () => {
    const base = value ? new Date(`${value}T00:00:00`) : new Date();
    setViewYear(base.getFullYear());
    setViewMonth(base.getMonth() + 1);
    setOpen(true);
  };

  const goToMonth = (delta: number) => {
    let nextMonth = viewMonth + delta;
    let nextYear = viewYear;
    if (nextMonth < 1) { nextMonth = 12; nextYear -= 1; }
    else if (nextMonth > 12) { nextMonth = 1; nextYear += 1; }
    setViewYear(nextYear);
    setViewMonth(nextMonth);
  };

  const firstOfMonth = new Date(viewYear, viewMonth - 1, 1);
  const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();
  const leadingBlanks = firstOfMonth.getDay();
  const totalCells = Math.ceil((leadingBlanks + daysInMonth) / 7) * 7;

  const cells: { day: number | null; key: string | null }[] = [];
  for (let i = 0; i < totalCells; i++) {
    const day = i - leadingBlanks + 1;
    cells.push(day < 1 || day > daysInMonth ? { day: null, key: null } : { day, key: dateKey(viewYear, viewMonth, day) });
  }

  const displayLabel = value
    ? new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : placeholder;

  return (
    <View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable style={[styles.trigger, variant === "form" && styles.triggerForm]} onPress={openPicker}>
        <Ionicons name="calendar-outline" size={variant === "form" ? 18 : 14} color="#7fc0e6" />
        <Text style={[styles.triggerText, variant === "form" && styles.triggerTextForm, !value && styles.placeholderText]}>{displayLabel}</Text>
      </Pressable>

      <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.popover}>
            <View style={styles.popoverHeader}>
              <Pressable style={styles.navButton} onPress={() => goToMonth(-1)}>
                <Ionicons name="chevron-back" size={16} color="#a7b7cb" />
              </Pressable>
              <Text style={styles.monthLabel}>{MONTH_NAMES[viewMonth - 1]} {viewYear}</Text>
              <Pressable style={styles.navButton} onPress={() => goToMonth(1)}>
                <Ionicons name="chevron-forward" size={16} color="#a7b7cb" />
              </Pressable>
              <Pressable style={styles.closeButton} onPress={() => setOpen(false)}>
                <Ionicons name="close" size={18} color="#6f83a0" />
              </Pressable>
            </View>

            <View style={styles.weekdayRow}>
              {WEEKDAYS.map((w, i) => (
                <Text key={i} style={styles.weekdayLabel}>{w}</Text>
              ))}
            </View>

            <View style={styles.grid}>
              {cells.map((cell, i) => {
                if (cell.day === null) return <View key={`blank-${i}`} style={styles.daySlot} />;
                const isSelected = cell.key === value;
                const isToday = cell.key === todayKey();
                return (
                  <Pressable
                    key={cell.key}
                    style={styles.daySlot}
                    onPress={() => { onChange(cell.key!); setOpen(false); }}
                  >
                    <View style={[styles.dayCircle, isToday && !isSelected && styles.dayCircleToday, isSelected && styles.dayCircleSelected]}>
                      <Text style={[styles.dayText, isToday && !isSelected && styles.dayTextToday, isSelected && styles.dayTextSelected]}>
                        {cell.day}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.footer}>
              {clearable && value ? (
                <Pressable onPress={() => { onChange(""); setOpen(false); }}>
                  <Text style={styles.clearText}>Clear</Text>
                </Pressable>
              ) : <View />}
              <Pressable onPress={() => { onChange(todayKey()); setOpen(false); }}>
                <Text style={styles.todayText}>Today</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { color: "#6f83a0", fontSize: 12, fontWeight: "600", marginBottom: 6 },
  trigger: {
    flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: "#23405c", borderRadius: 8,
    paddingVertical: 8, paddingHorizontal: 12, backgroundColor: "#132540", minWidth: 140,
  },
  triggerText: { color: "#e8edf3", fontSize: 12, fontWeight: "600" },
  triggerForm: { paddingVertical: 10, paddingHorizontal: 14, minWidth: 0, width: "100%" },
  triggerTextForm: { fontSize: 15, fontWeight: "400" },
  placeholderText: { color: "#6f83a0", fontWeight: "400" },
  footer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#1b2c42" },
  clearText: { color: "#ff7a72", fontSize: 12, fontWeight: "700" },
  todayText: { color: "#7fc0e6", fontSize: 12, fontWeight: "700" },

  backdrop: { flex: 1, backgroundColor: "rgba(3, 8, 15, 0.6)", alignItems: "center", justifyContent: "center" },
  popover: {
    width: 300, backgroundColor: "#132540", borderRadius: 14, borderWidth: 1, borderColor: "#23405c", padding: 16,
  },
  popoverHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  navButton: {
    width: 28, height: 28, borderRadius: 8, borderWidth: 1, borderColor: "#23405c", backgroundColor: "#0f1e30",
    alignItems: "center", justifyContent: "center",
  },
  monthLabel: { color: "#e8edf3", fontSize: 14, fontWeight: "700", flex: 1, textAlign: "center" },
  closeButton: { padding: 2 },

  weekdayRow: { flexDirection: "row" },
  weekdayLabel: { width: `${100 / 7}%`, textAlign: "center", color: "#6f83a0", fontSize: 10, fontWeight: "700" },

  grid: { flexDirection: "row", flexWrap: "wrap", marginTop: 4 },
  daySlot: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: "center", justifyContent: "center" },
  dayCircle: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  dayCircleToday: { borderWidth: 1.5, borderColor: "#7fc0e6" },
  dayCircleSelected: { backgroundColor: "#7fc0e6" },
  dayText: { color: "#c3d0e0", fontSize: 12, fontWeight: "600" },
  dayTextToday: { color: "#7fc0e6", fontWeight: "800" },
  dayTextSelected: { color: "#0d1826", fontWeight: "800" },
});
