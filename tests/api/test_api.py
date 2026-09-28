"""End-to-end API checks for Studio OS, run by CI against a freshly migrated, empty database.

The suite creates everything it needs (two studios with free trials, customers, events, photos) through
the API itself, so it never depends on existing data. Only the Python standard library is used.

Environment:
  API_BASE              default http://localhost:5237/api
  CI_ADMIN_EMAIL        the Super Admin seeded by Bootstrap:SuperAdminEmail
  CI_ADMIN_PASSWORD     the Super Admin seeded by Bootstrap:SuperAdminPassword

Exit code 0 when every check passes, 1 otherwise.
"""
import base64
import json
import os
import random
import sys
import time
import urllib.error
import urllib.request
import uuid
from datetime import date, timedelta
from pathlib import Path

API = os.environ.get("API_BASE", "http://localhost:5237/api").rstrip("/")
ROOT = API[: -len("/api")] if API.endswith("/api") else API
ADMIN = (os.environ.get("CI_ADMIN_EMAIL", "ci-admin@studioos.test"), os.environ.get("CI_ADMIN_PASSWORD", "CiAdmin!Pass2026"))
TODAY = date.today()
RUN = uuid.uuid4().hex[:6]
PHOTO = (Path(__file__).parent / "fixtures" / "photo.jpg").read_bytes()

passed, failed = 0, []


def area(name):
    print(f"\n== {name}")


def ok(cond, label, detail=""):
    global passed
    if cond:
        passed += 1
        print(f"  ok   {label}")
    else:
        failed.append(label)
        print(f"  FAIL {label}  -> {str(detail)[:300]}")
        if os.environ.get("GITHUB_ACTIONS"):
            # Shows on the run's summary page as well as in the log.
            text = f"{label} -> {str(detail)[:500]}".replace("%", "%25").replace("\r", "").replace("\n", "%0A")
            print(f"::error title=API check failed::{text}")


def req(method, path, body=None, tok=None, raw=None, headers=None, base=API):
    """Returns (status, parsed body or bytes, response headers). Waits out rate limits (429)."""
    for _ in range(20):
        h = {"Content-Type": "application/json"}
        h.update(headers or {})
        if tok:
            h["Authorization"] = "Bearer " + tok
        data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
        r = urllib.request.Request(base + path, method=method, data=data, headers=h)
        try:
            with urllib.request.urlopen(r, timeout=120) as resp:
                content, status, hdrs = resp.read(), resp.status, resp.headers
        except urllib.error.HTTPError as e:
            if e.code == 429:
                time.sleep(int(e.headers.get("Retry-After") or 10))
                continue
            content, status, hdrs = e.read(), e.code, e.headers
        ctype = hdrs.get("Content-Type", "")
        if content and "json" in ctype:
            return status, json.loads(content), hdrs
        return status, content, hdrs
    raise RuntimeError(f"still rate limited: {method} {path}")


def items(b):
    return b.get("items", []) if isinstance(b, dict) else (b or [])


def login(email, password):
    c, b, _ = req("POST", "/auth/login", {"email": email, "password": password})
    return b if c == 200 else None


def multipart(fields, file_field=None, filename=None, content=b"", ctype="image/jpeg"):
    boundary = "----ci" + uuid.uuid4().hex
    parts = [f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode() for k, v in fields.items()]
    if file_field:
        parts.append(
            f'--{boundary}\r\nContent-Disposition: form-data; name="{file_field}"; filename="{filename}"\r\nContent-Type: {ctype}\r\n\r\n'.encode()
            + content + b"\r\n")
    parts.append(f"--{boundary}--\r\n".encode())
    return b"".join(parts), {"Content-Type": f"multipart/form-data; boundary={boundary}"}


def mobile(prefix):
    return prefix + str(random.randint(10**7, 10**8 - 1))


