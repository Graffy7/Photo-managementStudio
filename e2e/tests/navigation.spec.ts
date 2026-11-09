import { it, expect, authFile } from "./fixtures";
import { goTo, sidebarLink, expectNoHorizontalOverflow } from "./helpers";

it.use({ storageState: authFile("a") });

// Every module, opened through the sidebar: its page appears and nothing errors on the way.
const MODULES: [Parameters<typeof goTo>[1], RegExp][] = [
  ["Dashboard", /Good (morning|afternoon|evening)/],
  ["Calendar", /^Calendar$/],
  ["Day board", /^Day board$/],
  ["Enquiries", /^Enquiries$/],
  ["Customers", /^Customers$/],
  ["Events", /^Events$/],
  ["Quotations", /^Quotations$/],
  ["Photo delivery", /^Photo delivery$/],
  ["Payments", /^Payments$/],
  ["Expenses", /^Expenses$/],
  ["Reports", /Business Overview/],
  ["Workers", /^Workers$/],
  ["Services", /^Services$/],
  ["Notifications", /^Notifications$/],
  ["Settings", /^Settings$/],
  ["Subscription", /Subscription|plan/i],
];

it.describe("Every module opens from the sidebar", () => {
  for (const [item, heading] of MODULES) {
    it(`${item}`, async ({ page }) => {
      await page.goto("/");
      await expect(page.getByText(/Good (morning|afternoon|evening)/)).toBeVisible({ timeout: 30_000 });
      await goTo(page, item);
      await expect(page.getByText(heading).first()).toBeVisible();
      // The sidebar shows which page you're on.
      await expect(sidebarLink(page, item)).toHaveAttribute("aria-current", "page");
      await expectNoHorizontalOverflow(page);
    });
  }
});
