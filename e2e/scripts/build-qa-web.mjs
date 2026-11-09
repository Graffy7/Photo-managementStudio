// Builds the real website (production export) pointed at the QA API, into e2e/.qa-web. Run it
// again after changing the app so the tests see the latest code.
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const frontend = path.resolve(here, "..", "..", "frontend");
const out = path.resolve(here, "..", ".qa-web");
const apiUrl = "http://localhost:5238";

execSync(`npx expo export --platform web --output-dir "${out}" --clear`, {
  cwd: frontend,
  stdio: "inherit",
  // Set before Expo reads frontend/.env, so this wins over the developer's own API address.
  env: { ...process.env, EXPO_PUBLIC_API_BASE_URL: apiUrl },
});

// Make sure the bundle really talks to the QA API, not the developer's one.
const js = fs.readdirSync(path.join(out, "_expo", "static", "js", "web")).map((f) => fs.readFileSync(path.join(out, "_expo", "static", "js", "web", f), "utf8")).join("");
if (!js.includes(apiUrl)) throw new Error(`The QA web build does not point at ${apiUrl}.`);
if (js.includes("localhost:5237")) throw new Error("The QA web build still contains the developer API address (5237).");
console.log(`QA website built into ${out}, talking to ${apiUrl}.`);
