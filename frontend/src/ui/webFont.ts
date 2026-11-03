import { Platform } from "react-native";

// Uses Inter for all app text on the web, without touching icon fonts or adding a package.
//
// react-native-web draws text in the system font stack ("-apple-system, BlinkMacSystemFont,
// 'Segoe UI', ..."). We load Inter's @font-face rules from Google Fonts and register them under
// those system names too, so every piece of text picks Inter up while icons (their own font
// family) are left alone. Offline, or if the request fails, the normal system font is used.
const FAMILY_ALIASES = ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI"];
const CSS_URL = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap";

export function installWebFont(): void {
  if (Platform.OS !== "web" || typeof document === "undefined") return;
  if (document.getElementById("studio-os-font")) return;

  const preconnect = document.createElement("link");
  preconnect.rel = "preconnect";
  preconnect.href = "https://fonts.gstatic.com";
  preconnect.crossOrigin = "anonymous";
  document.head.appendChild(preconnect);

  fetch(CSS_URL)
    .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
    .then((css) => {
      const blocks = css.match(/@font-face\s*{[^}]*}/g) ?? [];
      const aliased = FAMILY_ALIASES.flatMap((family) =>
        blocks.map((b) => b.replace(/font-family:\s*'[^']*'/, `font-family: '${family}'`)));
      const style = document.createElement("style");
      style.id = "studio-os-font";
      style.textContent = aliased.join("\n");
      document.head.appendChild(style);
    })
    .catch(() => undefined);
}
