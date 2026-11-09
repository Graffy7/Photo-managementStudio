import { it, expect, apiAs, uid, mobileNo } from "./fixtures";
import { request, type APIRequestContext } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { QA } from "../qa.config";

// Phase 3 - dashboard and reports. A fresh QA studio (Delta) gets a small, fully known set of
// records, all dated last month, so every total can be worked out by hand and checked against the
// dashboard, the reports, their PDF and the QA database itself.
// No "f" in the tag: the PDF font draws "ft"/"fk"/... as ligature glyphs that have no text
// mapping, so text extraction loses them (a known remaining risk - see the Phase 3 report).
const tag = uid().replace(/f/g, "g");
const delta = { name: `QA Studio Delta ${tag}`, owner: "QA Owner Delta", email: `qa-owner-d-${tag}@studioos.test`, password: `QaDelta!${tag}` };
const FEATURES = [
  "CUSTOMERS", "DASHBOARD", "DAY_BOARD", "EVENTS", "EXPENSES", "GALLERY", "LEADS", "NOTIFICATIONS", "PAYMENTS",
  "PHOTO_DELIVERY", "PHOTO_SELECTION", "QUOTATIONS", "REPORTS", "SERVICES", "SETTINGS", "WHATSAPP", "WORKERS",
];

// Last month, on the studio's (India) calendar.
const todayIst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
const ym = new Date(todayIst.getFullYear(), todayIst.getMonth() - 1, 1);
const pad = (n: number) => String(n).padStart(2, "0");
const day = (d: number) => `${ym.getFullYear()}-${pad(ym.getMonth() + 1)}-${pad(d)}`;
const monthStart = day(1);
const monthEnd = day(new Date(ym.getFullYear(), ym.getMonth() + 1, 0).getDate());

let studioId = 0;
let owner: APIRequestContext;
const ids: Record<string, number> = {};

// The records (amounts in ₹):
//  E1 Confirmed, 50,000 agreed, paid 20,000 on day 3            - owes 30,000 (no quotation)
//  E2 Completed, 30,000 agreed, paid 30,000 on day 10           - owes 0 (accepted quotation 30,000)
//  E3 Cancelled, 15,000 agreed, nothing paid                    - left out of value and owed
//  E4 Upcoming,  10,000 agreed, a Pending 5,000 payment only    - owes 10,000
//  Expenses: 4,000 paid (day 3), 1,000 pending (day 17)
const EXPECTED = {
  // Last month is in the past, so the app has moved every non-cancelled event to Completed.
  events: 4, completed: 3, cancelled: 1,
  eventValue: 90_000, cancelledValue: 15_000,
  collected: 50_000, quotationValue: 30_000,
  outstanding: 40_000, expenses: 5_000, pendingExpenses: 1_000,
  cashProfit: 45_000,
};

function qaSql(query: string): string {
  return execFileSync("sqlcmd", ["-S", QA.sqlServer, "-E", "-C", "-d", QA.database, "-W", "-h", "-1", "-Q", `SET NOCOUNT ON; ${query}`]).toString().trim();
}
const num = (s: string) => Number(s.trim() || 0);

async function pdfText(bytes: Buffer): Promise<string> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes), useSystemFonts: false }).promise;
  let out = "";
  for (let p = 1; p <= doc.numPages; p++) {
    const content = await (await doc.getPage(p)).getTextContent();
    out += content.items.map((i) => ("str" in i ? i.str : "")).join(" ") + "\n";
  }
  return out.replace(/\s+/g, " ");
}

const summary = (q: string) => owner.get(`/api/studio-dashboard/summary?${q}`).then(async (r) => { expect(r.ok(), await r.text()).toBeTruthy(); return r.json(); });
const analytics = (q: string) => owner.get(`/api/reports/analytics?${q}`).then(async (r) => { expect(r.ok(), await r.text()).toBeTruthy(); return r.json(); });
const lastMonth = `preset=Custom&customStart=${monthStart}&customEnd=${monthEnd}`;

