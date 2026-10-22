import { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { colors, space, type } from "../ui/theme";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

// "2026-10-11T00:00:00" -> parts, without time-zone shifts.
function parts(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return { y, m, d, dow: (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7 };
}

// Quiet days are near the card colour; the busiest day is bright blue.
function shade(count: number, max: number): string {
  if (count <= 0) return "rgba(127,160,200,0.10)";
  const t = max <= 1 ? 1 : (count - 1) / (max - 1);
  return `rgba(77,163,255,${(0.32 + 0.68 * t).toFixed(2)})`;
}

// Busy days: a square per day, brighter the more events it has. Up to ~6 weeks it is a calendar
// (with the date, or the count on busy days); longer ranges are one row per month, one square per
// day of the month. Hover or tap a day for its exact count.
export function BusyDaysHeatmap({ days }: { days: { date: string; events: number }[] }) {
  const [active, setActive] = useState<number | null>(null);
  if (days.length === 0) return null;
  const max = Math.max(1, ...days.map((d) => d.events));
  const busiest = days.reduce((a, b) => (b.events > a.events ? b : a), days[0]);
  const shown = active !== null ? days[active] : busiest;
  const sp = parts(shown.date);

  const readout = (
    <Text style={styles.readout}>
      <Text style={styles.readoutDate}>{`${sp.d} ${MONTHS[sp.m - 1]}`}</Text>
      {`  ${shown.events} ${shown.events === 1 ? "event" : "events"}${active === null && shown.events > 0 ? " · busiest" : ""}`}
    </Text>
  );

  const cell = (i: number, label: string | null, big: boolean) => {
    const d = days[i];
    const bright = d.events > 0 && d.events / max > 0.5;
    return (
      <Pressable
        key={d.date}
        onHoverIn={() => setActive(i)}
        onHoverOut={() => setActive(null)}
        onPress={() => setActive(i)}
        style={[big ? styles.dayBig : styles.daySmall, { backgroundColor: shade(d.events, max) }, active === i && styles.dayActive]}
        accessibilityLabel={`${d.date.slice(0, 10)}: ${d.events} events`}
      >
        {label !== null && <Text style={[styles.dayText, bright && styles.dayTextBright, d.events > 0 && styles.dayTextBusy]}>{label}</Text>}
      </Pressable>
    );
  };

  let grid: React.ReactNode;
  if (days.length <= 45) {
    // Calendar: Monday-first weeks.
    const lead = parts(days[0].date).dow;
    const slots: (number | null)[] = [...Array(lead).fill(null), ...days.map((_, i) => i)];
    while (slots.length % 7 !== 0) slots.push(null);
    const weeks = [];
    for (let w = 0; w < slots.length; w += 7) weeks.push(slots.slice(w, w + 7));
    grid = (
      <View style={{ gap: 4 }}>
        <View style={styles.row}>
          {WEEKDAYS.map((n, i) => <Text key={i} style={styles.weekday}>{n}</Text>)}
        </View>
        {weeks.map((week, w) => (
          <View key={w} style={styles.row}>
            {week.map((i, k) => i === null
              ? <View key={`e${k}`} style={[styles.dayBig, { backgroundColor: "transparent" }]} />
              : cell(i, days[i].events > 0 ? String(days[i].events) : String(parts(days[i].date).d), true))}
          </View>
        ))}
      </View>
    );
  } else {
    // One row per month, a square for each day of the month.
    const months: { key: string; label: string; cells: number[] }[] = [];
    days.forEach((d, i) => {
      const p = parts(d.date);
      const key = `${p.y}-${p.m}`;
      let row = months.find((m) => m.key === key);
      if (!row) {
        row = { key, label: `${MONTHS[p.m - 1]} '${String(p.y).slice(2)}`, cells: [] };
        months.push(row);
      }
      row.cells[p.d - 1] = i;
    });
    grid = (
      <View style={{ gap: 3 }}>
        {months.map((m) => (
          <View key={m.key} style={styles.monthRow}>
            <Text style={styles.monthLabel}>{m.label}</Text>
            <View style={styles.row}>
              {Array.from({ length: 31 }, (_, d) => (m.cells[d] === undefined
                ? <View key={d} style={[styles.daySmall, { backgroundColor: "transparent" }]} />
                : cell(m.cells[d], null, false)))}
            </View>
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={{ gap: space.sm }}>
      {readout}
      {grid}
      <View style={styles.legend}>
        <Text style={styles.legendText}>Quiet</Text>
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <View key={f} style={[styles.legendBox, { backgroundColor: shade(f === 0 ? 0 : Math.ceil(max * f), max) }]} />
        ))}
        <Text style={styles.legendText}>Busy ({max})</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  readout: { ...type.small, color: colors.textMuted, minHeight: 20 },
  readoutDate: { color: colors.text, fontWeight: "700" },
  row: { flexDirection: "row", gap: 4, flex: 1 },
  weekday: { flex: 1, textAlign: "center", ...type.caption, color: colors.textMuted },
  dayBig: { flex: 1, aspectRatio: 1.6, maxHeight: 34, borderRadius: 6, alignItems: "center", justifyContent: "center" },
  daySmall: { flex: 1, aspectRatio: 1, borderRadius: 2 },
  dayActive: { borderWidth: 1.5, borderColor: "#cfe6ff" },
  dayText: { ...type.caption, color: colors.textFaint },
  dayTextBusy: { color: colors.text, fontWeight: "700" },
  dayTextBright: { color: "#ffffff" },
  monthRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  monthLabel: { width: 48, ...type.caption, fontSize: 10, color: colors.textMuted },
  legend: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-end" },
  legendBox: { width: 12, height: 12, borderRadius: 3 },
  legendText: { ...type.caption, color: colors.textMuted, marginHorizontal: 2 },
});
