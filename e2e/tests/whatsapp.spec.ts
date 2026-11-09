import { it, expect, apiAs } from "./fixtures";
import { request } from "@playwright/test";
import http from "node:http";
import crypto from "node:crypto";
import { QA } from "../qa.config";

// WhatsApp Cloud API integration, end to end against a FAKE Meta server on this machine (the QA API is
// configured to send there - nothing reaches the real WhatsApp). The fake answers like Meta does,
// including Meta's real error codes, and the webhook calls are signed exactly as Meta signs them.
type Sent = { path: string; auth: string; body: Record<string, unknown> };
const sent: Sent[] = [];
let fake: http.Server;

const meta = (res: http.ServerResponse, status: number, body: object) => {
  res.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(body));
};
const metaError = (res: http.ServerResponse, status: number, code: number, message: string, details?: string) =>
  meta(res, status, { error: { message, type: "OAuthException", code, error_data: details ? { messaging_product: "whatsapp", details } : undefined, fbtrace_id: "QA" } });

// Recipients that make the fake Meta answer the way the real one does in each situation.
const TO = {
  ok: "919800000001",
  badToken: "919800000190",      // 190: access token invalid / expired
  notAllowed: "919800131030",    // 131030: number not in the test recipient list
  noTemplate: "919800132001",    // 132001: template does not exist
  outage: "919800000500",        // Meta down: connection dropped
};

const sign = (body: string, secret = QA.whatsApp.appSecret) => "sha256=" + crypto.createHmac("sha256", secret).update(body, "utf8").digest("hex");

function statusPayload(messageId: string, status: string, error?: { code: number; title: string }) {
  return JSON.stringify({
    object: "whatsapp_business_account",
    entry: [{
      id: "QA-WABA",
      changes: [{
        field: "messages",
        value: {
          messaging_product: "whatsapp",
          metadata: { display_phone_number: "917448300000", phone_number_id: QA.whatsApp.phoneNumberId },
          statuses: [{ id: messageId, status, timestamp: String(Math.floor(Date.now() / 1000)), recipient_id: TO.ok, ...(error ? { errors: [error] } : {}) }],
        },
      }],
    }],
  });
}

