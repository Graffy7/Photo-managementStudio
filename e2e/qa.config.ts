// The QA environment the end-to-end tests run against. Everything here is separate from the
// studio's real data: its own database (StudioOS_QA, recreated empty before every run), its own
// API instance and port, its own uploads folder, and test-only accounts that exist nowhere else.
import path from "node:path";

export const QA = {
  sqlServer: process.env.QA_SQL_SERVER ?? "localhost\\SQLEXPRESS",
  database: "StudioOS_QA",
  apiPort: 5238,
  webPort: 8082,
  get apiUrl() { return `http://localhost:${this.apiPort}`; },
  get webUrl() { return `http://localhost:${this.webPort}`; },
  uploadsDir: path.resolve(__dirname, ".qa-uploads"),
  webDir: path.resolve(__dirname, ".qa-web"),
  authDir: path.resolve(__dirname, ".auth"),
  // Generated test photos (never real customer photos), and the QA studios' server photo folders.
  photosDir: path.resolve(__dirname, ".qa-photos"),
  photoRootBase: path.resolve(__dirname, ".qa-photo-root"),

  // A fake Meta Graph API the QA API sends WhatsApp messages to, and test-only WhatsApp settings.
  fakeMetaPort: 5299,
  get fakeMetaUrl() { return `http://localhost:${this.fakeMetaPort}`; },
  whatsApp: { phoneNumberId: "QA-PHONE-NUMBER-ID", accessToken: "qa-only-token", appSecret: "qa-only-app-secret", verifyToken: "qa-only-verify-token" },

  // Test-only accounts for the throwaway QA database (seeded on API start-up / created by the
  // global setup). Not used anywhere else.
  superAdmin: { email: "qa-admin@studioos.test", password: "QaAdmin!E2E-2026" },
  studios: {
    a: { name: "QA Studio Alpha", owner: "QA Owner Alpha", email: "qa-owner-a@studioos.test", password: "QaOwnerA!E2E-2026" },
    b: { name: "QA Studio Beta", owner: "QA Owner Beta", email: "qa-owner-b@studioos.test", password: "QaOwnerB!E2E-2026" },
  },
} as const;
