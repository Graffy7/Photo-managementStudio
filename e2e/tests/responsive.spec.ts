import { it, expect, authFile } from "./fixtures";
import { sidebarLink, expectNoHorizontalOverflow } from "./helpers";
import type { Page } from "@playwright/test";

// Runs in the "tablet" and "mobile" projects (see playwright.config.ts). Below 1024px the app has
// a top bar, the page, and bottom tabs (Home, Events, Customers, Payments, More).
it.use({ storageState: authFile("a") });

const MORE_GROUP: Record<string, string> = {
  Calendar: "Work", "Day board": "Work", Enquiries: "Clients", Quotations: "Clients",
  "Photo delivery": "Photos", Expenses: "Money", Reports: "Money", Workers: "Studio", Services: "Studio", Settings: "Studio",
};

async function openApp(page: Page) {
  await page.goto("/");
  await expect(page.getByText(/Good (morning|afternoon|evening)/)).toBeVisible({ timeout: 30_000 });
}

// Pages that aren't a bottom tab are reached through More.
async function viaMore(page: Page, item: string) {
  await page.getByRole("tab", { name: "More" }).click();
  const link = sidebarLink(page, item);
  if (!(await link.isVisible())) await page.getByRole("button", { name: `${MORE_GROUP[item]} menu` }).click();
  await link.click();
}

it.describe("Tablet and phone layouts", () => {
  it("bottom tabs are there and the dashboard fits the screen", async ({ page }) => {
    await openApp(page);
    for (const t of ["Home", "Events", "Customers", "Payments", "More"]) {
      await expect(page.getByRole("tab", { name: t })).toBeVisible();
    }
    await expect(page.getByRole("link", { name: "Dashboard" })).toHaveCount(0); // no desktop sidebar
    await expectNoHorizontalOverflow(page);
  });

  for (const tab of ["Events", "Customers", "Payments"]) {
    it(`${tab} tab opens and fits`, async ({ page }) => {
      await openApp(page);
      await page.getByRole("tab", { name: tab }).click();
      await expect(page.getByText(new RegExp(`^${tab}$`)).filter({ visible: true }).first()).toBeVisible();
      await expectNoHorizontalOverflow(page);
    });
  }

  for (const item of Object.keys(MORE_GROUP)) {
    it(`More → ${item} opens and fits`, async ({ page }) => {
      await openApp(page);
      await viaMore(page, item);
      await expect(page.getByRole("tab", { name: "More" })).toBeVisible();
      await page.waitForLoadState("networkidle");
      await expectNoHorizontalOverflow(page);
    });
  }

  it("forms fit: new enquiry and new quotation", async ({ page }) => {
    await openApp(page);
    await viaMore(page, "Enquiries");
    await page.getByText("New enquiry", { exact: true }).filter({ visible: true }).first().click();
    await expect(page.getByPlaceholder("Ananya Rao")).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.getByText("Cancel", { exact: true }).filter({ visible: true }).first().click();

    await viaMore(page, "Quotations");
    await page.getByText("New quotation", { exact: true }).filter({ visible: true }).first().click();
    await expect(page.getByLabel("Search customer by name or mobile number")).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  it("Sign out in the More menu asks first; No keeps you signed in", async ({ page }) => {
    await openApp(page);
    await page.getByRole("tab", { name: "More" }).click();
    await page.getByRole("button", { name: "Sign out" }).click();
    const ask = page.getByRole("alert").filter({ hasText: "Sign out?" });
    await expect(ask).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await ask.getByText("No", { exact: true }).click();
    await expect(ask).toBeHidden();
  });
});
