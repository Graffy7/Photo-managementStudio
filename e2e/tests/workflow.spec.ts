import { it, expect, authFile, uid, mobileNo, apiAs } from "./fixtures";
import { goTo, expectCreated } from "./helpers";
import type { Page } from "@playwright/test";

it.use({ storageState: authFile("a") });

// Picks today in a date picker if it's still empty (some forms already start on today).
async function todayIfEmpty(page: Page, placeholder: string) {
  const trigger = page.getByText(placeholder, { exact: true }).filter({ visible: true }).first();
  if (await trigger.isVisible()) {
    await trigger.click();
    await page.getByText("Today", { exact: true }).last().click();
  }
}

// Chooses a customer in the customer search box.
async function chooseCustomer(page: Page, name: string) {
  await page.getByLabel("Search customer by name or mobile number").fill(name.slice(0, 14));
  await page.getByText(name, { exact: true }).filter({ visible: true }).first().click();
}

const customerName = `QA Flow Customer ${uid()}`;

it.describe.serial("Studio workflow: services → event → quotation → payment → expense", () => {
  it.beforeAll(async () => {
    const { api } = await apiAs("a");
    expect((await api.post("/api/customers", { data: { fullName: customerName, mobileNumber: mobileNo() } })).ok()).toBeTruthy();
    expect((await api.post("/api/expense-categories", { data: { categoryName: `QA Travel ${uid()}` } })).ok()).toBeTruthy();
    await api.dispose();
  });

  it("Services: required fields, then create", async ({ page }) => {
    await page.goto("/");
    await goTo(page, "Services");
    await page.getByText("New service", { exact: true }).filter({ visible: true }).first().click();
    await page.getByText("Create service").click();
    await expect(page.getByText("Enter the service name.")).toBeVisible();
    await expect(page.getByText("Enter the usual price.")).toBeVisible();
    const name = `QA Candid ${uid()}`;
    await page.getByPlaceholder("Wedding Photography").fill(name);
    await page.getByPlaceholder("75000").fill("45000");
    await page.getByText("Create service").click();
    await expectCreated(page, "Service added");
    await expect(page.getByText(name, { exact: true })).toBeVisible();
  });

  it("Workers: create one", async ({ page }) => {
    await page.goto("/");
    await goTo(page, "Workers");
    await page.getByText("New worker", { exact: true }).filter({ visible: true }).first().click();
    const name = `QA Photographer ${uid()}`;
    await page.getByPlaceholder("Vikram Singh").fill(name);
    await page.getByPlaceholder("98765 43210").fill(mobileNo());
    await page.getByText("Create worker").click();
    await expectCreated(page, "Worker added");
    await expect(page.getByText(name, { exact: true })).toBeVisible();
  });

  it("Events: needs a customer and date; create one and open its page", async ({ page }) => {
    await page.goto("/");
    await goTo(page, "Events");
    await page.getByText("New event", { exact: true }).filter({ visible: true }).first().click();
    await page.getByText("Create event").click();
    await expect(page.getByText("Choose the customer for this event.")).toBeVisible();
    await expect(page.getByText("Choose the event date.")).toBeVisible();

    await chooseCustomer(page, customerName);
    await todayIfEmpty(page, "Select event date");
    await page.getByPlaceholder("Grand Palace Hall").fill("QA Hall");
    await page.getByPlaceholder("85000").fill("85000");
    await page.getByText("Create event").click();
    await expectCreated(page, "Event created");

    // Its page: header pills, the money figures and the payment progress bar.
    await page.getByPlaceholder(/Search/i).first().fill(customerName);
    await page.getByText(customerName, { exact: true }).filter({ visible: true }).first().click();
    await expect(page.getByText("QA Hall").filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText("₹85,000").filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText(/of ₹85,000 paid/)).toBeVisible();
  });

  it("Quotations: needs an item; create one and preview its PDF in the pop-up", async ({ page }) => {
    await page.goto("/");
    await goTo(page, "Quotations");
    await page.getByText("New quotation", { exact: true }).filter({ visible: true }).first().click();
    await chooseCustomer(page, customerName);
    await page.getByText("Create quotation").click();
    await expect(page.getByText("Add at least one item.")).toBeVisible();

    await page.getByText("Add item", { exact: true }).click();
    await page.getByText("+ Your own item").click();
    await page.getByPlaceholder("Item name, e.g. Travel and stay").fill("QA Album printing");
    await page.getByLabel("Quantity").fill("2");
    await page.getByLabel("Price").fill("12500");
    await expect(page.getByText("₹25,000").filter({ visible: true }).first()).toBeVisible(); // line total = 2 × 12,500
    await page.getByText("Create quotation").click();
    await expectCreated(page, "Quotation created");

    // The PDF opens in the preview pop-up, not as a download.
    const viewPdf = page.getByRole("button", { name: /View PDF of Q-/ }).first();
    await viewPdf.click();
    await page.getByText("Show detailed prices").click();
    const preview = page.locator("iframe");
    await expect(preview).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Download", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Close preview" }).click();
    await expect(preview).toBeHidden();
  });

  it("Payments: amount must be above zero; record one", async ({ page }) => {
    await page.goto("/");
    await goTo(page, "Payments");
    await page.getByText("Record payment", { exact: true }).filter({ visible: true }).first().click();
    await chooseCustomer(page, customerName);
    await page.getByPlaceholder("10000").fill("0");
    await page.getByText("Record payment", { exact: true }).last().click();
    await expect(page.getByText(/more than zero|above zero|Enter the amount/i).filter({ visible: true }).first()).toBeVisible();

    await page.getByPlaceholder("10000").fill("20000");
    await todayIfEmpty(page, "Select payment date");
    await page.getByText("UPI", { exact: true }).click();
    await page.getByText("Record payment", { exact: true }).last().click();
    await expectCreated(page, "Payment recorded");
    await expect(page.getByText("₹20,000").filter({ visible: true }).first()).toBeVisible();
  });

  it("Expenses: needs a category; record one", async ({ page }) => {
    await page.goto("/");
    await goTo(page, "Expenses");
    await page.getByText("New expense", { exact: true }).filter({ visible: true }).first().click();
    await page.getByText("Record expense").click();
    await expect(page.getByText("Choose a category.")).toBeVisible();

    await page.getByText(/^QA Travel/).filter({ visible: true }).first().click();
    await page.getByPlaceholder("2500").fill("1800");
    await todayIfEmpty(page, "Select date");
    await page.getByText("Record expense").click();
    await expectCreated(page, "Expense added");
    await expect(page.getByText("₹1,800").filter({ visible: true }).first()).toBeVisible();
  });
});
