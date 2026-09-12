import { View, Text, StyleSheet } from "react-native";
import Svg, { Path, Circle, Defs, LinearGradient, Stop, Line } from "react-native-svg";

interface Point {
  label: string;
  value: number;
}

interface LineChartProps {
  points: Point[];
  height?: number;
  formatValue?: (value: number) => string;
  color?: string;
}

export function LineChart({ points, height = 220, formatValue = (v) => String(v), color = "#a78bfa" }: LineChartProps) {
  if (points.length === 0) {
    return (
      <View style={[styles.empty, { height }]}>
        <Text style={styles.emptyText}>No data for this period yet.</Text>
      </View>
    );
  }

  const width = 640;
  const paddingLeft = 44;
  const paddingBottom = 24;
  const paddingTop = 28;
  const plotWidth = width - paddingLeft - 12;
  const plotHeight = height - paddingTop - paddingBottom;

  const maxValue = Math.max(...points.map((p) => p.value), 1);
  const step = points.length > 1 ? plotWidth / (points.length - 1) : 0;

  const coords = points.map((p, i) => ({
    x: paddingLeft + step * i,
    y: paddingTop + plotHeight - (p.value / maxValue) * plotHeight,
    ...p,
  }));

  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x},${c.y}`).join(" ");
  const areaPath = `${linePath} L${coords[coords.length - 1].x},${paddingTop + plotHeight} L${coords[0].x},${paddingTop + plotHeight} Z`;

  const peak = coords.reduce((a, b) => (b.value > a.value ? b : a), coords[0]);
  const gridLines = [0, 0.25, 0.5, 0.75, 1];

  return (
    <View style={{ width: "100%" }}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity={0.35} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </LinearGradient>
        </Defs>

        {gridLines.map((g) => {
          const y = paddingTop + plotHeight * (1 - g);
          return <Line key={g} x1={paddingLeft} y1={y} x2={width - 12} y2={y} stroke="#1b2c42" strokeWidth={1} />;
        })}

        <Path d={areaPath} fill="url(#areaFill)" stroke="none" />
        <Path d={linePath} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />

        {coords.map((c) => (
          <Circle key={c.label} cx={c.x} cy={c.y} r={c === peak ? 4.5 : 3} fill={c === peak ? color : "#0d1826"} stroke={color} strokeWidth={2} />
        ))}
      </Svg>

      <View style={styles.labelRow}>
        {points.map((p, i) => (
          <Text key={p.label} style={[styles.label, i === 0 || i === points.length - 1 ? undefined : styles.labelFaded]} numberOfLines={1}>
            {p.label}
          </Text>
        ))}
      </View>

      <View style={styles.peakBadge}>
        <Text style={styles.peakText}>Peak: {formatValue(peak.value)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: "center", justifyContent: "center" },
  emptyText: { color: "#6f83a0", fontSize: 13 },
  labelRow: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 8, marginTop: 4 },
  label: { color: "#6f83a0", fontSize: 11 },
  labelFaded: { opacity: 0 },
  peakBadge: { position: "absolute", top: 0, right: 12, backgroundColor: "#23405c", borderRadius: 6, paddingVertical: 3, paddingHorizontal: 8 },
  peakText: { color: "#e8edf3", fontSize: 11, fontWeight: "600" },
});
