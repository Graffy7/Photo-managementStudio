import { expect, type Page } from "@playwright/test";

// Where each sidebar item lives (sections start closed unless they hold the current page).
const GROUP: Record<string, string> = {
  Dashboard: "Work", Calendar: "Work", "Day board": "Work",
  Enquiries: "Clients", Customers: "Clients", Events: "Clients", Quotations: "Clients",
  "Photo delivery": "Photos",
  Payments: "Money", Expenses: "Money", Reports: "Money",
  Workers: "Studio", Services: "Studio", Notifications: "Studio", Settings: "Studio", Subscription: "Studio",
};

// A sidebar item by its accessible name: the label, plus ", N unread" on Notifications.
export const sidebarLink = (page: Page, item: string) =>
  page.getByRole("link", { name: new RegExp("^" + item + "(, \\d+\\+? unread)?$") });

// Opens a module through the real sidebar, the way a person would (desktop layout).
export async function goTo(page: Page, item: keyof typeof GROUP) {
  const sidebarItem = sidebarLink(page, item);
  if (!(await sidebarItem.isVisible())) {
    await page.getByRole("button", { name: `${GROUP[item]} menu` }).click();
  }
  await sidebarItem.click();
}

// After creating something the app shows a "… created" pop-up that closes by itself; click it
// away so the next step isn't waiting behind it.
export async function expectCreated(page: Page, title: string | RegExp) {
  const popup = page.getByRole("alert").filter({ hasText: title });
  await expect(popup).toBeVisible();
  await popup.click();
  await expect(popup).toBeHidden();
}

// Opens a date picker (by the text it shows) and picks today.
export async function pickToday(page: Page, trigger: string) {
  await page.getByText(trigger, { exact: true }).first().click();
  await page.getByText("Today", { exact: true }).last().click();
}

// The page scrolls sideways only when something is wider than the screen - a layout bug.
export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, "nothing sticks out past the right edge of the screen").toBeLessThanOrEqual(1);
}
