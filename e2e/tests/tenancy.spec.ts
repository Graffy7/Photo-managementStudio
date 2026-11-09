import { it, expect, authFile, uid, mobileNo, apiAs } from "./fixtures";
import { goTo } from "./helpers";
import { request } from "@playwright/test";
import { QA } from "../qa.config";

// Two studios share one server and one database. Studio Beta must never see or change Studio
// Alpha's records - not in the app, and not by calling the API directly with Alpha's ids.
const tag = uid();
const alpha = { customerName: `QA Alpha Private ${tag}`, ids: {} as Record<string, number> };

it.describe.serial("Multi-tenant isolation (QA Studio Alpha vs QA Studio Beta)", () => {
  it.beforeAll(async () => {
    const { api } = await apiAs("a");
    const today = new Date().toISOString().slice(0, 10);
    const customer = await (await api.post("/api/customers", { data: { fullName: alpha.customerName, mobileNumber: mobileNo() } })).json();
    alpha.ids.customer = customer.customerId;
    alpha.ids.lead = (await (await api.post("/api/leads", { data: { fullName: `QA Alpha Lead ${tag}`, mobileNumber: mobileNo() } })).json()).leadId;
    alpha.ids.event = (await (await api.post("/api/events", {
      data: { customerId: customer.customerId, eventDate: today, eventStatus: "Upcoming", budget: 50000, venue: "Alpha Hall" },
    })).json()).eventId;
    alpha.ids.quotation = (await (await api.post("/api/quotations", {
      data: { customerId: customer.customerId, quotationDate: today, discount: 0, taxAmount: 0, status: "Draft", items: [{ customName: "Alpha item", quantity: 1, unitPrice: 1000 }] },
    })).json()).quotationId;
    for (const [k, v] of Object.entries(alpha.ids)) expect(v, `Alpha's ${k} was created`).toBeGreaterThan(0);
    await api.dispose();
  });

  it("API: Beta cannot read any of Alpha's records by id", async () => {
    const { api } = await apiAs("b");
    for (const path of [
      `/api/customers/${alpha.ids.customer}`, `/api/customers/${alpha.ids.customer}/events`,
      `/api/leads/${alpha.ids.lead}`, `/api/events/${alpha.ids.event}`, `/api/events/${alpha.ids.event}/history`,
      `/api/quotations/${alpha.ids.quotation}`, `/api/quotations/${alpha.ids.quotation}/pdf`,
    ]) {
      const res = await api.get(path);
      expect([403, 404], `GET ${path} as Beta`).toContain(res.status());
    }
    await api.dispose();
  });

  it("API: Beta cannot change, delete or convert Alpha's records", async () => {
    const { api } = await apiAs("b");
    const tries = [
      api.put(`/api/customers/${alpha.ids.customer}`, { data: { fullName: "Hacked", mobileNumber: mobileNo() } }),
      api.post(`/api/customers/${alpha.ids.customer}/deactivate`),
      api.post(`/api/leads/${alpha.ids.lead}/convert`),
      api.delete(`/api/leads/${alpha.ids.lead}`),
      api.delete(`/api/events/${alpha.ids.event}`),
      api.post(`/api/quotations/${alpha.ids.quotation}/status`, { data: { status: "Accepted" } }),
      // Beta can't attach its own payment to Alpha's customer either.
      api.post("/api/payments", { data: { customerId: alpha.ids.customer, amount: 100, paymentDate: new Date().toISOString().slice(0, 10), paymentMethod: "Cash", paymentStatus: "Completed" } }),
    ];
    for (const res of await Promise.all(tries)) {
      expect([400, 403, 404], `${res.url()} as Beta`).toContain(res.status());
    }
    // And Alpha's data is untouched.
    const { api: a } = await apiAs("a");
    const customer = await (await a.get(`/api/customers/${alpha.ids.customer}`)).json();
    expect(customer.fullName).toBe(alpha.customerName);
    expect(customer.isActive).toBe(true);
    expect((await a.get(`/api/leads/${alpha.ids.lead}`)).ok()).toBeTruthy();
    expect((await a.get(`/api/events/${alpha.ids.event}`)).ok()).toBeTruthy();
    await api.dispose();
    await a.dispose();
  });

  it("API: Beta's lists never include Alpha's records", async () => {
    const { api } = await apiAs("b");
    for (const path of ["/api/customers", "/api/leads", "/api/events", "/api/quotations", "/api/payments"]) {
      const body = await (await api.get(`${path}?pageSize=100&search=${encodeURIComponent(tag)}`)).json();
      const text = JSON.stringify(body);
      expect(text, `${path} as Beta`).not.toContain(tag);
    }
    await api.dispose();
  });

  it("API: a studio owner cannot use Super Admin endpoints; no sign-in is refused", async () => {
    const { api } = await apiAs("b");
    expect([401, 403]).toContain((await api.get("/api/studios")).status());
    await api.dispose();
    const anon = await request.newContext({ baseURL: QA.apiUrl });
    expect((await anon.get("/api/customers")).status()).toBe(401);
    expect((await anon.get(`/api/customers/${alpha.ids.customer}`)).status()).toBe(401);
    await anon.dispose();
  });

  it.describe("in the browser", () => {
    it.use({ storageState: authFile("b") });
    it("Beta searching for Alpha's customer finds nothing", async ({ page }) => {
      await page.goto("/");
      await expect(page.getByText(QA.studios.b.name)).toBeVisible();
      await goTo(page, "Customers");
      await page.getByPlaceholder(/Search/i).first().fill(alpha.customerName);
      await expect(page.getByText(/No customers match/i)).toBeVisible();
      await expect(page.getByText(alpha.customerName, { exact: true })).toHaveCount(0);
    });
  });
});