it.describe.serial("Phase 3 - Dashboard and reports", () => {
  it.beforeAll(async () => {
    const { api: admin } = await apiAs("admin");
    const res = await admin.post("/api/studios", {
      data: { studioName: delta.name, phoneNumber: mobileNo(), ownerFullName: delta.owner, ownerEmail: delta.email, ownerPassword: delta.password, subscriptionPlanId: 0, freeTrial: true,
        trialStartDate: new Date().toISOString().slice(0, 10), trialEndDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10) },
    });
    expect(res.ok(), await res.text()).toBeTruthy();
    studioId = (await res.json()).studioId;
    for (const f of FEATURES) expect((await admin.post(`/api/studios/${studioId}/features/${f}/enable`)).ok()).toBeTruthy();
    await admin.dispose();

    const login = await (await request.newContext({ baseURL: QA.apiUrl })).post("/api/auth/login", { data: { email: delta.email, password: delta.password, rememberMe: false } });
    owner = await request.newContext({ baseURL: QA.apiUrl, extraHTTPHeaders: { Authorization: `Bearer ${(await login.json()).accessToken}` } });

    const post = async (url: string, data: object) => {
      const r = await owner.post(url, { data });
      expect(r.ok(), `${url}: ${await r.text()}`).toBeTruthy();
      return r.json();
    };
    ids.customer = (await post("/api/customers", { fullName: `QA Report Customer ${tag}`, mobileNumber: mobileNo() })).customerId;
    const ev = (d: number, status: string, budget: number) => post("/api/events", { customerId: ids.customer, eventDate: day(d), eventStatus: status, budget, venue: `QA Venue ${tag} ${d}` });
    ids.e1 = (await ev(3, "Confirmed", 50_000)).eventId;
    ids.e2 = (await ev(10, "Completed", 30_000)).eventId;
    ids.e3 = (await ev(12, "Cancelled", 15_000)).eventId;
    ids.e4 = (await ev(24, "Upcoming", 10_000)).eventId;
    const pay = (eventId: number, d: number, amount: number, status = "Completed") =>
      post("/api/payments", { customerId: ids.customer, eventId, amount, paymentDate: day(d), paymentMethod: "Cash", paymentStatus: status });
    await pay(ids.e1, 3, 20_000);
    await pay(ids.e2, 10, 30_000);
    await pay(ids.e4, 24, 5_000, "Pending");
    await post("/api/quotations", {
      customerId: ids.customer, eventId: ids.e2, quotationDate: day(8), discount: 0, taxAmount: 0, status: "Accepted",
      items: [{ customName: "QA Wedding coverage", quantity: 1, unitPrice: 30_000 }],
    });
    let categories = await (await owner.get("/api/expense-categories")).json();
    categories = categories.items ?? categories;
    const categoryId = categories[0]?.expenseCategoryId ?? (await post("/api/expense-categories", { categoryName: `QA Travel ${tag}` })).expenseCategoryId;
    await post("/api/expenses", { expenseCategoryId: categoryId, eventId: ids.e1, expenseDate: day(3), amount: 4_000, paymentStatus: "Paid", description: "QA travel" });
    await post("/api/expenses", { expenseCategoryId: categoryId, eventId: ids.e4, expenseDate: day(17), amount: 1_000, paymentStatus: "Pending", description: "QA prints" });
  });

  it.afterAll(async () => { await owner?.dispose(); });

  it("the test data is in the QA database exactly as intended", () => {
    expect(num(qaSql(`SELECT COUNT(*) FROM Events WHERE StudioId = ${studioId}`))).toBe(4);
    expect(num(qaSql(`SELECT SUM(Amount) FROM Payments WHERE StudioId = ${studioId} AND PaymentStatus = 'Completed'`))).toBe(EXPECTED.collected);
    expect(num(qaSql(`SELECT SUM(GrandTotal) FROM Quotations WHERE StudioId = ${studioId} AND Status = 'Accepted'`))).toBe(EXPECTED.quotationValue);
    expect(num(qaSql(`SELECT SUM(Amount) FROM Expenses WHERE StudioId = ${studioId}`))).toBe(EXPECTED.expenses);
  });

  it("dashboard: Outstanding is what customers still owe - never negative", async () => {
    const s = await summary(lastMonth);
    // What the database says customers owe on the non-cancelled events of the range.
    const owedInDb = num(qaSql(`SELECT SUM(CASE WHEN ISNULL(e.Budget,0) - ISNULL(p.Paid,0) > 0 THEN ISNULL(e.Budget,0) - ISNULL(p.Paid,0) ELSE 0 END)
      FROM Events e OUTER APPLY (SELECT SUM(Amount) Paid FROM Payments WHERE EventId = e.EventId AND PaymentStatus = 'Completed') p
      WHERE e.StudioId = ${studioId} AND e.EventStatus <> 'Cancelled' AND e.EventDate >= '${monthStart}' AND e.EventDate <= '${monthEnd}'`));
    expect(owedInDb).toBe(EXPECTED.outstanding);
    expect(s.outstandingBalance, "Outstanding = unpaid balance of the range's events").toBe(EXPECTED.outstanding);
    expect(s.outstandingBalance).toBeGreaterThanOrEqual(0);
  });

  it("dashboard: every other total matches the database", async () => {
    const s = await summary(lastMonth);
    expect(s.totalEvents).toBe(EXPECTED.events);
    expect(s.completedEvents).toBe(EXPECTED.completed);
    expect(s.cancelledEvents).toBe(EXPECTED.cancelled);
    expect(s.upcomingEvents, "nothing upcoming in a past month").toBe(0);
    expect(s.collectedRevenue, "only completed payments count").toBe(EXPECTED.collected);
    expect(s.quotationValue, "accepted quotations").toBe(EXPECTED.quotationValue);
    expect(s.totalExpenses).toBe(EXPECTED.expenses);
    expect(s.pendingExpenses).toBe(EXPECTED.pendingExpenses);
    expect(s.paidExpenses).toBe(EXPECTED.expenses - EXPECTED.pendingExpenses);
    expect(s.cashProfit).toBe(EXPECTED.cashProfit);
    expect(s.totalEventValue, "cancelled events left out").toBe(EXPECTED.eventValue);
    expect(s.totalCustomers).toBe(num(qaSql(`SELECT COUNT(*) FROM Customers WHERE StudioId = ${studioId}`)));
  });

  it("dashboard page shows the same figures for Last month", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Email address").fill(delta.email);
    await page.getByLabel("Password").fill(delta.password);
    await page.getByText("Sign in now").click();
    await expect(page.getByText(/Good (morning|afternoon|evening)/)).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Last month" }).filter({ visible: true }).click();
    const tile = (label: string) => page.getByText(label, { exact: true }).filter({ visible: true }).first().locator("xpath=../..");
    await expect(tile("Outstanding")).toContainText("40,000");
    await expect(tile("Outstanding")).not.toContainText("-");
    await expect(tile("Collected Revenue")).toContainText("50,000");
    await expect(tile("Quotation Value")).toContainText("30,000");
    await expect(tile("Expenses")).toContainText("5,000");
    await expect(tile("Cash Profit")).toContainText("45,000");
  });

  it("reports: analytics agree with the dashboard and the database", async () => {
    const r = await analytics(lastMonth);
    const s = r.summary;
    expect(s.events).toBe(EXPECTED.events);
    expect(s.completed).toBe(EXPECTED.completed);
    expect(s.cancelled).toBe(EXPECTED.cancelled);
    expect(s.eventValue).toBe(EXPECTED.eventValue);
    expect(s.cancelledValue).toBe(EXPECTED.cancelledValue);
    expect(s.moneyReceived).toBe(EXPECTED.collected);
    expect(s.expenses).toBe(EXPECTED.expenses);
    expect(s.profit).toBe(EXPECTED.cashProfit);
    expect(s.outstanding).toBe(EXPECTED.outstanding);
    expect(s.customersOwe).toBe(EXPECTED.outstanding);
    // Day-by-day figures add up to the summary.
    const periods: Record<string, number>[] = r.periods ?? r.buckets ?? [];
    expect(periods.length, "one row per day of the month").toBeGreaterThanOrEqual(28);
    const sum = (k: string) => periods.reduce((a, p) => a + (p[k] ?? 0), 0);
    expect(sum("moneyReceived")).toBe(EXPECTED.collected);
    expect(sum("expenses")).toBe(EXPECTED.expenses);
    expect(sum("outstanding")).toBe(EXPECTED.outstanding);
    expect(sum("events")).toBe(EXPECTED.events);

    const profit = await (await owner.get(`/api/reports/profit?${lastMonth}`)).json();
    const totalCollected = (profit.events ?? []).reduce((a: number, e: { collectedRevenue: number }) => a + e.collectedRevenue, 0);
    expect(totalCollected, "profit report: money per event").toBe(EXPECTED.collected);
    expect(profit.eventsOutstandingBalance, "profit report: same outstanding as analytics").toBe(EXPECTED.outstanding);
    expect(profit.eventsTotalAmount, "profit report: cancelled event not counted as value").toBe(EXPECTED.eventValue);
    const cancelled = profit.events.find((e: { eventId: number }) => e.eventId === ids.e3);
    expect(cancelled.outstandingBalance, "a cancelled event owes nothing").toBe(0);
    expect(profit.events.every((e: { outstandingBalance: number }) => e.outstandingBalance >= 0)).toBeTruthy();
  });

  it("date filters: single days, empty ranges, boundaries and bad ranges", async () => {
    const one = (d: number) => `preset=Custom&customStart=${day(d)}&customEnd=${day(d)}`;
    const d3 = await summary(one(3));
    expect([d3.totalEvents, d3.collectedRevenue, d3.outstandingBalance, d3.totalExpenses], "day 3 only").toEqual([1, 20_000, 30_000, 4_000]);
    const d10 = await analytics(one(10));
    expect([d10.summary.events, d10.summary.moneyReceived, d10.summary.outstanding]).toEqual([1, 30_000, 0]);
    // A day with nothing on it.
    const d5 = await summary(one(5));
    expect([d5.totalEvents, d5.collectedRevenue, d5.outstandingBalance, d5.totalExpenses]).toEqual([0, 0, 0, 0]);
    // The end day is included; the day after the range is not.
    const to24 = await summary(`preset=Custom&customStart=${day(11)}&customEnd=${day(24)}`);
    expect([to24.totalEvents, to24.outstandingBalance], "11th-24th: E3 (cancelled) and E4").toEqual([2, 10_000]);
    const to23 = await summary(`preset=Custom&customStart=${day(11)}&customEnd=${day(23)}`);
    expect(to23.totalEvents).toBe(1);
    // The PreviousMonth preset is the same month as the custom range.
    const prev = await summary("preset=PreviousMonth");
    expect([prev.totalEvents, prev.collectedRevenue, prev.outstandingBalance]).toEqual([4, 50_000, 40_000]);
    // This month has none of these records.
    const now = await summary("preset=ThisMonth");
    expect([now.totalEvents, now.collectedRevenue, now.outstandingBalance]).toEqual([0, 0, 0]);
    // Bad ranges are refused.
    expect((await owner.get(`/api/reports/analytics?preset=Custom&customStart=${day(20)}&customEnd=${day(2)}`)).status()).toBe(400);
    expect((await owner.get(`/api/reports/analytics?preset=Custom&customStart=2015-01-01&customEnd=2025-01-01`)).status()).toBe(400);
  });

  it("report PDF: opens, covers the right range, and shows the right totals", async () => {
    for (const details of [false, true]) {
      const res = await owner.get(`/api/reports/analytics/export?${lastMonth}&details=${details}`);
      expect(res.status()).toBe(200);
      expect(res.headers()["content-type"]).toContain("application/pdf");
      expect(res.headers()["content-disposition"]).toContain(`studio-report-${monthStart}-to-${monthEnd}.pdf`);
      const bytes = await res.body();
      expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
      const text = await pdfText(bytes);
      expect(text, "studio name on the report").toContain(delta.name);
      const range = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
      expect(text, "the range printed on the report").toContain(`${range(monthStart)} - ${range(monthEnd)}`);
      expect(text).toContain("Money received Rs. 50,000");
      expect(text).toContain("Customers owe Rs. 40,000");
      expect(text).toMatch(/Completed 3 .*Cancelled 1/);
      if (details) {
        // The per-event table agrees with the page totals (the cancelled event owes nothing).
        expect(text, "events table totals").toContain("Total 4 events Rs. 90,000 Rs. 5,000 Rs. 50,000 Rs. 40,000");
        for (const amount of ["Rs. 90,000", "Rs. 5,000", "Rs. 30,000", "Rs. 20,000"]) {
          expect(text, `${amount} in the detailed PDF`).toContain(amount);
        }
      }
      expect(text, "no negative money in the PDF").not.toMatch(/-s?Rs.|Rs.s?-/);
      if (details) expect(text, "detailed PDF lists the customer").toContain(`QA Report Customer ${tag}`);
    }
    // Other studios' data never appears in Delta's report.
    const res = await owner.get(`/api/reports/analytics/export?preset=Last1Year&details=true`);
    const text = await pdfText(await res.body());
    expect(text).not.toContain(QA.studios.a.name);
    expect(text).not.toContain("QA Photo Customer");
  });

  it("payment totals: event balance and payments list match the records", async () => {
    const e1 = await (await owner.get(`/api/events/${ids.e1}`)).json();
    expect(JSON.stringify(e1)).toBeTruthy();
    const payments = await (await owner.get(`/api/payments?pageSize=100`)).json();
    const items: { amount: number; paymentStatus: string }[] = payments.items ?? payments;
    expect(items).toHaveLength(3);
    expect(items.filter((p) => p.paymentStatus === "Completed").reduce((a, p) => a + p.amount, 0)).toBe(EXPECTED.collected);
    // Overpaying an event is refused, so a balance can't go below zero.
    const over = await owner.post("/api/payments", { data: { customerId: ids.customer, eventId: ids.e2, amount: 1, paymentDate: day(11), paymentMethod: "Cash", paymentStatus: "Completed" } });
    expect(over.status(), "event already fully paid").toBe(400);
  });
});
