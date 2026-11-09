import { it, expect, authFile, uid, mobileNo } from "./fixtures";
import { goTo, expectCreated } from "./helpers";

it.use({ storageState: authFile("a") });

async function openNewCustomer(page: import("@playwright/test").Page) {
  await page.goto("/");
  await goTo(page, "Customers");
  await page.getByText("New customer", { exact: true }).first().click();
  await expect(page.getByPlaceholder("Deepa Nair")).toBeVisible();
}

it.describe("Customers", () => {
  it("required fields: nothing is saved and each problem is named", async ({ page }) => {
    await openNewCustomer(page);
    await page.getByText("Create customer").click();
    await expect(page.getByText("Enter the customer's name.")).toBeVisible();
    await expect(page.getByText("Enter the customer's mobile number.")).toBeVisible();
  });

  it("mobile number length boundaries (6 rejected, 7 and 15 digits fine, 16 rejected)", async ({ page }) => {
    await openNewCustomer(page);
    const mobile = page.getByPlaceholder("90011 22334");
    const tooShort = page.getByText("Enter a valid mobile number (7-15 digits).");
    await page.getByPlaceholder("Deepa Nair").fill("Boundary Test");
    for (const [value, valid] of [["123456", false], ["1234567", true], ["123456789012345", true], ["1234567890123456", false]] as const) {
      await mobile.fill(value);
      await page.getByText("Create customer").click({ trial: true });
      await mobile.blur();
      if (valid) await expect(tooShort).toBeHidden();
      else await expect(tooShort).toBeVisible();
    }
  });

  it("an invalid email is rejected", async ({ page }) => {
    await openNewCustomer(page);
    await page.getByPlaceholder("Deepa Nair").fill("Email Test");
    await page.getByPlaceholder("90011 22334").fill(mobileNo());
    await page.getByPlaceholder("deepa@example.com").fill("bad@email");
    await page.getByText("Create customer").click();
    await expect(page.getByText("Enter a valid email address, or leave it empty.")).toBeVisible();
  });

  it("create, find by search, edit, then deactivate (asks Yes / No) and reactivate", async ({ page }) => {
    const name = `QA Customer ${uid()}`;
    const mobile = mobileNo();
    await openNewCustomer(page);
    await page.getByPlaceholder("Deepa Nair").fill(name);
    await page.getByPlaceholder("90011 22334").fill(mobile);
    await page.getByPlaceholder("deepa@example.com").fill("qa.customer@example.com");
    await page.getByPlaceholder("12 Lake View Road, Chennai").fill("1 QA Street");
    await page.getByText("Create customer").click();
    await expectCreated(page, "Customer added");

    // Search finds it by name and by mobile number.
    const search = page.getByPlaceholder(/Search/i).first();
    await search.fill(name);
    await expect(page.getByText(name, { exact: true })).toBeVisible();
    await search.fill(mobile);
    await expect(page.getByText(name, { exact: true })).toBeVisible();

    // Edit.
    await page.getByRole("button", { name: `Edit ${name}` }).click();
    await page.getByPlaceholder("Deepa Nair").fill(`${name} Edited`);
    await page.getByText("Save changes").click();
    await search.fill(`${name} Edited`);
    await expect(page.getByText(`${name} Edited`, { exact: true })).toBeVisible();

    // Deactivate: "No" changes nothing, "Yes" makes them inactive.
    await page.getByRole("button", { name: `Deactivate ${name} Edited` }).click();
    const ask = page.getByRole("alert").filter({ hasText: "Make this customer inactive?" });
    await expect(ask).toBeVisible();
    await ask.getByText("No", { exact: true }).click();
    await expect(ask).toBeHidden();
    await expect(page.getByText("Active", { exact: true }).first()).toBeVisible();
    await page.getByRole("button", { name: `Deactivate ${name} Edited` }).click();
    await page.getByRole("alert").getByText("Yes", { exact: true }).click();
    await expect(page.getByText("Inactive", { exact: true }).last()).toBeVisible();

    // Reactivate.
    await page.getByRole("button", { name: `Activate ${name} Edited` }).click();
    await page.getByRole("alert").filter({ hasText: "Make this customer active?" }).getByText("Yes", { exact: true }).click();
    await expect(page.getByRole("button", { name: `Deactivate ${name} Edited` })).toBeVisible();
  });

  it("the same mobile number twice is caught and explained", async ({ page, allowProblems }) => {
    allowProblems(/status of 409/);
    const mobile = mobileNo();
    for (const n of [1, 2]) {
      await openNewCustomer(page);
      await page.getByPlaceholder("Deepa Nair").fill(`QA Duplicate ${n} ${uid()}`);
      await page.getByPlaceholder("90011 22334").fill(mobile);
      await page.getByText("Create customer").click();
      if (n === 1) await expectCreated(page, "Customer added");
    }
    await expect(page.getByText(/already/i).first()).toBeVisible();
    await expect(page.getByRole("alert").filter({ hasText: "Customer added" })).toHaveCount(0);
  });

  it("unusual input: a long name with Tamil and special characters is kept exactly", async ({ page }) => {
    const name = `ஆனந்த் O'Brien-Šimić & Co. ${uid()}`;
    await openNewCustomer(page);
    await page.getByPlaceholder("Deepa Nair").fill(name);
    await page.getByPlaceholder("90011 22334").fill(`+91 ${mobileNo()}`);
    await page.getByText("Create customer").click();
    await expectCreated(page, "Customer added");
    await page.getByPlaceholder(/Search/i).first().fill(name.slice(-10));
    await expect(page.getByText(name, { exact: true })).toBeVisible();
  });
});
