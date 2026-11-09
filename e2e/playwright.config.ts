import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import { QA } from "./qa.config";

// Real browser tests against the QA environment only (see qa.config.ts). `npm test` first
// recreates the empty StudioOS_QA database; Playwright then starts the QA API (which builds the
// tables from the migrations and seeds the QA Super Admin) and serves the QA website build.
export default defineConfig({
  testDir: "./tests",
  outputDir: "./test-results",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1, // one shared QA database: tests run in order so they can't trip over each other's data
  retries: 0,
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    baseURL: QA.webUrl,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 15_000,
  },
  projects: [
    // Seeds the two QA studios and signs their owners in through the real sign-in page.
    { name: "setup", testMatch: /.*\.setup\.ts/ },
    {
      name: "desktop",
      dependencies: ["setup"],
      // Layout tests (bottom tabs) only make sense on the tablet and mobile projects.
      testIgnore: [/.*\.setup\.ts/, /responsive\.spec\.ts/],
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "tablet",
      dependencies: ["setup"],
      testMatch: /responsive\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 820, height: 1180 }, hasTouch: true },
    },
    {
      name: "mobile",
      dependencies: ["setup"],
      testMatch: /responsive\.spec\.ts/,
      use: { ...devices["Pixel 7"] },
    },
  ],
  webServer: [
    {
      // A second API instance, only ever pointed at StudioOS_QA.
      command: "dotnet run --no-build --no-launch-profile --project ../backend/StudioManagement.API",
      url: `${QA.apiUrl}/health`,
      timeout: 180_000,
      reuseExistingServer: false,
      stdout: "ignore",
      stderr: "pipe",
      env: {
        ASPNETCORE_ENVIRONMENT: "Development",
        ASPNETCORE_URLS: QA.apiUrl,
        ConnectionStrings__DefaultConnection: `Server=${QA.sqlServer};Database=${QA.database};Trusted_Connection=True;TrustServerCertificate=True`,
        Database__MigrateOnStartup: "true",
        Bootstrap__SuperAdminEmail: QA.superAdmin.email,
        Bootstrap__SuperAdminPassword: QA.superAdmin.password,
        Jwt__Key: "qa-only-signing-key-for-the-e2e-database-0123456789abcdef",
        Storage__Local__RootPath: QA.uploadsDir,
        // Each QA studio gets its own server photo folder under .qa-photo-root; the cleanup "as of a later
        // date" switch exists for test setups only and is never on in production.
        PhotoGallery__StudioRootBase: QA.photoRootBase,
        PhotoGallery__AllowCleanupClockOverride: "true",
        // WhatsApp goes to a fake Meta server on this machine (tests/whatsapp.spec.ts) - the QA API
        // can never reach the real WhatsApp. Test-only values, not real credentials.
        WhatsApp__Provider: "CloudApi",
        WhatsApp__ApiBaseUrl: QA.fakeMetaUrl,
        WhatsApp__PhoneNumberId: QA.whatsApp.phoneNumberId,
        WhatsApp__AccessToken: QA.whatsApp.accessToken,
        WhatsApp__AppSecret: QA.whatsApp.appSecret,
        WhatsApp__WebhookVerifyToken: QA.whatsApp.verifyToken,
        Cors__AllowedOrigins__0: QA.webUrl,
        Cors__AllowedOrigins__1: `http://127.0.0.1:${QA.webPort}`,
        // The suite signs in more often than a person would; only the QA API gets the higher limit.
        RateLimits__LoginPerIp: "500",
        RateLimits__AuthPerIp: "200",
        DOTNET_NOLOGO: "true",
      },
    },
    {
      // The production web build (npm run qa:build-web), served as a single-page app.
      command: `npx serve -s "${path.basename(QA.webDir)}" -l ${QA.webPort} --no-clipboard`,
      url: QA.webUrl,
      timeout: 60_000,
      reuseExistingServer: false,
    },
  ],
});
