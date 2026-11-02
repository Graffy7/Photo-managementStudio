import { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { colors, space, type } from "../ui/theme";

export interface BarSeries {
  key: string;
  label: string;
  color: string;
}

// Side-by-side bars per day or month (one per series), every period shown even when it is zero.
// Hovering or tapping a period shows its exact figures above the chart.
export function GroupedBarChart<T extends { label: string }>({ data, series, value, format, height = 200, extra, axisLabel }: {
  data: T[];
  series: BarSeries[];
  value: (item: T, key: string) => number;
  format: (v: number) => string;
  height?: number;
  // An extra line in the readout (e.g. profit for the money chart).
  extra?: (item: T) => string | null;
  // A shorter label for under the bars (the readout keeps the full one).
  axisLabel?: (item: T, index: number) => string;
}) {
  const [active, setActive] = useState<number | null>(null);
  if (data.length === 0) return null;

  const max = Math.max(1, ...data.flatMap((d) => series.map((s) => value(d, s.key))));
  const shown = data[active ?? data.length - 1];
  // Thin out the labels so they never overlap: at most ~10 under the chart, each spanning the
  // bars it stands for, so it has room to show in full.
  const every = Math.ceil(data.length / 10);
  const groups: { label: string; size: number }[] = [];
  for (let i = 0; i < data.length; i += every) {
    groups.push({ label: axisLabel ? axisLabel(data[i], i) : data[i].label, size: Math.min(every, data.length - i) });
  }

  return (
    <View style={{ gap: space.sm }}>
      <View style={styles.readout}>
        <Text style={styles.readoutLabel}>{shown.label}</Text>
        {series.map((s) => (
          <View key={s.key} style={styles.readoutItem}>
            <View style={[styles.dot, { backgroundColor: s.color }]} />
            <Text style={styles.readoutText}>{s.label}: <Text style={styles.readoutValue}>{format(value(shown, s.key))}</Text></Text>
          </View>
        ))}
        {extra?.(shown) ? <Text style={styles.readoutText}>{extra(shown)}</Text> : null}
      </View>
      <View style={[styles.plot, { height }]}>
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <View key={f} style={[styles.grid, { bottom: `${f * 100}%` }]} />
        ))}
        {data.map((d, i) => (
          <Pressable
            key={d.label + i}
            style={[styles.col, active === i && styles.colActive]}
            onHoverIn={() => setActive(i)}
            onHoverOut={() => setActive(null)}
            onPress={() => setActive(i)}
            accessibilityLabel={`${d.label}: ${series.map((s) => `${s.label} ${format(value(d, s.key))}`).join(", ")}`}
          >
            {series.map((s) => {
              const v = value(d, s.key);
              return (
                <View
                  key={s.key}
                  style={[styles.bar, { height: `${(v / max) * 100}%`, backgroundColor: s.color }, v > 0 && { minHeight: 3 }]}
                />
              );
            })}
          </Pressable>
        ))}
      </View>
      <View style={styles.labels}>
        {groups.map((g, i) => (
          <Text key={g.label + i} style={[styles.label, { flex: g.size }]} numberOfLines={1}>{g.label}</Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  readout: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: space.md, rowGap: 4, minHeight: 22 },
  readoutLabel: { ...type.small, fontWeight: "700", color: colors.text },
  readoutItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  readoutText: { ...type.small, color: colors.textMuted },
  readoutValue: { color: colors.text, fontWeight: "700", fontVariant: ["tabular-nums"] },
  dot: { width: 8, height: 8, borderRadius: 4 },
  plot: { flexDirection: "row", alignItems: "flex-end", gap: 2, borderBottomWidth: 1, borderBottomColor: colors.border },
  grid: { position: "absolute", left: 0, right: 0, height: 1, backgroundColor: colors.border, opacity: 0.5 },
  col: { flex: 1, height: "100%", flexDirection: "row", alignItems: "flex-end", justifyContent: "center", gap: 1, borderRadius: 3 },
  colActive: { backgroundColor: "rgba(127,192,230,0.08)" },
  bar: { flex: 1, maxWidth: 18, borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  labels: { flexDirection: "row", gap: 2 },
  label: { ...type.caption, fontSize: 11, color: colors.textMuted, textAlign: "left", paddingLeft: 2 },
});