# ============================================================================================ STARTUP
area("Health and security headers")
c, b, h = req("GET", "/health", base=ROOT)
ok(c == 200 and b"Healthy" in b, "/health reports Healthy", (c, b))
ok(h.get("X-Content-Type-Options") == "nosniff", "X-Content-Type-Options: nosniff", dict(h))
ok(h.get("X-Frame-Options") in ("DENY", "SAMEORIGIN") or "frame-ancestors" in (h.get("Content-Security-Policy") or ""), "clickjacking protection header", dict(h))
ok(not h.get("Server"), "no Server header", h.get("Server"))

# ============================================================================================ SETUP
area("Super Admin creates two studios")
admin = login(*ADMIN)
ok(admin is not None, "seeded Super Admin signs in")
if admin is None:
    print("\nCannot continue without the Super Admin.")
    sys.exit(1)
A = admin["accessToken"]

studios = {}
for key in ("a", "b"):
    email, password = f"ci-owner-{key}-{RUN}@studioos.test", f"CiOwner!{RUN}Pass"
    body = {"studioName": f"CI Studio {key.upper()} {RUN}", "phoneNumber": "9876543210", "ownerFullName": f"CI Owner {key.upper()}",
            "ownerEmail": email, "ownerPassword": password, "subscriptionPlanId": 0, "freeTrial": True,
            "trialStartDate": str(TODAY), "trialEndDate": str(TODAY + timedelta(days=30))}
    c, s, _ = req("POST", "/studios", body, A)
    ok(c == 201 and s.get("studioId"), f"create studio {key.upper()} with a 30-day free trial", (c, s))
    studios[key] = {"id": s["studioId"], "email": email, "password": password}
    for feature in ("PHOTO_SELECTION", "PHOTO_DELIVERY"):
        req("POST", f"/studios/{s['studioId']}/features/{feature}/enable", tok=A)

c, _, _ = req("POST", "/studios", {**body, "studioName": "dup"}, A)
ok(c == 409, "same owner email twice -> 409", c)
c, _, _ = req("POST", "/studios", {**body, "ownerEmail": f"x{RUN}@studioos.test", "trialEndDate": str(TODAY - timedelta(days=1))}, A)
ok(c == 400, "trial ending before it starts -> 400", c)

# ============================================================================================ AUTH
area("Sign-in and tokens")
la, lb = login(studios["a"]["email"], studios["a"]["password"]), login(studios["b"]["email"], studios["b"]["password"])
ok(la and lb, "both owners sign in")
Q, T = la["accessToken"], lb["accessToken"]
ok(la["user"]["studioId"] == studios["a"]["id"], "sign-in carries the right studio", la.get("user"))
ok("passwordhash" not in json.dumps(la).lower().replace("_", ""), "no password hash in the sign-in reply")
c1, b1, _ = req("POST", "/auth/login", {"email": studios["a"]["email"], "password": "wrong-password"})
c2, b2, _ = req("POST", "/auth/login", {"email": f"nobody-{RUN}@nowhere.test", "password": "wrong-password"})
ok(c1 == 401 and c2 == 401 and b1 == b2, "wrong password and unknown email look the same (401)", (c1, b1, c2, b2))
ok(req("POST", "/auth/login", {})[0] == 400, "empty sign-in body -> 400")
ok(req("GET", "/customers")[0] == 401, "no token -> 401")
ok(req("GET", "/customers", tok="garbage.token.here")[0] == 401, "garbage token -> 401")
hdr, payload, sig = Q.split(".")
claims = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
claims["StudioId"] = str(studios["b"]["id"])
forged = hdr + "." + base64.urlsafe_b64encode(json.dumps(claims).encode()).decode().rstrip("=") + "." + sig
ok(req("GET", "/customers", tok=forged)[0] == 401, "token edited to another studio -> 401")
none_hdr = base64.urlsafe_b64encode(b'{"alg":"none","typ":"JWT"}').decode().rstrip("=")
ok(req("GET", "/customers", tok=none_hdr + "." + payload + ".")[0] == 401, "alg=none token -> 401")
c, me, _ = req("GET", "/auth/me", tok=Q)
ok(c == 200 and me.get("studioId") == studios["a"]["id"], "/auth/me", (c, me))

