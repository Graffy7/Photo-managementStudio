import { useEffect, useState } from "react";
import { View, Text, StyleSheet, AccessibilityInfo, type LayoutChangeEvent } from "react-native";
import Svg, { Path, Circle, Defs, LinearGradient, Stop, Line } from "react-native-svg";

// What the tooltip shows when this point is hovered (or tapped on a phone).
export interface PointDetail {
  title: string;
  total?: string;
  items?: { name: string; sub?: string; value: string }[];
}

interface Point {
  label: string;
  value: number;
  detail?: PointDetail;
}

const TOOLTIP_WIDTH = 230;
const MAX_TOOLTIP_ITEMS = 4;

interface LineChartProps {
  points: Point[];
  height?: number;
  formatValue?: (value: number) => string;
  color?: string;
  // Second colour the line fades into, left to right.
  accentColor?: string;
}

const DRAW_MS = 1400;

// Smooth curve through the points using monotone cubic interpolation (Fritsch-Carlson). Unlike a
// plain spline it never overshoots: the curve cannot dip below zero or rise above the real peak
// between two points, so the smoothing never misstates the numbers.
function monotonePath(pts: { x: number; y: number }[]): string {
  const n = pts.length;
  if (n === 1) return `M${pts[0].x},${pts[0].y}`;

  const d: number[] = [];
  for (let i = 0; i < n - 1; i++) d.push((pts[i + 1].y - pts[i].y) / (pts[i + 1].x - pts[i].x));

  const m: number[] = new Array(n);
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;

  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * d[i];
      m[i + 1] = t * b * d[i];
    }
  }

  let path = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < n - 1; i++) {
    const dx = (pts[i + 1].x - pts[i].x) / 3;
    path += ` C${pts[i].x + dx},${pts[i].y + m[i] * dx} ${pts[i + 1].x - dx},${pts[i + 1].y - m[i + 1] * dx} ${pts[i + 1].x},${pts[i + 1].y}`;
  }
  return path;
}

// Rough length of the curve (sum of straight hops, padded) — enough to drive the draw-in animation.
function approxLength(pts: { x: number; y: number }[]): number {
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return len * 1.15 + 1;
}

