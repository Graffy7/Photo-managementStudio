import { Platform } from "react-native";
import { colors } from "./theme";

// Web only: slim, dark scrollbars that match the app instead of the browser's wide white ones,
// momentum scrolling on touch devices, and no "rubber band" scroll chaining from an inner list or
// table into the page behind it. Added once, when the app starts.
const STYLE_ID = "studio-os-scrollbars";

export function installWebScrollbars() {
  if (Platform.OS !== "web" || typeof document === "undefined" || document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
* { scrollbar-width: thin; scrollbar-color: ${colors.borderStrong} transparent; }
*::-webkit-scrollbar { width: 10px; height: 10px; }
*::-webkit-scrollbar-track { background: transparent; }
*::-webkit-scrollbar-thumb { background: ${colors.borderStrong}; border-radius: 8px; border: 2px solid ${colors.page}; }
*::-webkit-scrollbar-thumb:hover { background: ${colors.textFaint}; }
*::-webkit-scrollbar-corner { background: transparent; }
html, body { overscroll-behavior: none; }
[data-scroll-contain] { overscroll-behavior: contain; -webkit-overflow-scrolling: touch; }
`;
  document.head.appendChild(style);
}