it.describe.serial("WhatsApp Cloud API (fake Meta server)", () => {
  it.beforeAll(async () => {
    fake = http.createServer((req, res) => {
      let raw = "";
      req.on("data", (c) => (raw += c));
      req.on("end", () => {
        const body = raw ? JSON.parse(raw) : {};
        sent.push({ path: req.url ?? "", auth: req.headers.authorization ?? "", body });
        if (req.url !== `/v25.0/${QA.whatsApp.phoneNumberId}/messages` || req.method !== "POST") return metaError(res, 400, 100, "Unsupported post request.");
        if (req.headers.authorization !== `Bearer ${QA.whatsApp.accessToken}`) return metaError(res, 401, 190, "Invalid OAuth access token.");
        switch (body.to) {
          case TO.badToken: return metaError(res, 401, 190, "Error validating access token: Session has expired.");
          case TO.notAllowed: return metaError(res, 400, 131030, "(#131030) Recipient phone number not in allowed list", "Recipient phone number not in allowed list: Add recipient phone number to recipient list and try again.");
          case TO.noTemplate: return metaError(res, 404, 132001, "(#132001) Template name does not exist in the translation", "template name (missing_template) does not exist in en_US");
          case TO.outage: req.socket.destroy(); return;
        }
        meta(res, 200, { messaging_product: "whatsapp", contacts: [{ input: body.to, wa_id: body.to }], messages: [{ id: `wamid.QA${sent.length}` }] });
      });
    });
    await new Promise<void>((r) => fake.listen(QA.fakeMetaPort, r));
  });

  it.afterAll(async () => { await new Promise((r) => fake.close(r)); });

  it("status: the admin sees what is configured, never the secrets", async () => {
    const { api } = await apiAs("admin");
    const s = await (await api.get("/api/admin/whatsapp/status")).json();
    expect(s).toMatchObject({ provider: "CloudApi", apiVersion: "v25.0", accessTokenSet: true, appSecretSet: true, webhookVerifyTokenSet: true, readyToSend: true, webhookReady: true });
    const text = JSON.stringify(s);
    for (const secret of [QA.whatsApp.accessToken, QA.whatsApp.appSecret, QA.whatsApp.verifyToken, QA.whatsApp.phoneNumberId]) {
      expect(text, "no secret or full id in the response").not.toContain(secret);
    }
    await api.dispose();
  });

  it("test message: hello_world template goes out exactly as Meta expects and returns Meta's message id", async () => {
    const { api } = await apiAs("admin");
    const res = await api.post("/api/admin/whatsapp/test-message", { data: { to: `+${TO.ok}` } });
    expect(res.ok(), await res.text()).toBeTruthy();
    const r = await res.json();
    expect(r).toMatchObject({ success: true, simulated: false, provider: "CloudApi" });
    expect(r.messageId).toMatch(/^wamid\.QA/);
    expect(r.to, "number masked in the response").toBe("********0001");

    const call = sent.at(-1)!;
    expect(call.auth).toBe(`Bearer ${QA.whatsApp.accessToken}`);
    expect(call.body).toEqual({
      messaging_product: "whatsapp", to: TO.ok, type: "template",
      template: { name: "hello_world", language: { code: "en_US" } }, // no empty "components" - Meta refuses those
    });
    await api.dispose();
  });

  it("plain text and templates with values are formatted correctly", async () => {
    const { api } = await apiAs("admin");
    const t = await (await api.post("/api/admin/whatsapp/test-message", { data: { to: TO.ok, text: "Hello from QA" } })).json();
    expect(t.success).toBe(true);
    expect(sent.at(-1)!.body).toMatchObject({ type: "text", text: { body: "Hello from QA" } });
    // A bare 10-digit Indian number without a country code is refused (none is configured in QA).
    expect((await api.post("/api/admin/whatsapp/test-message", { data: { to: "12345" } })).status()).toBe(400);
    await api.dispose();
  });

  it("errors from Meta come back clearly: expired token, number not allowed, unknown template, Meta unreachable", async () => {
    const { api } = await apiAs("admin");
    const send = async (to: string, extra: object = {}) => (await api.post("/api/admin/whatsapp/test-message", { data: { to, ...extra } })).json();

    const token = await send(TO.badToken);
    expect(token).toMatchObject({ success: false, errorCode: 190 });
    expect(token.error).toContain("access token");

    const allowed = await send(TO.notAllowed);
    expect(allowed).toMatchObject({ success: false, errorCode: 131030 });
    expect(allowed.error).toContain("Add recipient phone number to recipient list");

    const tpl = await send(TO.noTemplate, { template: "missing_template" });
    expect(tpl).toMatchObject({ success: false, errorCode: 132001 });

    const down = await send(TO.outage);
    expect(down).toMatchObject({ success: false });
    expect(down.error).toContain("Couldn't reach WhatsApp");

    // The API itself stays healthy after all of that.
    expect((await api.get("/api/admin/whatsapp/status")).ok()).toBeTruthy();
    await api.dispose();
  });

  it("webhook handshake: Meta's verify request is answered only with the right token", async () => {
    const pub = await request.newContext({ baseURL: QA.apiUrl });
    const ok = await pub.get(`/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=${QA.whatsApp.verifyToken}&hub.challenge=1158201444`);
    expect(ok.status()).toBe(200);
    expect(await ok.text()).toBe("1158201444");
    expect((await pub.get(`/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=1`)).status()).toBe(403);
    expect((await pub.get(`/api/webhooks/whatsapp?hub.mode=unsubscribe&hub.verify_token=${QA.whatsApp.verifyToken}&hub.challenge=1`)).status()).toBe(403);
    expect((await pub.get(`/api/webhooks/whatsapp`)).status()).toBe(403);
    await pub.dispose();
  });

  it("webhook receipts: signed sent/delivered/read/failed are recorded; unsigned or forged calls are refused", async () => {
    const { api: admin } = await apiAs("admin");
    const id = (await (await admin.post("/api/admin/whatsapp/test-message", { data: { to: TO.ok } })).json()).messageId as string;
    const pub = await request.newContext({ baseURL: QA.apiUrl });
    const post = (body: string, signature?: string) =>
      pub.post("/api/webhooks/whatsapp", { headers: { "content-type": "application/json", ...(signature ? { "x-hub-signature-256": signature } : {}) }, data: Buffer.from(body, "utf8") });

    for (const status of ["sent", "delivered", "read"]) {
      const body = statusPayload(id, status);
      expect((await post(body, sign(body))).status(), `${status} accepted`).toBe(200);
    }
    const receipts = await (await admin.get(`/api/admin/whatsapp/messages/${encodeURIComponent(id)}`)).json();
    expect(receipts.map((r: { status: string }) => r.status)).toEqual(["sent", "delivered", "read"]);
    expect(receipts[0].recipientMasked, "recipient masked").toBe("********0001");

    // A failed delivery keeps Meta's reason.
    const failedId = "wamid.QA-FAILED";
    const failed = statusPayload(failedId, "failed", { code: 131026, title: "Message undeliverable" });
    expect((await post(failed, sign(failed))).status()).toBe(200);
    expect(await (await admin.get(`/api/admin/whatsapp/messages/${failedId}`)).json()).toEqual([
      expect.objectContaining({ status: "failed", errorCode: 131026, errorTitle: "Message undeliverable" }),
    ]);

    // Refused: no signature, a signature made with another secret, a body changed after signing.
    const forged = statusPayload("wamid.FORGED", "delivered");
    expect((await post(forged)).status()).toBe(403);
    expect((await post(forged, sign(forged, "someone-elses-secret"))).status()).toBe(403);
    expect((await post(forged.replace("delivered", "read"), sign(forged))).status()).toBe(403);
    expect(await (await admin.get(`/api/admin/whatsapp/messages/wamid.FORGED`)).json(), "nothing recorded from forged calls").toEqual([]);
    // Signed but not JSON.
    expect((await post("not json", sign("not json"))).status()).toBe(400);
    // An incoming customer message (no statuses) is accepted.
    const incoming = JSON.stringify({ object: "whatsapp_business_account", entry: [{ changes: [{ value: { messages: [{ from: TO.ok, id: "wamid.IN", timestamp: "1", type: "text", text: { body: "hi" } }] } }] }] });
    expect((await post(incoming, sign(incoming))).status()).toBe(200);
    await pub.dispose();
    await admin.dispose();
  });

  it("only the platform admin can use the WhatsApp admin endpoints", async () => {
    const { api: owner } = await apiAs("a");
    expect((await owner.get("/api/admin/whatsapp/status")).status()).toBe(403);
    expect((await owner.post("/api/admin/whatsapp/test-message", { data: { to: TO.ok } })).status()).toBe(403);
    const anon = await request.newContext({ baseURL: QA.apiUrl });
    expect((await anon.get("/api/admin/whatsapp/status")).status()).toBe(401);
    expect((await anon.post("/api/admin/whatsapp/test-message", { data: { to: TO.ok } })).status()).toBe(401);
    await owner.dispose();
    await anon.dispose();
  });
});
