import { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, AccessibilityInfo } from "react-native";
import Svg, { Circle, Defs, G, LinearGradient, Stop } from "react-native-svg";

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

const SWEEP_MS = 1200;
// Visible space between two statuses on the ring, in pixels.
const GAP_PX = 5;

export function DonutChart({ segments, size = 160, strokeWidth = 14, centerLabel, centerValue }: DonutChartProps) {
  const [progress, setProgress] = useState(0);
  const [hover, setHover] = useState<number | null>(null);

  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const dataKey = segments.map((s) => `${s.label}:${s.value}`).join("|");

  // Sweep the ring in (and count the centre number up) once per data set.
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
          const t = Math.min(1, (Date.now() - start) / SWEEP_MS);
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

  const center = size / 2;
  const radius = (size - strokeWidth) / 2 - 8; // room for the glow around the ring
  const circumference = 2 * Math.PI * radius;

  // Only statuses that actually have events get a slice; gaps only appear between two or more.
  const visible = segments.map((s, i) => ({ ...s, index: i })).filter((s) => s.value > 0);
  const useGaps = visible.length > 1;
  // Round caps poke out strokeWidth/2 past each end of a dash, so trim that plus the gap.
  const trim = useGaps ? strokeWidth + GAP_PX : 0;

  let startSoFar = 0;
  const arcs = visible.map((s) => {
    const full = (s.value / total) * circumference;
    const drawn = full * progress;
    const dash = useGaps ? Math.max(0.01, drawn - trim) : drawn;
    const arc = { ...s, dash, start: startSoFar * progress + (useGaps ? trim / 2 : 0), share: s.value / total };
    startSoFar += full;
    return arc;
  });

  const active = hover !== null ? segments[hover] : null;
  const activeShare = active && total > 0 ? Math.round((active.value / total) * 100) : 0;
  const shownValue =
    active ? active.value
    : typeof centerValue === "number" ? Math.round(centerValue * progress)
    : centerValue;

  // Pointer over the ring: work out which slice from the angle (0 = top, clockwise).
  const pickAt = (x: number, y: number) => {
    if (total === 0) return;
    const dx = x - center;
    const dy = y - center;
    const dist = Math.hypot(dx, dy);
    if (dist < radius - strokeWidth * 1.5 || dist > radius + strokeWidth * 1.5) {
      setHover(null);
      return;
    }
    const angle = (Math.atan2(dy, dx) + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2);
    const fraction = angle / (Math.PI * 2);
    let acc = 0;
    for (const s of visible) {
      acc += s.value / total;
      if (fraction <= acc) {
        setHover(s.index);
        return;
      }
    }
  };

  return (
    <View style={styles.row}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <Defs>
            {segments.map((s, i) => (
              <LinearGradient key={s.label} id={`seg${i}`} x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={s.color} stopOpacity={1} />
                <Stop offset="1" stopColor={s.color} stopOpacity={0.72} />
              </LinearGradient>
            ))}
          </Defs>

          {/* The empty track the slices sweep around. */}
          <Circle cx={center} cy={center} r={radius} stroke="#1b2c42" strokeWidth={strokeWidth} fill="none" opacity={0.7} />

          {arcs.map((a) => {
            const dim = hover !== null && hover !== a.index;
            const lit = hover === a.index;
            const common = {
              cx: center,
              cy: center,
              r: radius,
              fill: "none",
              strokeDasharray: `${a.dash} ${circumference}`,
              strokeDashoffset: -a.start,
              strokeLinecap: (useGaps ? "round" : "butt") as "round" | "butt",
              rotation: -90,
              // originX/originY rather than the combined `origin` string: on the web that one
              // reaches the DOM as a hyphenated attribute and React warns about it.
              originX: center,
              originY: center,
            };
            return (
              <G key={a.label}>
                {/* Glow: the same slice drawn wider and faint underneath. */}
                <Circle {...common} stroke={a.color} strokeWidth={strokeWidth + (lit ? 16 : 11)} opacity={dim ? 0.03 : lit ? 0.2 : 0.1} />
                <Circle {...common} stroke={`url(#seg${a.index})`} strokeWidth={lit ? strokeWidth + 3 : strokeWidth} opacity={dim ? 0.3 : 1} />
              </G>
            );
          })}
        </Svg>

        <View style={[styles.center, { width: size, height: size }]} pointerEvents="none">
          <Text style={[styles.centerValue, active && { color: active.color }]}>{shownValue}</Text>
          <Text style={styles.centerLabel}>{active ? `${active.label} · ${activeShare}%` : centerLabel}</Text>
        </View>

        {/* Hover across the ring on the web; tap a slice on a phone. */}
        <View
          style={[styles.hitArea, { width: size, height: size }]}
          onPointerMove={(e) => pickAt(e.nativeEvent.offsetX, e.nativeEvent.offsetY)}
          onPointerDown={(e) => pickAt(e.nativeEvent.offsetX, e.nativeEvent.offsetY)}
          onPointerLeave={() => setHover(null)}
          onStartShouldSetResponder={() => true}
          onResponderGrant={(e) => pickAt(e.nativeEvent.locationX, e.nativeEvent.locationY)}
        />
      </View>

      <View style={styles.legend}>
        {segments.map((s, i) => {
          const share = total > 0 ? s.value / total : 0;
          const dim = hover !== null && hover !== i;
          return (
            <Pressable
              key={s.label}
              style={[styles.legendItem, hover === i && styles.legendItemActive, dim && styles.legendDim]}
              onHoverIn={() => setHover(i)}
              onHoverOut={() => setHover(null)}
              onPress={() => setHover((h) => (h === i ? null : i))}
            >
              <View style={styles.legendRow}>
                <View style={[styles.dot, { backgroundColor: s.color, boxShadow: `0 0 8px ${s.color}` }]} />
                <Text style={styles.legendLabel}>{s.label}</Text>
                <Text style={styles.legendValue}>{s.value}</Text>
                <Text style={styles.legendShare}>{Math.round(share * 100)}%</Text>
              </View>
              <View style={styles.bar}>
                <View style={[styles.barFill, { width: `${share * 100 * progress}%`, backgroundColor: s.color }]} />
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 18 },
  center: { position: "absolute", top: 0, left: 0, alignItems: "center", justifyContent: "center" },
  centerValue: { fontSize: 30, fontWeight: "800", color: "#e8edf3" },
  centerLabel: { fontSize: 11, color: "#6f83a0", marginTop: 2 },
  hitArea: { position: "absolute", top: 0, left: 0 },

  legend: { gap: 4, flex: 1 },
  legendItem: { borderRadius: 8, paddingVertical: 6, paddingHorizontal: 8, gap: 6, borderWidth: 1, borderColor: "transparent" },
  legendItemActive: { backgroundColor: "rgba(127, 192, 230, 0.06)", borderColor: "#23405c" },
  legendDim: { opacity: 0.45 },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  legendLabel: { color: "#a7b7cb", fontSize: 13, flex: 1 },
  legendValue: { color: "#e8edf3", fontSize: 13, fontWeight: "700" },
  legendShare: { color: "#6f83a0", fontSize: 11, width: 34, textAlign: "right" },
  bar: { height: 3, borderRadius: 2, backgroundColor: "#1b2c42", overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 2 },
});
