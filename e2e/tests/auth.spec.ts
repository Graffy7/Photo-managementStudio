import { it, expect } from "./fixtures";
import { QA } from "../qa.config";

// Signing in and out, from a browser that isn't signed in yet.
it.describe("Sign-in page", () => {
  it.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Welcome")).toBeVisible();
  });

  it("empty form is rejected without calling the server", async ({ page }) => {
    let called = false;
    page.on("request", (r) => { if (r.url().includes("/api/auth/login")) called = true; });
    await page.getByText("Sign in now").click();
    await expect(page.getByText(/enter your email/i)).toBeVisible();
    expect(called).toBe(false);
  });

  it("a malformed email is rejected", async ({ page }) => {
    await page.getByLabel("Email address").fill("not-an-email");
    await page.getByLabel("Password").fill("whatever123");
    await page.getByText("Sign in now").click();
    await expect(page.getByText(/valid email/i)).toBeVisible();
  });

  it("a wrong password shows an error and stays on the sign-in page", async ({ page }) => {
    await page.getByLabel("Email address").fill(QA.studios.a.email);
    await page.getByLabel("Password").fill("Wrong-Password-1");
    await page.getByText("Sign in now").click();
    await expect(page.getByText(/invalid|incorrect|wrong/i)).toBeVisible();
    await expect(page.getByText("Welcome")).toBeVisible();
  });

  it("an unknown account gets the same message (no hint which emails exist)", async ({ page }) => {
    await page.getByLabel("Email address").fill(`nobody-${Date.now()}@studioos.test`);
    await page.getByLabel("Password").fill("Some-Password-1");
    await page.getByText("Sign in now").click();
    await expect(page.getByText(/invalid|incorrect|wrong/i)).toBeVisible();
  });

  it("email with spaces and capitals still signs in; Sign out asks first", async ({ page }) => {
    await page.getByLabel("Email address").fill(`  ${QA.studios.a.email.toUpperCase()}  `);
    await page.getByLabel("Password").fill(QA.studios.a.password);
    await page.getByText("Sign in now").click();
    await expect(page.getByText(/Good (morning|afternoon|evening)/)).toBeVisible({ timeout: 30_000 });

    // No keeps you signed in.
    await page.getByText("Sign out", { exact: true }).click();
    const ask = page.getByRole("alert").filter({ hasText: "Sign out?" });
    await expect(ask).toBeVisible();
    await ask.getByText("No", { exact: true }).click();
    await expect(ask).toBeHidden();
    await expect(page.getByText(/Good (morning|afternoon|evening)/)).toBeVisible();

    // Yes signs out, and the app goes back to the sign-in page.
    await page.getByText("Sign out", { exact: true }).click();
    await page.getByRole("alert").getByText("Yes, sign out").click();
    await expect(page.getByText("Sign in now")).toBeVisible();
  });
});
