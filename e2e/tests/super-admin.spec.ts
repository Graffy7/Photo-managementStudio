import { it, expect, adminAuthFile, apiAs, uid, mobileNo } from "./fixtures";
import { request, type APIRequestContext, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { QA } from "../qa.config";

// Phase 1 - the Super Admin console. State-changing checks run on a third studio, QA Studio
// Gamma, created here through the New studio form, so Alpha and Beta stay as the other suites
// expect them. Every Super Admin action is also checked from the owner's side (API).
const tag = uid();
const gamma = { name: `QA Studio Gamma ${tag}`, owner: "QA Owner Gamma", email: `qa-owner-g-${tag}@studioos.test`, password: `QaGamma!${tag}` };
let gammaId = 0;

// Runs a read-only SQL query against the QA database (never the real one).
function qaSql(query: string): string {
  return execFileSync("sqlcmd", ["-S", QA.sqlServer, "-E", "-C", "-d", QA.database, "-W", "-h", "-1", "-Q", `SET NOCOUNT ON; ${query}`]).toString().trim();
}

async function ownerLogin(): Promise<{ status: number; body: { accessToken?: string; message?: string } }> {
  const api = await request.newContext({ baseURL: QA.apiUrl });
  const res = await api.post("/api/auth/login", { data: { email: gamma.email, password: gamma.password, rememberMe: false } });
  const out = { status: res.status(), body: await res.json().catch(() => ({})) };
  await api.dispose();
  return out;
}

async function asGamma(): Promise<APIRequestContext> {
  const login = await ownerLogin();
  expect(login.status, "Gamma owner signs in").toBe(200);
  return request.newContext({ baseURL: QA.apiUrl, extraHTTPHeaders: { Authorization: `Bearer ${login.body.accessToken}` } });
}

// A write the owner would do every day (add a customer) - shows whether the studio may change things.
const tryWrite = (api: APIRequestContext) => api.post("/api/customers", { data: { fullName: `QA Gamma Customer ${uid()}`, mobileNumber: mobileNo() } });

async function openStudio(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Studios$/ }).click();
  await page.getByPlaceholder("Search studio, owner, email or phone").fill(gamma.name);
  await page.getByText(gamma.name, { exact: true }).first().click();
  await expect(page.getByText("Edit details")).toBeVisible();
}

it.use({ storageState: adminAuthFile });