extra = login(studios["b"]["email"], studios["b"]["password"])
c, r1, _ = req("POST", "/auth/refresh", {"refreshToken": extra["refreshToken"]})
ok(c == 200 and r1["refreshToken"] != extra["refreshToken"], "refresh rotates the refresh token", c)
time.sleep(61)  # past the short grace period for sibling tabs refreshing at the same moment
ok(req("POST", "/auth/refresh", {"refreshToken": extra["refreshToken"]})[0] == 401, "an old refresh token is refused")
ok(req("POST", "/auth/logout", {"refreshToken": r1["refreshToken"]}, r1["accessToken"])[0] in (200, 204), "logout")
ok(req("POST", "/auth/refresh", {"refreshToken": r1["refreshToken"]})[0] == 401, "refresh after logout refused")
ok(req("GET", "/auth/forgot-password/options")[0] == 200, "forgot-password options")

area("Admin vs studio permissions")
for path in ["/admin/overview", "/studios", "/audit-logs", f"/studios/{studios['a']['id']}/features"]:
    ok(req("GET", path, tok=Q)[0] == 403, f"studio owner blocked from {path}")
for path in ["/customers", "/events", "/payments"]:
    ok(req("GET", path, tok=A)[0] == 403, f"admin blocked from studio-only {path}")
ok(req("POST", f"/studios/{studios['a']['id']}/features/LEADS/disable", tok=Q)[0] == 403, "owner can't switch their own modules")

# ============================================================================================ STUDIO DATA
area("Customers")
cust = {"fullName": "CI Customer Arun", "mobileNumber": mobile("96"), "email": "ci.customer@example.invalid", "address": "1 Test St",
        "notes": "<script>alert(1)</script>"}
c, C, _ = req("POST", "/customers", cust, Q)
ok(c in (200, 201), "create customer", (c, C))
cid = C["customerId"]
ok(C.get("notes") == cust["notes"], "HTML is stored as plain text")
for bad, why in [({"fullName": " "}, "blank name"), ({"mobileNumber": "12"}, "short mobile"), ({"email": "a@"}, "bad email"),
                 ({"mobileNumber": "9" * 30}, "30-digit mobile")]:
    ok(req("POST", "/customers", {**cust, **bad}, Q)[0] == 400, f"customer rejected: {why}")
ok(req("POST", "/customers", cust, Q)[0] == 409, "duplicate mobile in the same studio -> 409")
ok(req("POST", "/customers", cust, T)[0] in (200, 201), "the same mobile is fine in another studio")
ok(req("PUT", f"/customers/{cid}", {**cust, "address": "2 Test St"}, Q)[0] == 200, "update customer")
c, b, _ = req("GET", "/customers?search=CI%20Customer", tok=Q)
ok(any(x["customerId"] == cid for x in items(b)), "customer search")
for q in ["page=0&pageSize=0", "page=1&pageSize=100000", "sortBy=%27%3BDROP%20TABLE%20Customers%3B--", "search=%27%20OR%201%3D1--"]:
    c, b, _ = req("GET", f"/customers?{q}", tok=Q)
    ok(c in (200, 400) and (c != 200 or len(items(b)) <= 100), f"odd query '{q}' handled safely", (c, b))

area("Events and payments")
ev = {"customerId": cid, "eventDate": str(TODAY + timedelta(days=30)), "startTime": "10:00", "endTime": "18:00", "venue": "CI Hall",
      "budget": 55000, "advancePaid": 20000, "advancePaymentMethod": "UPI", "eventStatus": "Upcoming"}
