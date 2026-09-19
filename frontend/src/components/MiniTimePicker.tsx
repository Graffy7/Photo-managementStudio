import { useState } from "react";
import { View, Text, Pressable, StyleSheet, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";

const DIAL_SIZE = 240;
const DIAL_RADIUS = 92;
const NUMBER_SIZE = 38;

type Period = "AM" | "PM";
type Mode = "hour" | "minute";

interface Draft {
  hour12: number;
  minute: number;
  period: Period;
}

function parse(value: string): Draft {
  const match = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!match) return { hour12: 9, minute: 0, period: "AM" };
  const h24 = Math.min(23, Number(match[1]));
  return { hour12: h24 % 12 === 0 ? 12 : h24 % 12, minute: Math.min(59, Number(match[2])), period: h24 >= 12 ? "PM" : "AM" };
}

function toValue({ hour12, minute, period }: Draft): string {
  const h24 = (hour12 % 12) + (period === "PM" ? 12 : 0);
  return `${String(h24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function display(value: string): string {
  const { hour12, minute, period } = parse(value);
  return `${hour12}:${String(minute).padStart(2, "0")} ${period}`;
}

const two = (n: number) => String(n).padStart(2, "0");

// Value is "HH:mm" (24h) — what the API already expects — while the picker itself is a 12-hour
// clock: tap the hour on the dial, then the minute, then choose AM/PM.
export function MiniTimePicker({
  label,
  value,
  onChange,
  placeholder = "Select time",
  clearable,
}: {
  label?: string;
  value: string;
  onChange: (time: string) => void;
  placeholder?: string;
  clearable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => parse(value));
  const [mode, setMode] = useState<Mode>("hour");

  const openPicker = () => {
    setDraft(parse(value));
    setMode("hour");
    setOpen(true);
  };

  const dialNumbers = Array.from({ length: 12 }, (_, i) => (mode === "hour" ? (i === 0 ? 12 : i) : i * 5));
  const isSelected = (n: number) => (mode === "hour" ? draft.hour12 === n : draft.minute === n);

  const pick = (n: number) => {
    if (mode === "hour") {
      setDraft((d) => ({ ...d, hour12: n }));
      setMode("minute");
    } else {
      setDraft((d) => ({ ...d, minute: n }));
    }
  };

  const nudgeMinute = (delta: number) => setDraft((d) => ({ ...d, minute: (d.minute + delta + 60) % 60 }));

  return (
    <View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable style={styles.trigger} onPress={openPicker}>
        <Ionicons name="time-outline" size={18} color="#7fc0e6" />
        <Text style={[styles.triggerText, !value && styles.placeholderText]}>{value ? display(value) : placeholder}</Text>
      </Pressable>

      <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.popover}>
            <View style={styles.readout}>
              <Pressable onPress={() => setMode("hour")} style={[styles.readoutBox, mode === "hour" && styles.readoutBoxActive]}>
                <Text style={[styles.readoutText, mode === "hour" && styles.readoutTextActive]}>{two(draft.hour12)}</Text>
              </Pressable>
              <Text style={styles.readoutColon}>:</Text>
              <Pressable onPress={() => setMode("minute")} style={[styles.readoutBox, mode === "minute" && styles.readoutBoxActive]}>
                <Text style={[styles.readoutText, mode === "minute" && styles.readoutTextActive]}>{two(draft.minute)}</Text>
              </Pressable>
              <View style={styles.periodStack}>
                {(["AM", "PM"] as const).map((p) => (
                  <Pressable key={p} onPress={() => setDraft((d) => ({ ...d, period: p }))} style={[styles.periodButton, draft.period === p && styles.periodButtonActive]}>
                    <Text style={[styles.periodText, draft.period === p && styles.periodTextActive]}>{p}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <Text style={styles.modeHint}>{mode === "hour" ? "Select the hour" : "Select the minutes"}</Text>

            <View style={styles.dial}>
              <View style={styles.dialCenter} />
              {dialNumbers.map((n, i) => {
                const angle = (i * 30 * Math.PI) / 180;
                const left = DIAL_SIZE / 2 + DIAL_RADIUS * Math.sin(angle) - NUMBER_SIZE / 2;
                const top = DIAL_SIZE / 2 - DIAL_RADIUS * Math.cos(angle) - NUMBER_SIZE / 2;
                const selected = isSelected(n);
                return (
                  <Pressable key={`${mode}-${n}`} onPress={() => pick(n)} style={[styles.dialNumber, { left, top }, selected && styles.dialNumberSelected]}>
                    <Text style={[styles.dialNumberText, selected && styles.dialNumberTextSelected]}>{mode === "hour" ? n : two(n)}</Text>
                  </Pressable>
                );
              })}
            </View>

            {mode === "minute" && (
              <View style={styles.nudgeRow}>
                <Pressable style={styles.nudgeButton} onPress={() => nudgeMinute(-1)}>
                  <Text style={styles.nudgeText}>− 1 min</Text>
                </Pressable>
                <Pressable style={styles.nudgeButton} onPress={() => nudgeMinute(1)}>
                  <Text style={styles.nudgeText}>+ 1 min</Text>
                </Pressable>
              </View>
            )}

            <View style={styles.footer}>
              {clearable && value ? (
                <Pressable onPress={() => { onChange(""); setOpen(false); }}>
                  <Text style={styles.clearText}>Clear</Text>
                </Pressable>
              ) : <View />}
              <View style={styles.footerActions}>
                <Pressable onPress={() => setOpen(false)}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.okButton} onPress={() => { onChange(toValue(draft)); setOpen(false); }}>
                  <Text style={styles.okText}>OK</Text>
                </Pressable>
              </View>
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
    paddingVertical: 10, paddingHorizontal: 14, backgroundColor: "#132540", width: "100%",
  },
  triggerText: { color: "#e8edf3", fontSize: 15 },
  placeholderText: { color: "#6f83a0" },

  backdrop: { flex: 1, backgroundColor: "rgba(3, 8, 15, 0.6)", alignItems: "center", justifyContent: "center" },
  popover: { width: 300, backgroundColor: "#132540", borderRadius: 14, borderWidth: 1, borderColor: "#23405c", padding: 18 },

  readout: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  readoutBox: { backgroundColor: "#0f1e30", borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14, borderWidth: 1, borderColor: "#1b2c42" },
  readoutBoxActive: { borderColor: "#7fc0e6", backgroundColor: "rgba(127, 192, 230, 0.14)" },
  readoutText: { color: "#a7b7cb", fontSize: 34, fontWeight: "700", fontVariant: ["tabular-nums"] },
  readoutTextActive: { color: "#e8edf3" },
  readoutColon: { color: "#a7b7cb", fontSize: 30, fontWeight: "700" },
  periodStack: { marginLeft: 6, gap: 4 },
  periodButton: { borderWidth: 1, borderColor: "#23405c", borderRadius: 6, paddingVertical: 5, paddingHorizontal: 9 },
  periodButtonActive: { backgroundColor: "#7fc0e6", borderColor: "#7fc0e6" },
  periodText: { color: "#a7b7cb", fontSize: 12, fontWeight: "700" },
  periodTextActive: { color: "#0d1826" },

  modeHint: { color: "#6f83a0", fontSize: 11, textAlign: "center", marginTop: 12 },

  dial: {
    width: DIAL_SIZE, height: DIAL_SIZE, borderRadius: DIAL_SIZE / 2, backgroundColor: "#0f1e30",
    alignSelf: "center", marginTop: 10, borderWidth: 1, borderColor: "#1b2c42",
  },
  dialCenter: { position: "absolute", left: DIAL_SIZE / 2 - 4, top: DIAL_SIZE / 2 - 4, width: 8, height: 8, borderRadius: 4, backgroundColor: "#7fc0e6" },
  dialNumber: { position: "absolute", width: NUMBER_SIZE, height: NUMBER_SIZE, borderRadius: NUMBER_SIZE / 2, alignItems: "center", justifyContent: "center" },
  dialNumberSelected: { backgroundColor: "#7fc0e6" },
  dialNumberText: { color: "#c3d0e0", fontSize: 14, fontWeight: "600" },
  dialNumberTextSelected: { color: "#0d1826", fontWeight: "800" },

  nudgeRow: { flexDirection: "row", justifyContent: "center", gap: 10, marginTop: 10 },
  nudgeButton: { borderWidth: 1, borderColor: "#23405c", borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12 },
  nudgeText: { color: "#a7b7cb", fontSize: 12, fontWeight: "600" },

  footer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#1b2c42" },
  footerActions: { flexDirection: "row", alignItems: "center", gap: 16 },
  clearText: { color: "#ff7a72", fontSize: 13, fontWeight: "700" },
  cancelText: { color: "#a7b7cb", fontSize: 13, fontWeight: "600" },
  okButton: { backgroundColor: "#ff9a4d", borderRadius: 8, paddingVertical: 8, paddingHorizontal: 20 },
  okText: { color: "#0d1826", fontSize: 13, fontWeight: "700" },
});