export function LineChart({
  points,
  height = 220,
  formatValue = (v) => String(v),
  color = "#a78bfa",
  accentColor = "#7fc0e6",
}: LineChartProps) {
  // Drawn at its real pixel width so circles stay round and the line keeps an even thickness.
  const [width, setWidth] = useState(0);
  const [progress, setProgress] = useState(0);
  const [hover, setHover] = useState<number | null>(null);

  const dataKey = points.map((p) => `${p.label}:${p.value}`).join("|");

  // Draw the line in once per data set (on load, and when the period changes).
  useEffect(() => {
    let frame = 0;
    let cancelled = false;

    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (cancelled) return;
        if (reduce) {
          setProgress(1);
          return;
        }
        setProgress(0);
        const start = Date.now();
        const tick = () => {
          const t = Math.min(1, (Date.now() - start) / DRAW_MS);
          setProgress(1 - Math.pow(1 - t, 3));
          if (t < 1 && !cancelled) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [dataKey]);

  if (points.length === 0) {
    return (
      <View key="empty" style={[styles.empty, { height }]}>
        <Text style={styles.emptyText}>No data for this period yet.</Text>
      </View>
    );
  }

  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));

  const paddingLeft = 12;
  const paddingRight = 12;
  const paddingBottom = 18;
  const paddingTop = 34;
  const plotWidth = Math.max(1, width - paddingLeft - paddingRight);
  const plotHeight = height - paddingTop - paddingBottom;
  const baseline = paddingTop + plotHeight;

  const maxValue = Math.max(...points.map((p) => p.value), 1);
  const step = points.length > 1 ? plotWidth / (points.length - 1) : 0;

  const coords = points.map((p, i) => ({
    x: paddingLeft + (points.length > 1 ? step * i : plotWidth / 2),
    y: paddingTop + plotHeight - (p.value / maxValue) * plotHeight,
    ...p,
  }));

  const linePath = monotonePath(coords);
  const areaPath = `${linePath} L${coords[coords.length - 1].x},${baseline} L${coords[0].x},${baseline} Z`;
  const length = approxLength(coords);
  const dashOffset = length * (1 - progress);
  const dash = `${length} ${length}`;

  const peak = coords.reduce((a, b) => (b.value > a.value ? b : a), coords[0]);
  const last = coords[coords.length - 1];
  const gridLines = [0.25, 0.5, 0.75, 1];

  // Hovering (or tapping) anywhere across the chart picks the nearest point by its x position.
  const pickAt = (x: number) => {
    if (coords.length === 1) return setHover(0);
    const i = Math.round((x - paddingLeft) / step);
    setHover(Math.max(0, Math.min(coords.length - 1, i)));
  };
  const active = hover !== null && hover < coords.length ? coords[hover] : null;
  const detail = active?.detail;
  const items = detail?.items ?? [];
  const tooltipLeft = active ? Math.max(0, Math.min(width - TOOLTIP_WIDTH, active.x - TOOLTIP_WIDTH / 2)) : 0;
  // Sit above the point when there is room, otherwise below it.
  const tooltipAbove = active ? active.y > height * 0.55 : false;

  return (
    // key: a separate box from the empty state, so it is freshly mounted and reports its width
    // (React would otherwise reuse the empty box, and its size callback would never fire).
    <View key="chart" style={{ width: "100%" }} onLayout={onLayout}>
      {width > 0 && (
        <Svg width={width} height={height}>
          <Defs>
            {/* userSpaceOnUse so a perfectly flat line (a zero-height box) still renders */}
            <LinearGradient id="lineStroke" gradientUnits="userSpaceOnUse" x1={paddingLeft} y1={0} x2={width - paddingRight} y2={0}>
              <Stop offset="0" stopColor={accentColor} />
              <Stop offset="1" stopColor={color} />
            </LinearGradient>
            <LinearGradient id="areaFill" gradientUnits="userSpaceOnUse" x1={0} y1={paddingTop} x2={0} y2={baseline}>
              <Stop offset="0" stopColor={color} stopOpacity={0.42} />
              <Stop offset="0.55" stopColor={color} stopOpacity={0.12} />
              <Stop offset="1" stopColor={color} stopOpacity={0} />
            </LinearGradient>
            <LinearGradient id="peakBeam" gradientUnits="userSpaceOnUse" x1={0} y1={peak.y} x2={0} y2={baseline}>
              <Stop offset="0" stopColor={color} stopOpacity={0.55} />
              <Stop offset="1" stopColor={color} stopOpacity={0} />
            </LinearGradient>
          </Defs>

          {gridLines.map((g) => {
            const y = paddingTop + plotHeight * (1 - g);
            return (
              <Line key={g} x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke="#1b2c42" strokeWidth={1} strokeDasharray="2 6" />
            );
          })}

          {/* The fill fades in behind the line as it draws. */}
          <Path d={areaPath} fill="url(#areaFill)" stroke="none" opacity={progress} />

          {/* Glow: the same curve drawn wider and fainter underneath the line. */}
          <Path d={linePath} fill="none" stroke="url(#lineStroke)" strokeWidth={14} strokeOpacity={0.07}
            strokeLinecap="round" strokeDasharray={dash} strokeDashoffset={dashOffset} />
          <Path d={linePath} fill="none" stroke="url(#lineStroke)" strokeWidth={7} strokeOpacity={0.14}
            strokeLinecap="round" strokeDasharray={dash} strokeDashoffset={dashOffset} />
          <Path d={linePath} fill="none" stroke="url(#lineStroke)" strokeWidth={2.75}
            strokeLinejoin="round" strokeLinecap="round" strokeDasharray={dash} strokeDashoffset={dashOffset} />

          {progress >= 1 && (
            <>
              {/* A soft beam from the best point down to the baseline. */}
              <Line x1={peak.x} y1={peak.y} x2={peak.x} y2={baseline} stroke="url(#peakBeam)" strokeWidth={1.5} strokeDasharray="3 4" />
              <Circle cx={peak.x} cy={peak.y} r={11} fill={color} opacity={0.14} />
              <Circle cx={peak.x} cy={peak.y} r={5} fill={color} stroke="#0d1826" strokeWidth={2} />
              {last !== peak && (
                <>
                  <Circle cx={last.x} cy={last.y} r={8} fill={accentColor} opacity={0.12} />
                  <Circle cx={last.x} cy={last.y} r={3.5} fill="#0d1826" stroke={color} strokeWidth={2} />
                </>
              )}
            </>
          )}

          {/* Hover: a crosshair down to the baseline and a lit-up point. */}
          {active && (
            <>
              <Line x1={active.x} y1={paddingTop - 6} x2={active.x} y2={baseline} stroke={color} strokeOpacity={0.45} strokeWidth={1} strokeDasharray="3 3" />
              <Circle cx={active.x} cy={active.y} r={13} fill={color} opacity={0.18} />
              <Circle cx={active.x} cy={active.y} r={5.5} fill="#e8edf3" stroke={color} strokeWidth={2.5} />
            </>
          )}
        </Svg>
      )}

      {width > 0 && (
        // Catches the pointer across the whole chart: mouse hover on the web, touch-and-drag on phones.
        <View
          style={[styles.hitArea, { width, height }]}
          onPointerMove={(e) => pickAt(e.nativeEvent.offsetX)}
          onPointerDown={(e) => pickAt(e.nativeEvent.offsetX)}
          onPointerLeave={() => setHover(null)}
          onStartShouldSetResponder={() => true}
          onResponderGrant={(e) => pickAt(e.nativeEvent.locationX)}
          onResponderMove={(e) => pickAt(e.nativeEvent.locationX)}
        />
      )}

      {active && (
        <View
          pointerEvents="none"
          style={[
            styles.tooltip,
            { left: tooltipLeft, width: TOOLTIP_WIDTH },
            tooltipAbove ? { bottom: height - active.y + 18 } : { top: active.y + 18 },
          ]}
        >
          <Text style={styles.tooltipDate}>{detail?.title ?? active.label}</Text>
          <Text style={styles.tooltipTotal}>{detail?.total ?? formatValue(active.value)}</Text>

          {items.length > 0 && (
            <View style={styles.tooltipItems}>
              {items.slice(0, MAX_TOOLTIP_ITEMS).map((item, i) => (
                <View key={`${item.name}-${i}`} style={styles.tooltipRow}>
                  <View style={[styles.tooltipBullet, { backgroundColor: i === 0 ? color : accentColor }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.tooltipName} numberOfLines={1}>{item.name}</Text>
                    {!!item.sub && <Text style={styles.tooltipSub} numberOfLines={1}>{item.sub}</Text>}
                  </View>
                  <Text style={styles.tooltipValue}>{item.value}</Text>
                </View>
              ))}
              {items.length > MAX_TOOLTIP_ITEMS && (
                <Text style={styles.tooltipMore}>and {items.length - MAX_TOOLTIP_ITEMS} more</Text>
              )}
            </View>
          )}
        </View>
      )}

      <View style={styles.labelRow}>
        {points.map((p, i) => (
          <Text key={p.label} style={[styles.label, i === 0 || i === points.length - 1 ? undefined : styles.labelFaded]} numberOfLines={1}>
            {p.label}
          </Text>
        ))}
      </View>

      <View style={styles.peakBadge}>
        <View style={[styles.peakDot, { backgroundColor: color }]} />
        <Text style={styles.peakText}>Peak {formatValue(peak.value)}</Text>
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
  peakBadge: {
    position: "absolute", top: 0, right: 12, flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(35, 64, 92, 0.7)", borderRadius: 100, paddingVertical: 4, paddingHorizontal: 10,
    borderWidth: 1, borderColor: "rgba(167, 139, 250, 0.35)",
  },
  peakDot: { width: 6, height: 6, borderRadius: 3 },
  peakText: { color: "#e8edf3", fontSize: 11, fontWeight: "600" },

  hitArea: { position: "absolute", top: 0, left: 0 },
  tooltip: {
    position: "absolute", zIndex: 10,
    backgroundColor: "rgba(13, 24, 38, 0.96)", borderRadius: 10, padding: 12, gap: 2,
    borderWidth: 1, borderColor: "rgba(167, 139, 250, 0.4)",
    boxShadow: "0 8px 28px rgba(0, 0, 0, 0.45)",
  },
  tooltipDate: { color: "#a7b7cb", fontSize: 11, fontWeight: "600" },
  tooltipTotal: { color: "#e8edf3", fontSize: 18, fontWeight: "800", marginBottom: 2 },
  tooltipItems: { borderTopWidth: 1, borderTopColor: "#23405c", marginTop: 6, paddingTop: 8, gap: 7 },
  tooltipRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  tooltipBullet: { width: 7, height: 7, borderRadius: 4 },
  tooltipName: { color: "#e8edf3", fontSize: 12, fontWeight: "600" },
  tooltipSub: { color: "#6f83a0", fontSize: 11 },
  tooltipValue: { color: "#4cc493", fontSize: 12, fontWeight: "700" },
  tooltipMore: { color: "#6f83a0", fontSize: 11, marginTop: 2 },
});