it.describe.serial("Phase 1 - Super Admin", () => {
  it("every console page opens: Dashboard, Studios, Payments, Storage, Activity", async ({ page }) => {
    await page.goto("/");
    for (const [nav, expectText] of [
      ["Dashboard", /studios/i], ["Studios", /New studio/], ["Payments", /payment/i], ["Storage", /storage/i], ["Activity", /activity/i],
    ] as const) {
      await page.getByRole("button", { name: new RegExp(`${nav}$`) }).click();
      await expect(page.getByText(expectText).filter({ visible: true }).first()).toBeVisible();
    }
  });

  it("New studio: an empty form is refused, then create QA Studio Gamma on the default free trial", async ({ page, allowProblems }) => {
    // The form has no on-screen check for the studio details; the server refuses the empty form
    // (400) and the app shows its message. Expected here, so not counted as an error.
    allowProblems(/status of 400/);
    await page.goto("/");
    await page.getByRole("button", { name: /Studios$/ }).click();
    await page.getByText("New studio", { exact: true }).first().click();
    await page.getByText("Create studio").click();
    await expect(page.getByText(/studio name|required|enter/i).filter({ visible: true }).first()).toBeVisible();

    await page.getByPlaceholder("Aperture Weddings").fill(gamma.name);
    await page.getByPlaceholder("Priya Shah").fill(gamma.owner);
    await page.getByPlaceholder("owner@studio.com").fill(gamma.email);
    await page.getByPlaceholder("At least 8 characters").fill(gamma.password);
    await page.getByText("Free trial", { exact: true }).click();
    await page.getByText("Create studio").click();
    await page.getByPlaceholder("Search studio, owner, email or phone").fill(gamma.name);
    await expect(page.getByText(gamma.name, { exact: true }).first()).toBeVisible();

    gammaId = Number(qaSql(`SELECT StudioId FROM Studios WHERE StudioName = N'${gamma.name}'`));
    expect(gammaId, "Gamma saved in the QA database").toBeGreaterThan(0);
    // The owner can sign in straight away.
    expect((await ownerLogin()).status).toBe(200);
  });

  it("the same owner email can't be used for a second studio", async () => {
    const { api } = await apiAs("admin");
    const iso = (d: number) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);
    const res = await api.post("/api/studios", { data: {
      studioName: `QA Duplicate ${tag}`, ownerFullName: "Dup", ownerEmail: gamma.email, ownerPassword: "Duplicate!123",
      subscriptionPlanId: 0, freeTrial: true, trialStartDate: iso(0), trialEndDate: iso(14),
    } });
    expect(res.status()).toBe(409);
    await api.dispose();
  });

  it("studio detail: every tab opens; Edit details saves", async ({ page }) => {
    await openStudio(page);
    for (const tab of ["Overview", "Modules", "Subscription & Payments", "Usage & Storage", "Activity", "Trial"]) {
      // .last(): "Activity" is also a menu item on the left; the studio's own tab comes after it.
      await page.getByText(tab, { exact: true }).filter({ visible: true }).last().click();
      await page.waitForLoadState("networkidle");
    }
    await page.getByText("Overview", { exact: true }).filter({ visible: true }).first().click();
    await page.getByText("Edit details").click();
    const phone = page.getByPlaceholder("Optional").first();
    await phone.fill("9800012345");
    await page.getByText("Save changes").click();
    await expect.poll(() => qaSql(`SELECT PhoneNumber FROM Studios WHERE StudioId = ${gammaId}`)).toBe("9800012345");
  });

  it("module switched off: hidden from the owner and refused by the server; switched on again works", async ({ page }) => {
    await openStudio(page);
    await page.getByText("Modules", { exact: true }).filter({ visible: true }).first().click();
    const expensesSwitch = page.getByRole("switch", { name: "Expenses", exact: true });
    await expensesSwitch.click();
    const ask = page.getByRole("alert").filter({ hasText: /Switch off Expenses\?/ });
    await expect(ask).toBeVisible();
    await ask.getByText("Switch off", { exact: true }).click();

    const g = await asGamma();
    await expect.poll(async () => (await g.get("/api/expenses")).status(), { message: "expenses refused once the module is off" }).toBe(403);
    const mine = await (await g.get("/api/features/my-features")).json();
    expect(mine.EXPENSES, "the owner's module list shows Expenses as off").toBe(false);

    await expensesSwitch.click(); // switching on doesn't ask
    await expect.poll(async () => (await g.get("/api/expenses")).status()).toBe(200);
    expect((await (await g.get("/api/features/my-features")).json()).EXPENSES).toBe(true);
    await g.dispose();
  });

  it("access mode Read-only: owner can read but every change is refused at once; Auto restores", async () => {
    const { api } = await apiAs("admin");
    const g = await asGamma();
    expect((await tryWrite(g)).ok(), "full access before").toBeTruthy();

    expect((await api.put(`/api/admin/studios/${gammaId}/access`, { data: { mode: "ReadOnly" } })).ok()).toBeTruthy();
    const refused = await tryWrite(g);
    expect(refused.status(), "a write right after switching to read-only (no 30-second delay)").toBe(402);
    expect((await refused.json()).code).toBe("SUBSCRIPTION_READ_ONLY");
    expect((await g.get("/api/customers")).ok(), "reading still works").toBeTruthy();

    expect((await api.put(`/api/admin/studios/${gammaId}/access`, { data: { mode: "Auto" } })).ok()).toBeTruthy();
    expect((await tryWrite(g)).ok(), "full access again under Auto with a running trial").toBeTruthy();
    await g.dispose();
    await api.dispose();
  });

  it("subscription: Expire now makes the studio read-only; extending restores it; days remaining are right", async ({ page }) => {
    const { api } = await apiAs("admin");
    const g = await asGamma();

    await openStudio(page);
    await page.getByText("Subscription & Payments", { exact: true }).filter({ visible: true }).first().click();
    await page.getByText("Expire now", { exact: true }).click();
    await page.getByRole("alert").getByText(/Expire|Yes|Apply/).last().click();

    await expect.poll(async () => (await tryWrite(g)).status(), { message: "writes refused once expired" }).toBe(402);
    expect((await g.get("/api/customers")).ok(), "reading still works when expired").toBeTruthy();
    const sub = await (await api.get(`/api/admin/studios/${gammaId}/subscription`)).json();
    expect(sub.status).toBe("Expired");

    expect((await api.post(`/api/admin/studios/${gammaId}/subscription/extend`, { data: { days: 30 } })).ok()).toBeTruthy();
    expect((await tryWrite(g)).ok(), "full access again after extending").toBeTruthy();
    const after = await (await api.get(`/api/admin/studios/${gammaId}/subscription`)).json();
    expect(after.daysRemaining, "days remaining after a 30-day extension").toBeGreaterThanOrEqual(29);
    expect(after.daysRemaining).toBeLessThanOrEqual(31);
    await g.dispose();
    await api.dispose();
  });

  it("trial: end now → read-only; start a 14-day trial → full access with 14 days left", async () => {
    const { api } = await apiAs("admin");
    const g = await asGamma();
    expect((await api.post(`/api/admin/studios/${gammaId}/trial/end`)).ok()).toBeTruthy();
    expect((await tryWrite(g)).status(), "read-only once the trial is ended").toBe(402);
    expect((await api.post(`/api/admin/studios/${gammaId}/trial/start`, { data: { days: 14 } })).ok()).toBeTruthy();
    expect((await tryWrite(g)).ok(), "full access on the new trial").toBeTruthy();
    const t = await (await api.get(`/api/admin/studios/${gammaId}/subscription`)).json();
    expect(t.isTrial).toBe(true);
    expect(t.daysRemaining).toBeGreaterThanOrEqual(13);
    expect(t.daysRemaining).toBeLessThanOrEqual(14);
    // Boundaries: zero or negative days are refused.
    for (const days of [0, -5]) {
      expect([400, 422], `trial/extend with ${days} days`).toContain((await api.post(`/api/admin/studios/${gammaId}/trial/extend`, { data: { days } })).status());
    }
    await g.dispose();
    await api.dispose();
  });

  it("deactivate: owner can't sign in and an open session is cut off; activate restores", async () => {
    const { api } = await apiAs("admin");
    const g = await asGamma();
    expect((await api.post(`/api/studios/${gammaId}/deactivate`)).ok()).toBeTruthy();
    const login = await ownerLogin();
    expect(login.status, "sign-in refused while inactive").not.toBe(200);
    expect((await g.get("/api/customers")).status(), "an already-open session is refused too").toBe(403);
    expect((await api.post(`/api/studios/${gammaId}/activate`)).ok()).toBeTruthy();
    expect((await ownerLogin()).status, "sign-in works again").toBe(200);
    await g.dispose();
    await api.dispose();
  });

  it("suspend (block): owner locked out; restore lets them back in", async () => {
    const { api } = await apiAs("admin");
    expect((await api.post(`/api/studios/${gammaId}/block`)).ok()).toBeTruthy();
    expect((await ownerLogin()).status, "sign-in refused while suspended").not.toBe(200);
    const list = await (await api.get(`/api/admin/studios?search=${encodeURIComponent(gamma.name)}&page=1&pageSize=5`)).json();
    expect(list.items[0].status).toBe("Blocked");
    expect((await api.post(`/api/studios/${gammaId}/unblock`)).ok()).toBeTruthy();
    expect((await ownerLogin()).status).toBe(200);
    await api.dispose();
  });

  it("studio owners can't reach any Super Admin endpoint; signed-out requests are refused", async () => {
    const { api } = await apiAs("a");
    for (const [method, path] of [
      ["get", "/api/admin/overview"], ["get", "/api/admin/studios"], ["get", "/api/admin/payments"], ["get", "/api/admin/storage"],
      ["get", "/api/admin/activity"], ["get", `/api/admin/studios/${gammaId}`], ["get", "/api/studios"],
      ["post", `/api/studios/${gammaId}/deactivate`], ["post", `/api/studios/${gammaId}/features/EXPENSES/disable`],
      ["put", `/api/admin/studios/${gammaId}/access`], ["post", `/api/admin/studios/${gammaId}/trial/extend`],
    ] as const) {
      const res = await (api[method] as (u: string, o?: object) => Promise<{ status(): number }>)(path, method === "get" ? undefined : { data: { mode: "Full", days: 30 } });
      expect([401, 403], `${method.toUpperCase()} ${path} as a studio owner`).toContain(res.status());
    }
    await api.dispose();
    const anon = await request.newContext({ baseURL: QA.apiUrl });
    expect((await anon.get("/api/admin/overview")).status()).toBe(401);
    await anon.dispose();
    // And Gamma is still active after all those attempts.
    expect((await ownerLogin()).status).toBe(200);
  });

  it("payment status: a manual payment turns the trial into a paid plan and shows as Paid in the ledger", async ({ page }) => {
    const { api } = await apiAs("admin");
    const before = await (await api.get("/api/admin/overview")).json();
    const ref = `QA-PAY-${tag}`;

    // Bad entries are refused (no amount, unknown method, future date).
    expect((await api.post(`/api/admin/studios/${gammaId}/payments`, { data: { months: 1, amount: 0, paymentMethod: "Cash" } })).status()).toBe(400);
    expect((await api.post(`/api/admin/studios/${gammaId}/payments`, { data: { months: 1, amount: 999, paymentMethod: "Bitcoin" } })).status()).toBe(400);
    const future = new Date(Date.now() + 5 * 86400000).toISOString();
    expect((await api.post(`/api/admin/studios/${gammaId}/payments`, { data: { months: 1, amount: 999, paymentMethod: "Cash", paymentDate: future } })).status()).toBe(400);

    const ok = await api.post(`/api/admin/studios/${gammaId}/payments`, { data: { months: 1, amount: 1499, paymentMethod: "UPI", referenceNumber: ref } });
    expect(ok.status(), "manual payment recorded").toBe(204);

    const sub = await (await api.get(`/api/admin/studios/${gammaId}/subscription`)).json();
    expect(sub.isTrial, "no longer a trial").toBe(false);
    expect(sub.status).toBe("Active");
    expect(sub.daysRemaining).toBeGreaterThanOrEqual(27);
    expect(sub.daysRemaining).toBeLessThanOrEqual(32);
    expect(Number(sub.totalPaid)).toBeGreaterThanOrEqual(1499);

    const ledger = await (await api.get(`/api/admin/payments?search=${ref}`)).json();
    expect(ledger.items).toHaveLength(1);
    expect(ledger.items[0]).toMatchObject({ studioId: gammaId, kind: "Manual", status: "Paid", method: "UPI", transactionId: ref });
    expect(Number(ledger.items[0].amount)).toBe(1499);

    const after = await (await api.get("/api/admin/overview")).json();
    expect(Number(after.totalRevenue) - Number(before.totalRevenue), "revenue goes up by exactly the payment").toBe(1499);

    // The owner can work again (full access) and the console's Payments page lists it.
    const g = await asGamma();
    expect((await tryWrite(g)).ok()).toBeTruthy();
    await page.goto("/");
    await page.getByRole("button", { name: /Payments$/ }).click();
    await expect(page.getByText(ref).filter({ visible: true }).first()).toBeVisible();
    await g.dispose();
    await api.dispose();
  });

  it("dashboard figures match the QA database", async () => {
    const { api } = await apiAs("admin");
    const o = await (await api.get("/api/admin/overview")).json();
    const studios = Number(qaSql("SELECT COUNT(*) FROM Studios"));
    const blocked = Number(qaSql("SELECT COUNT(*) FROM Studios WHERE IsBlocked = 1"));
    const revenue = Number(qaSql("SELECT ISNULL(SUM(Amount), 0) FROM SubscriptionPayments"));
    expect(o.totalStudios, "total studios").toBe(studios);
    expect(o.blocked, "blocked studios").toBe(blocked);
    expect(Number(o.totalRevenue), "total revenue").toBe(revenue);
    const sumOfStatuses = Object.values(o.statusBreakdown as Record<string, number>).reduce((a, b) => a + b, 0);
    expect(sumOfStatuses, "every studio counted once in the status breakdown").toBe(studios);
    await api.dispose();
  });
});
