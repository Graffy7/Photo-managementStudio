import { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { C } from "./ui";

// Vertical bars with their labels underneath; hovering (or tapping) a bar shows its exact value.
export function BarChart({ data, format, color = C.accent, height = 150 }: {
  data: { label: string; value: number }[];
  format: (v: number) => string;
  color?: string;
  height?: number;
}) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  const shown = active ?? data.length - 1;

  if (data.length === 0) return null;

  return (
    <View>
      <View style={styles.readout}>
        <Text style={styles.readoutLabel}>{data[shown]?.label}</Text>
        <Text style={styles.readoutValue}>{format(data[shown]?.value ?? 0)}</Text>
      </View>
      <View style={[styles.plot, { height }]}>
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <View key={f} style={[styles.grid, { bottom: `${f * 100}%` }]} />
        ))}
        {data.map((d, i) => (
          <Pressable
            key={d.label + i}
            style={styles.col}
            onHoverIn={() => setActive(i)}
            onHoverOut={() => setActive(null)}
            onPress={() => setActive(i)}
            accessibilityLabel={`${d.label}: ${format(d.value)}`}
          >
            <View
              style={[
                styles.bar,
                { height: `${(d.value / max) * 100}%`, backgroundColor: color, opacity: i === shown ? 1 : 0.55 },
                d.value > 0 && { minHeight: 3 },
              ]}
            />
          </Pressable>
        ))}
      </View>
      <View style={styles.labels}>
        {data.map((d, i) => (
          <Text key={d.label + i} style={styles.label} numberOfLines={1}>
            {data.length > 12 && i % 2 === 1 ? "" : d.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

// One row per item: name, a bar scaled to the largest, and the value.
export function BarList({ items, format, color = C.accent }: {
  items: { key: string | number; name: string; value: number; sub?: string }[];
  format: (v: number) => string;
  color?: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <View style={{ gap: 12 }}>
      {items.map((item) => (
        <View key={item.key} style={{ gap: 5 }}>
          <View style={styles.listRow}>
            <Text style={styles.listName} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.listValue}>{format(item.value)}</Text>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.max(1, (item.value / max) * 100)}%`, backgroundColor: color }]} />
          </View>
          {!!item.sub && <Text style={styles.listSub}>{item.sub}</Text>}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  readout: { flexDirection: "row", alignItems: "baseline", gap: 8, marginBottom: 10 },
  readoutLabel: { color: C.muted, fontSize: 12 },
  readoutValue: { color: C.text, fontSize: 15, fontWeight: "700", fontVariant: ["tabular-nums"] },
  plot: { flexDirection: "row", alignItems: "flex-end", gap: 4, position: "relative" },
  grid: { position: "absolute", left: 0, right: 0, height: 1, backgroundColor: C.border, opacity: 0.6 },
  col: { flex: 1, height: "100%", justifyContent: "flex-end" },
  bar: { width: "100%", borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  labels: { flexDirection: "row", gap: 4, marginTop: 6 },
  label: { flex: 1, color: C.faint, fontSize: 10, textAlign: "center" },
  listRow: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  listName: { color: C.text, fontSize: 12.5, fontWeight: "600", flexShrink: 1 },
  listValue: { color: C.muted, fontSize: 12, fontVariant: ["tabular-nums"] },
  listSub: { color: C.faint, fontSize: 11 },
  track: { height: 6, borderRadius: 3, backgroundColor: C.raised, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 3 },
});
