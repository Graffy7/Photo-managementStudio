import { View, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

interface Blob {
  size: number;
  top: string;
  left: string;
  color: string;
  opacity: number;
}

// Fixed, hand-placed bokeh orbs — the out-of-focus-lens look that reads as "camera" at a glance,
// scattered off-grid on purpose so it doesn't feel like a repeating pattern.
const BLOBS: Blob[] = [
  { size: 260, top: "-8%", left: "-6%", color: "#ff9a4d", opacity: 0.16 },
  { size: 140, top: "62%", left: "-4%", color: "#7fc0e6", opacity: 0.14 },
  { size: 90, top: "8%", left: "78%", color: "#ff9a4d", opacity: 0.12 },
  { size: 320, top: "55%", left: "68%", color: "#5aa2cc", opacity: 0.12 },
  { size: 60, top: "38%", left: "18%", color: "#ffb877", opacity: 0.1 },
  { size: 180, top: "-10%", left: "48%", color: "#7fc0e6", opacity: 0.09 },
  { size: 46, top: "80%", left: "40%", color: "#ff9a4d", opacity: 0.15 },
];

export function BokehBackground() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={["#0a1420", "#132540", "#0d1826"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {BLOBS.map((blob, i) => (
        <LinearGradient
          key={i}
          colors={[`${blob.color}${Math.round(blob.opacity * 255).toString(16).padStart(2, "0")}`, `${blob.color}00`]}
          start={{ x: 0.3, y: 0.3 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.blob,
            {
              width: blob.size,
              height: blob.size,
              borderRadius: blob.size / 2,
              top: blob.top as any,
              left: blob.left as any,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  blob: {
    position: "absolute",
  },
});
