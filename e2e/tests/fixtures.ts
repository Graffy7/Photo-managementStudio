import { test as base, expect, type Page, type APIRequestContext, request } from "@playwright/test";
import path from "node:path";
import { QA } from "../qa.config";

// Every test watches the browser while it runs: console errors, uncaught page errors, server
// errors (5xx) and requests that never got an answer. They're attached to the report, and the
// test fails if any appeared that the test didn't expect.
type Problems = { console: string[]; pageErrors: string[]; serverErrors: string[]; failedRequests: string[] };

// Noise that isn't a defect in the app: an external web font the test machine can't reach, and
// 401s that the app answers itself by refreshing the session.
const IGNORED = [
  /fonts\.(googleapis|gstatic)\.com/i,
  /ERR_NAME_NOT_RESOLVED/i,
  /status of 401/i,
  /Download the React DevTools/i,
];

export const test = base.extend<{ problems: Problems; allowProblems: (re: RegExp) => void }>({
  problems: async ({ page }, use, testInfo) => {
    const p: Problems = { console: [], pageErrors: [], serverErrors: [], failedRequests: [] };
    const allowed: RegExp[] = [];
    (page as Page & { __allow?: RegExp[] }).__allow = allowed;
    page.on("console", (m) => { if (m.type() === "error") p.console.push(m.text()); });
    page.on("pageerror", (e) => p.pageErrors.push(`${e.name}: ${e.message}`));
    page.on("response", (r) => { if (r.status() >= 500) p.serverErrors.push(`${r.status()} ${r.request().method()} ${r.url()}`); });
    page.on("requestfailed", (r) => {
      const f = r.failure()?.errorText ?? "";
      if (!/ERR_ABORTED|NS_BINDING_ABORTED/i.test(f)) p.failedRequests.push(`${r.method()} ${r.url()} — ${f}`);
    });
    await use(p);
    const skip = (s: string) => [...IGNORED, ...allowed].some((re) => re.test(s));
    const unexpected = {
      console: p.console.filter((s) => !skip(s)),
      pageErrors: p.pageErrors.filter((s) => !skip(s)),
      serverErrors: p.serverErrors.filter((s) => !skip(s)),
      failedRequests: p.failedRequests.filter((s) => !skip(s)),
    };
    await testInfo.attach("browser-problems.json", { body: JSON.stringify({ all: p, unexpected }, null, 2), contentType: "application/json" });
    expect(unexpected, "no unexpected console errors, page errors, 5xx responses or failed requests").toEqual({
      console: [], pageErrors: [], serverErrors: [], failedRequests: [],
    });
  },
  // A test that expects an error (e.g. a negative case) lists it here so it isn't counted.
  allowProblems: async ({ page }, use) => {
    await use((re: RegExp) => { (page as Page & { __allow?: RegExp[] }).__allow?.push(re); });
  },
  page: async ({ page }, use) => {
    await use(page);
  },
});

// Auto-use the watcher in every test that has a page.
export const it = test.extend<{ _watch: void }>({
  _watch: [async ({ problems }, use) => { void problems; await use(); }, { auto: true }],
});

export { expect };

export const authFile = (studio: "a" | "b") => path.join(QA.authDir, `${studio}.json`);
export const adminAuthFile = path.join(QA.authDir, "admin.json");

// Sign in to the QA API directly (used for API-level checks such as tenant isolation).
export async function apiAs(studio: "a" | "b" | "admin"): Promise<{ api: APIRequestContext; token: string }> {
  const creds = studio === "admin" ? QA.superAdmin : QA.studios[studio];
  const api = await request.newContext({ baseURL: QA.apiUrl });
  const res = await api.post("/api/auth/login", { data: { email: creds.email, password: creds.password, rememberMe: false } });
  expect(res.ok(), `QA ${studio} signs in to the API`).toBeTruthy();
  const token = (await res.json()).accessToken as string;
  const authed = await request.newContext({ baseURL: QA.apiUrl, extraHTTPHeaders: { Authorization: `Bearer ${token}` } });
  await api.dispose();
  return { api: authed, token };
}

// Unique values so repeated runs and parallel layouts never collide.
export const uid = () => `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
export const mobileNo = () => `9${Math.floor(100000000 + Math.random() * 899999999)}`;