c, E, _ = req("POST", "/events", ev, Q)
ok(c in (200, 201), "create event with a 20,000 advance", (c, E))
eid = E["eventId"]
c, E1, _ = req("GET", f"/events/{eid}", tok=Q)
ok(float(E1["balance"]) == 35000, "balance 55,000 - 20,000 = 35,000", E1.get("balance"))
pay = {"customerId": cid, "eventId": eid, "amount": 10000, "paymentDate": str(TODAY), "paymentMethod": "UPI", "paymentStatus": "Completed"}
c, P, _ = req("POST", "/payments", pay, Q)
ok(c in (200, 201), "record a 10,000 payment", (c, P))
pid = P["paymentId"]
ok(float(req("GET", f"/events/{eid}", tok=Q)[1]["balance"]) == 25000, "balance now 25,000")
for bad, why in [({"amount": 0}, "amount 0"), ({"amount": -500}, "negative amount"), ({"paymentMethod": "Bitcoin"}, "unknown method"),
                 ({"amount": 999999}, "more than the balance"), ({"paymentDate": str(TODAY + timedelta(days=3))}, "future date")]:
    c, b, _ = req("POST", "/payments", {**pay, **bad}, Q)
    ok(c == 400, f"payment rejected: {why}", (c, b))
ok(req("PUT", f"/payments/{pid}", {**pay, "paymentStatus": "Cancelled"}, Q)[0] == 200, "cancel the payment")
ok(float(req("GET", f"/events/{eid}", tok=Q)[1]["balance"]) == 35000, "cancelled payment gives the balance back")
c, b, _ = req("PUT", f"/events/{eid}", {**ev, "budget": 10000}, Q)
ok(c == 400, "event total can't go below what's already paid", (c, b))

area("Quotations and PDF")
qb = {"customerId": cid, "eventId": eid, "quotationDate": str(TODAY), "discount": 1000, "taxAmount": 0, "status": "Draft",
      "items": [{"customName": "CI Candid", "quantity": 2, "unitPrice": 25000}, {"customName": "CI Travel", "quantity": 1, "unitPrice": 5000}]}
c, QT, _ = req("POST", "/quotations", qb, Q)
ok(c in (200, 201) and float(QT.get("grandTotal", 0)) == 54000, "2 x 25,000 + 5,000 - 1,000 = 54,000", (c, QT))
qid = QT.get("quotationId")
ok(req("POST", "/quotations", {**qb, "items": []}, Q)[0] == 400, "quotation without items -> 400")
ok(req("POST", "/quotations", {**qb, "discount": 999999}, Q)[0] == 400, "discount bigger than the total -> 400")
c, pdf, _ = req("GET", f"/quotations/{qid}/pdf", tok=Q)
ok(c == 200 and pdf[:4] == b"%PDF", "quotation PDF downloads", (c, pdf[:40] if isinstance(pdf, bytes) else pdf))

# ============================================================================================ PHOTOS
area("Photos from the studio's computer")
c, done_ev, _ = req("POST", "/events", {"customerId": cid, "eventDate": str(TODAY - timedelta(days=5)), "eventStatus": "Completed", "budget": 10000}, Q)
ok(c in (200, 201), "completed event for the photo gallery", (c, done_ev))
c, g, _ = req("POST", f"/photo-galleries/events/{done_ev['eventId']}", tok=Q)
ok(c == 200 and g.get("galleryId"), "open the event's gallery", (c, g))
gid = g["galleryId"]


def upload(folder, path, content=PHOTO, tok=Q, gallery=None):
    raw, hdrs = multipart({"folder": folder, "path": path}, "file", "preview.jpg", content)
    return req("POST", f"/photo-galleries/{gallery or gid}/device-photos", raw=raw, headers=hdrs, tok=tok)


c, b, _ = req("GET", f"/photo-galleries/{gid}/device-photos?folder=CI%20Wedding", tok=Q)
ok(c == 200 and b["present"] == [], "nothing present yet", (c, b))
for n, path in enumerate(["Candid/IMG_0001.jpg", "Candid/IMG_0002.jpg", "IMG_0003.CR3"], 1):
    c, b, _ = upload("CI Wedding", path)
    ok(c == 200 and b.get("outcome") == "Added", f"photo {n} added ({path})", (c, b))
