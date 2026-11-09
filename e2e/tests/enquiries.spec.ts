import { it, expect, authFile, uid, mobileNo, apiAs } from "./fixtures";
import { goTo, expectCreated } from "./helpers";

it.use({ storageState: authFile("a") });

async function openEnquiries(page: import("@playwright/test").Page) {
  await page.goto("/");
  await goTo(page, "Enquiries");
  await expect(page.getByText(/enquir(y|ies)$/).first()).toBeVisible();
}

it.describe("Enquiries", () => {
  it("required name and mobile; nothing saved without them", async ({ page }) => {
    await openEnquiries(page);
    await page.getByText("New enquiry", { exact: true }).first().click();
    await page.getByText("Create enquiry").click();
    await expect(page.getByText(/enter .*name/i).first()).toBeVisible();
    await expect(page.getByText(/mobile/i).first()).toBeVisible();
  });

  it("create with the Event type dropdown; it shows as Not converted, then converts to a customer", async ({ page }) => {
    // A QA event type so the dropdown has something to choose.
    const { api } = await apiAs("a");
    const typeName = `QA Wedding ${uid()}`;
    expect((await api.post("/api/event-types", { data: { name: typeName } })).ok()).toBeTruthy();

    const name = `QA Lead ${uid()}`;
    await openEnquiries(page);
    await page.getByText("New enquiry", { exact: true }).first().click();
    await page.getByPlaceholder("Ananya Rao").fill(name);
    await page.getByPlaceholder("98765 43210").first().fill(mobileNo());

    // The dropdown opens, lists the type, and shows the choice afterwards.
    await page.getByRole("button", { name: "Event type" }).click();
    await page.getByRole("menuitem", { name: typeName }).click();
    await expect(page.getByRole("button", { name: "Event type" })).toContainText(typeName);
    await page.getByPlaceholder("75000").fill("120000");
    await page.getByText("Create enquiry").click();
    await expectCreated(page, "Enquiry created");

    const row = page.getByText(name, { exact: true });
    await expect(row).toBeVisible();
    await expect(page.getByText("Not converted").first()).toBeVisible();

    // Convert asks first, then the status becomes Converted.
    await page.getByRole("button", { name: `Convert ${name} to a customer` }).click();
    const ask = page.getByRole("alert").filter({ hasText: "Make this enquiry a customer?" });
    await expect(ask).toBeVisible();
    await ask.getByText("Convert", { exact: true }).click();
    await page.getByRole("button", { name: "Converted" }).first().click();
    await expect(page.getByText(name, { exact: true })).toBeVisible();
    await api.dispose();
  });

  it("an enquiry whose date has passed shows as Event over and is found by that filter", async ({ page }) => {
    const { api } = await apiAs("a");
    const name = `QA Past Lead ${uid()}`;
    const past = new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10);
    const res = await api.post("/api/leads", { data: { fullName: name, mobileNumber: mobileNo(), expectedEventDate: past } });
    expect(res.ok(), "enquiry created through the API").toBeTruthy();
    expect((await res.json()).outcome).toBe("EventOver");

    await openEnquiries(page);
    await page.getByRole("button", { name: "Event over" }).click();
    await expect(page.getByText(name, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Not converted" }).click();
    await expect(page.getByText(name, { exact: true })).toBeHidden();
    await api.dispose();
  });

  it("delete asks first: No keeps it, Delete removes it", async ({ page }) => {
    const { api } = await apiAs("a");
    const name = `QA Delete Lead ${uid()}`;
    expect((await api.post("/api/leads", { data: { fullName: name, mobileNumber: mobileNo() } })).ok()).toBeTruthy();

    await openEnquiries(page);
    await page.getByPlaceholder(/Search/i).first().fill(name);
    await page.getByRole("button", { name: `Delete enquiry from ${name}` }).click();
    const ask = page.getByRole("alert").filter({ hasText: "Delete enquiry?" });
    await expect(ask).toContainText(name);
    await ask.getByText("Cancel", { exact: true }).click();
    await expect(page.getByText(name, { exact: true })).toBeVisible();

    await page.getByRole("button", { name: `Delete enquiry from ${name}` }).click();
    await page.getByRole("alert").getByText("Delete", { exact: true }).click();
    await expect(page.getByText(name, { exact: true })).toBeHidden();
    await api.dispose();
  });
});
