import { View, Text, StyleSheet } from "react-native";
import Svg, { Circle } from "react-native-svg";

interface Segment {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  segments: Segment[];
  size?: number;
  strokeWidth?: number;
  centerLabel: string;
  centerValue: string | number;
}

export function DonutChart({ segments, size = 160, strokeWidth = 18, centerLabel, centerValue }: DonutChartProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((sum, s) => sum + s.value, 0);

  let offsetSoFar = 0;
  const arcs = segments.map((s) => {
    const fraction = total === 0 ? 0 : s.value / total;
    const dash = fraction * circumference;
    const arc = { ...s, dash, offset: offsetSoFar };
    offsetSoFar += dash;
    return arc;
  });

  return (
    <View style={styles.row}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#1b2c42"
            strokeWidth={strokeWidth}
            fill="none"
          />
          {total > 0 &&
            arcs.map((a) => (
              <Circle
                key={a.label}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={a.color}
                strokeWidth={strokeWidth}
                strokeDasharray={`${a.dash} ${circumference - a.dash}`}
                strokeDashoffset={-a.offset}
                strokeLinecap="butt"
                fill="none"
                rotation={-90}
                origin={`${size / 2}, ${size / 2}`}
              />
            ))}
        </Svg>
        <View style={[styles.center, { width: size, height: size }]}>
          <Text style={styles.centerValue}>{centerValue}</Text>
          <Text style={styles.centerLabel}>{centerLabel}</Text>
        </View>
      </View>

      <View style={styles.legend}>
        {segments.map((s) => (
          <View key={s.label} style={styles.legendRow}>
            <View style={[styles.dot, { backgroundColor: s.color }]} />
            <Text style={styles.legendLabel}>{s.label}</Text>
            <Text style={styles.legendValue}>{s.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 20 },
  center: { position: "absolute", alignItems: "center", justifyContent: "center" },
  centerValue: { fontSize: 28, fontWeight: "700", color: "#e8edf3" },
  centerLabel: { fontSize: 11, color: "#6f83a0", marginTop: 2 },
  legend: { gap: 10, flex: 1 },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  legendLabel: { color: "#a7b7cb", fontSize: 13, flex: 1 },
  legendValue: { color: "#e8edf3", fontSize: 13, fontWeight: "700" },
});
