import { StyleSheet, View, Image, useWindowDimensions } from "react-native";
import Svg, { Defs, LinearGradient, RadialGradient, Stop, Rect, Circle, Path, G } from "react-native-svg";

// A sunset-over-the-mountains backdrop for the sign-in page, drawn in vector so it needs no image
// file and stays sharp at any size. Set EXPO_PUBLIC_LOGIN_PHOTO_URL to show a real photo instead
// (for example one of the studio's own shots).
const PHOTO_URL = process.env.EXPO_PUBLIC_LOGIN_PHOTO_URL;

// A row of pine trees along a line, sized from back (small) to front (large).
function pines(xFrom: number, xTo: number, baseY: (x: number) => number, size: number, step: number, seed: number): string {
  let d = "";
  let i = 0;
  for (let x = xFrom; x <= xTo; x += step) {
    const jitter = ((Math.sin((x + seed) * 12.9898) * 43758.5453) % 1 + 1) % 1;
    const h = size * (0.7 + jitter * 0.6);
    const w = h * 0.36;
    const y = baseY(x);
    // three stacked triangles make a fir silhouette
    d += `M${x} ${y - h} L${x - w * 0.55} ${y - h * 0.55} L${x - w * 0.3} ${y - h * 0.55} L${x - w * 0.8} ${y - h * 0.2} L${x - w * 0.4} ${y - h * 0.2} L${x - w} ${y} L${x + w} ${y} L${x + w * 0.4} ${y - h * 0.2} L${x + w * 0.8} ${y - h * 0.2} L${x + w * 0.3} ${y - h * 0.55} L${x + w * 0.55} ${y - h * 0.55} Z `;
    i++;
  }
  return d;
}

export function LoginScenery() {
  const { width, height } = useWindowDimensions();
  if (PHOTO_URL) {
    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Image source={{ uri: PHOTO_URL }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(20,18,22,0.45)" }]} />
      </View>
    );
  }

  // Drawn on a 1600x900 canvas, scaled to cover the screen.
  const W = 1600;
  const H = 900;
  const slope = (x: number) => 560 - (x - 600) * 0.42; // the snowy hillside rising to the right
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width={width} height={height} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice">
        <Defs>
          <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#3B4054" />
            <Stop offset="0.3" stopColor="#7A5A5E" />
            <Stop offset="0.52" stopColor="#C97B49" />
            <Stop offset="0.68" stopColor="#E6A263" />
            <Stop offset="1" stopColor="#F2C48E" />
          </LinearGradient>
          <RadialGradient id="sun" cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0" stopColor="#FFE2B0" stopOpacity="0.95" />
            <Stop offset="0.35" stopColor="#F2B36E" stopOpacity="0.55" />
            <Stop offset="1" stopColor="#E59A5A" stopOpacity="0" />
          </RadialGradient>
          <LinearGradient id="snow" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#C4BEC4" />
            <Stop offset="0.45" stopColor="#8C8796" />
            <Stop offset="1" stopColor="#4A4956" />
          </LinearGradient>
          <LinearGradient id="shade" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#14121A" stopOpacity="0.25" />
            <Stop offset="0.5" stopColor="#14121A" stopOpacity="0.1" />
            <Stop offset="1" stopColor="#14121A" stopOpacity="0.5" />
          </LinearGradient>
        </Defs>

        <Rect x="0" y="0" width={W} height={H} fill="url(#sky)" />
        <Circle cx="300" cy="500" r="320" fill="url(#sun)" />

        {/* distant ranges */}
        <Path d="M0 600 L120 540 L210 575 L330 500 L450 560 L560 520 L700 585 L820 540 L980 600 L1600 600 L1600 900 L0 900 Z" fill="#6F5964" opacity="0.75" />
        <Path d="M0 650 L90 610 L200 640 L300 595 L420 650 L520 620 L660 670 L780 640 L900 690 L1600 690 L1600 900 L0 900 Z" fill="#46404D" opacity="0.9" />

        {/* far tree line */}
        <G fill="#2A2731" opacity="0.95">
          <Path d={pines(10, 640, () => 690, 46, 22, 3)} />
        </G>

        {/* snowy slope rising to the right */}
        <Path d={`M560 ${slope(560)} L${W} ${slope(W)} L${W} ${H} L0 ${H} L0 760 Z`} fill="url(#snow)" />
        <Path d={`M560 ${slope(560)} L${W} ${slope(W)}`} stroke="#B9B2B8" strokeWidth="3" opacity="0.5" />

        {/* pines on the ridge and in the foreground */}
        <G fill="#1C1B22">
          <Path d={pines(980, 1590, (x) => slope(x) + 8, 120, 46, 7)} />
          <Path d={pines(0, 520, () => 900, 190, 70, 11)} />
        </G>

        {/* soft vignette so text on both sides stays readable */}
        <Rect x="0" y="0" width={W} height={H} fill="url(#shade)" />
      </Svg>
    </View>
  );
}
