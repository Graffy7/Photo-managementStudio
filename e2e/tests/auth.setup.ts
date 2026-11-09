import { test as setup, expect, request } from "@playwright/test";
import fs from "node:fs";
import { QA } from "../qa.config";
import { authFile, adminAuthFile } from "./fixtures";

const FEATURES = [
  "CUSTOMERS", "DASHBOARD", "DAY_BOARD", "EVENTS", "EXPENSES", "GALLERY", "LEADS", "NOTIFICATIONS", "PAYMENTS",
  "PHOTO_DELIVERY", "PHOTO_SELECTION", "QUOTATIONS", "REPORTS", "SERVICES", "SETTINGS", "WHATSAPP", "WORKERS",
];

setup("QA Super Admin creates two studios with every module on", async () => {
  fs.mkdirSync(QA.authDir, { recursive: true });
  const api = await request.newContext({ baseURL: QA.apiUrl });
  const login = await api.post("/api/auth/login", { data: { email: QA.superAdmin.email, password: QA.superAdmin.password, rememberMe: false } });
  expect(login.status(), "seeded QA Super Admin signs in").toBe(200);
  const headers = { Authorization: `Bearer ${(await login.json()).accessToken}` };

  const today = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  for (const key of ["a", "b"] as const) {
    const s = QA.studios[key];
    const res = await api.post("/api/studios", {
      headers,
      data: {
        studioName: s.name, phoneNumber: key === "a" ? "9876500001" : "9876500002", ownerFullName: s.owner,
        ownerEmail: s.email, ownerPassword: s.password, subscriptionPlanId: 0, freeTrial: true,
        trialStartDate: iso(today), trialEndDate: iso(new Date(today.getTime() + 30 * 86400000)),
      },
    });
    // 409: the studio is already there from an earlier run against the same QA database - reuse it.
    let studioId: number;
    if (res.status() === 409) {
      const list = await (await api.get("/api/studios?pageSize=100", { headers })).json();
      const found = (list.items ?? list).find((x: { studioName: string }) => x.studioName === s.name);
      expect(found, `${s.name} already exists in the QA database`).toBeTruthy();
      studioId = found.studioId;
    } else {
      expect(res.status(), `create ${s.name}`).toBe(201);
      studioId = (await res.json()).studioId;
    }
    for (const f of FEATURES) {
      const on = await api.post(`/api/studios/${studioId}/features/${f}/enable`, { headers });
      expect(on.ok(), `enable ${f} for ${s.name}`).toBeTruthy();
    }
  }
  await api.dispose();
});

setup("QA Super Admin signs in through the sign-in page", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Email address").fill(QA.superAdmin.email);
  await page.getByLabel("Password").fill(QA.superAdmin.password);
  await page.getByText("Remember Me").click();
  await page.getByText("Sign in now").click();
  await expect(page.getByRole("button", { name: /Studios$/ })).toBeVisible({ timeout: 30_000 });
  await page.context().storageState({ path: adminAuthFile });
});

for (const key of ["a", "b"] as const) {
  setup(`owner of ${QA.studios[key].name} signs in through the sign-in page`, async ({ page }) => {
    const s = QA.studios[key];
    await page.goto("/");
    await page.getByLabel("Email address").fill(s.email);
    await page.getByLabel("Password").fill(s.password);
    await page.getByText("Remember Me").click();
    await page.getByText("Sign in now").click();
    await expect(page.getByText(/Good (morning|afternoon|evening)/)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(s.name)).toBeVisible();
    await page.context().storageState({ path: authFile(key) });
  });
}
