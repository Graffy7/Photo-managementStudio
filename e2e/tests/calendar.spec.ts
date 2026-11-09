import { it, expect, authFile, uid, mobileNo, apiAs } from "./fixtures";
import { goTo } from "./helpers";

it.use({ storageState: authFile("a") });

const tag = uid();
const customerName = `QA Calendar Customer ${tag}`;
const workerName = `QA Crew ${tag}`;

it.describe.serial("Calendar and Day board", () => {
  it.beforeAll(async () => {
    const { api } = await apiAs("a");
    const today = new Date();
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const type = await (await api.post("/api/event-types", { data: { name: `Wedding ${tag}` } })).json();
    const customer = await (await api.post("/api/customers", { data: { fullName: customerName, mobileNumber: mobileNo() } })).json();
    const ev = await api.post("/api/events", {
      data: { customerId: customer.customerId, eventTypeId: type.id, eventDate: iso, startTime: "10:00", endTime: "18:00", eventStatus: "Upcoming", budget: 60000, venue: "QA Calendar Hall" },
    });
    expect(ev.ok(), "today's QA wedding created").toBeTruthy();
    expect((await api.post("/api/workers", { data: { fullName: workerName, mobileNumber: mobileNo() } })).ok()).toBeTruthy();
    await api.dispose();
  });

  it("Weddings tile opens this month's weddings, and Back returns to the Calendar", async ({ page }) => {
    await page.goto("/");
    await goTo(page, "Calendar");
    await page.getByRole("button", { name: /^Weddings: \d+\. Show these events$/ }).click();
    await expect(page.getByText(/Showing: Weddings · /).filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText(customerName, { exact: true }).filter({ visible: true }).first()).toBeVisible();
    await page.getByRole("link", { name: /Calendar/ }).filter({ visible: true }).first().click();
    await expect(page.getByText(/Click a date to see its events/).filter({ visible: true }).first()).toBeVisible();
  });

  it("Total events tile shows all of this month; Show all events clears the filter", async ({ page }) => {
    await page.goto("/");
    await goTo(page, "Calendar");
    await page.getByRole("button", { name: /^Total events: \d+\. Show these events$/ }).click();
    await expect(page.getByText(/Showing: All events · /).filter({ visible: true }).first()).toBeVisible();
    await page.getByText("Show all events").filter({ visible: true }).first().click();
    await expect(page.getByText(/Showing: /).filter({ visible: true })).toHaveCount(0);
  });

  it("Day board: today's event shows; assign a crew member, then remove them", async ({ page }) => {
    await page.goto("/");
    await goTo(page, "Day board");
    // The event's card, found by its customer and its Crew section (both stay while the picker is open).
    const card = page.locator("div").filter({ hasText: customerName }).filter({ hasText: "Crew" }).last();
    await expect(card).toBeVisible();
    await card.getByText("Assign worker").click();
    await card.getByText(workerName, { exact: true }).click();
    const remove = page.getByRole("button", { name: `Remove ${workerName} from this event` });
    await expect(remove).toBeVisible();
    await remove.click();
    await expect(remove).toHaveCount(0);
  });
});