c, b, _ = upload("CI Wedding", "Candid/IMG_0001.jpg")
ok(c == 200 and b.get("outcome") == "AlreadyThere", "the same photo again is not duplicated", (c, b))
c, b, _ = req("GET", f"/photo-galleries/{gid}/device-photos?folder=CI%20Wedding", tok=Q)
ok(sorted(b.get("present", [])) == ["Candid/IMG_0001.jpg", "Candid/IMG_0002.jpg", "IMG_0003.CR3"], "present list matches", b)
for folder, path, content, why in [("CI Wedding", "../evil.jpg", PHOTO, "path with .."), ("..", "a.jpg", PHOTO, "folder name .."),
                                   ("C:\\Windows", "a.jpg", PHOTO, "drive in the folder name"), ("CI Wedding", "clip.mp4", PHOTO, "a video"),
                                   ("CI Wedding", "Customer Selection/Normal/x.jpg", PHOTO, "our own Customer Selection copies"),
                                   ("CI Wedding", "fake.jpg", b"<script>alert(1)</script>" * 40, "not really an image")]:
    ok(upload(folder, path, content)[0] == 400, f"refused: {why}")
ok(upload("CI Wedding", "IMG_0009.jpg", tok=T)[0] == 404, "another studio can't add photos to this gallery")
ok(req("GET", f"/photo-galleries/{gid}/device-photos?folder=CI%20Wedding", tok=T)[0] == 404, "another studio can't list it")
ok(req("POST", f"/photo-galleries/{gid}/device-photos/done", {"folder": "CI Wedding", "added": 3, "skipped": 0, "failed": 0}, Q)[0] == 204, "import finished")
c, g, _ = req("POST", f"/photo-galleries/events/{done_ev['eventId']}", tok=Q)
ok(g["counts"]["total"] == 3 and any(s["sourceFolder"].endswith("CI Wedding") for s in g["importedSources"]), "gallery shows 3 photos from 'CI Wedding'", g.get("counts"))
c, b, _ = req("POST", f"/photo-galleries/{gid}/rebuild-previews", tok=Q)
ok(c == 409 and b.get("code") == "CHOOSE_FOLDER_AGAIN", "rebuild asks to choose the folder again", (c, b))
c, ph, _ = req("GET", f"/photo-galleries/{gid}/photos?page=1&pageSize=50", tok=Q)
photos = items(ph)
ok(len(photos) == 3, "owner photo list", ph)
preview = next((p.get("previewUrl") or p.get("previewPath") or p.get("thumbnailUrl") for p in photos), None)
if preview:
    c, img, _ = req("GET", preview, base=ROOT)
    ok(c == 200 and len(img) > 500, "preview image is served", c)

area("Customer link and selection")
c, link, _ = req("POST", f"/photo-galleries/{gid}/link", {"expiresInDays": 5}, Q)
token = next((v for v in (link or {}).values() if isinstance(v, str) and len(v) > 30), None)
ok(c == 200 and token, "generate the customer link", (c, link))
c, pub, _ = req("GET", f"/public/photo-selection/{token}")
ok(c == 200 and "CI Wedding" not in json.dumps(pub) and "sourceFolder" not in json.dumps(pub), "customer page opens, no folder names leak", (c, pub))
c, pp, _ = req("GET", f"/public/photo-selection/{token}/photos?page=1&pageSize=50")
pub_photos = items(pp)
ok(len(pub_photos) == 3, "customer sees 3 photos", pp)
ids = [p["photoId"] for p in pub_photos]
ok(req("PUT", f"/public/photo-selection/{token}/photos/{ids[0]}", {"selectionType": 1})[0] == 200, "customer selects a photo (Normal)")
c, r, _ = req("PUT", f"/public/photo-selection/{token}/photos/{ids[1]}", {"selectionType": 2})
ok(c == 200 and r["counts"]["selected"] == 2 and r["counts"]["big"] == 1, "second photo as Big; counters update", (c, r))
c, r, _ = req("DELETE", f"/public/photo-selection/{token}/photos/{ids[1]}")
ok(c == 200 and r["counts"]["selected"] == 1, "unselect removes it", (c, r))
req("PUT", f"/public/photo-selection/{token}/photos/{ids[1]}", {"selectionType": 2})
c, s, _ = req("POST", f"/public/photo-selection/{token}/submit")
ok(c == 200 and s["counts"]["selected"] == 2, "customer submits", (c, s))
c, sel, _ = req("GET", f"/photo-galleries/{gid}/device-photos/selection", tok=Q)
ok(c == 200 and sorted((x["selectionType"], x["source"]) for x in sel) == [("Big Size", "CI Wedding"), ("Normal", "CI Wedding")],
   "owner gets the picks with their folder (Normal / Big Size)", (c, sel))
