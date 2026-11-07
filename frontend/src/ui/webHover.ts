import { Platform } from "react-native";

// Web only: one shared hover effect for cards, tiles and calendar days, so every module reacts the
// same way when the pointer is over something. Mark an element by spreading one of these into its
// props: <View {...hoverLift} style={...}>.
//   hoverLift - small things you can point at (cards, tiles, calendar days): rises 2px, blue edge, glow
//   hoverGlow - large panels: blue edge and glow, no movement
// The change is instant when the system asks for reduced motion and eases in otherwise.
const STYLE_ID = "studio-os-hover";

export const hoverLift = (Platform.OS === "web" ? { dataSet: { hover: "lift" } } : {}) as object;
export const hoverGlow = (Platform.OS === "web" ? { dataSet: { hover: "glow" } } : {}) as object;

export function installWebHover() {
  if (Platform.OS !== "web" || typeof document === "undefined" || document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  // !important: the app's own styles are applied inline or as single classes, so the hover state
  // has to win over them while the pointer is there.
  style.textContent = `
[data-hover] { transition: transform 200ms cubic-bezier(0.2, 0, 0, 1), box-shadow 200ms cubic-bezier(0.2, 0, 0, 1), border-color 200ms cubic-bezier(0.2, 0, 0, 1); }
[data-hover="lift"]:hover { transform: translateY(-2px) !important; border-color: rgba(91,155,255,0.6) !important; box-shadow: 0 10px 26px rgba(47,123,255,0.3) !important; }
[data-hover="glow"]:hover { border-color: rgba(91,155,255,0.45) !important; box-shadow: 0 10px 30px rgba(47,123,255,0.18) !important; }
@media (prefers-reduced-motion: reduce) { [data-hover] { transition: none; } }
`;
  document.head.appendChild(style);
}