ok(req("GET", f"/photo-galleries/{gid}/device-photos/selection", tok=T)[0] == 404, "another studio can't read the picks")
c, b, _ = req("GET", "/public/photo-selection/not-a-real-token")
ok(c in (404, 410) and "stack" not in json.dumps(b).lower(), "bad link -> friendly 404/410", (c, b))
ok(req("DELETE", f"/photo-galleries/{gid}/link", tok=Q)[0] in (200, 204), "revoke the link")
ok(req("GET", f"/public/photo-selection/{token}")[0] in (404, 410), "revoked link no longer opens")

# ============================================================================================ TENANCY
area("Studio B can't touch studio A's records")
probes = [("GET", f"/customers/{cid}"), ("PUT", f"/customers/{cid}"), ("GET", f"/events/{eid}"), ("PUT", f"/events/{eid}"),
          ("DELETE", f"/events/{eid}"), ("GET", f"/payments/{pid}"), ("PUT", f"/payments/{pid}"), ("GET", f"/quotations/{qid}"),
          ("GET", f"/quotations/{qid}/pdf"), ("GET", f"/photo-galleries/{gid}")]
hijack = {**cust, **pay, "fullName": "hijack", "eventDate": str(TODAY), "eventStatus": "Upcoming"}
for m, p in probes:
    c, b, _ = req(m, p, hijack if m == "PUT" else None, T)
    ok(c in (400, 403, 404), f"studio B {m} {p} -> {c}", (c, str(b)[:150]))
ok(req("POST", "/events", {**ev, "customerId": cid}, T)[0] in (400, 404), "studio B can't create an event for A's customer")
ok(req("POST", "/payments", pay, T)[0] in (400, 404), "studio B can't pay into A's event")
c, b, _ = req("GET", "/customers?search=CI%20Customer&page=1&pageSize=50", tok=T)
ok(all(x["customerId"] != cid for x in items(b)), "A's customer never appears in B's search")

# ============================================================================================ HYGIENE
area("Errors and uploads")
ok(req("POST", "/customers", raw=b"{not json", tok=Q)[0] == 400, "malformed JSON -> 400")
ok(req("POST", "/customers", raw=b"fullName=x", tok=Q, headers={"Content-Type": "text/plain"})[0] == 415, "wrong content type -> 415")
ok(req("GET", "/customers/abc", tok=Q)[0] == 404, "non-numeric id -> 404")
c, b, _ = req("POST", "/customers", {"fullName": "x", "mobileNumber": "9876543210", "email": "a" * 5000 + "@x.com"}, Q)
ok(c == 400 and "   at " not in json.dumps(b), "huge field -> 400 without a stack trace", c)
raw, hdrs = multipart({}, "file", "evil.png", b"<?php system($_GET['c']); ?>", "image/png")
ok(req("POST", "/studio-profile/logo", raw=raw, headers=hdrs, tok=Q)[0] == 400, "logo upload: a script pretending to be a PNG is refused")

print(f"\nPASSED {passed}  FAILED {len(failed)}")
for label in failed:
    print(f"  - {label}")
sys.exit(1 if failed else 0)
