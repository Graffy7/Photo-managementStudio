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
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

API = os.environ.get("API_BASE", "http://localhost:5237/api").rstrip("/")
ROOT = API[: -len("/api")] if API.endswith("/api") else API
ADMIN = (os.environ.get("CI_ADMIN_EMAIL", "ci-admin@studioos.test"), os.environ.get("CI_ADMIN_PASSWORD", "CiAdmin!Pass2026"))
# "Today" as the API sees it: the studio's business day (App:TimeZone, India by default), not the
# runner's own clock - a UTC runner is a day behind India between 18:30 and 24:00 UTC.
TODAY = datetime.now(timezone(timedelta(minutes=int(os.environ.get("APP_UTC_OFFSET_MINUTES", "330"))))).date()
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
    return bool(cond)


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
# Reusing a rotated refresh token looks like theft: every session of that user ends at once, open
# access tokens included (they used to keep working until they expired).
ok(req("GET", "/customers", tok=r1["accessToken"])[0] == 401, "possible token theft ends open sessions immediately")
ok(req("GET", "/customers", tok=T)[0] == 401, "...on every device of that user")
lb = login(studios["b"]["email"], studios["b"]["password"])
T = lb["accessToken"]
ok(req("GET", "/customers", tok=T)[0] == 200, "signing in again works")
fresh = login(studios["b"]["email"], studios["b"]["password"])
ok(req("POST", "/auth/logout", {"refreshToken": fresh["refreshToken"]}, fresh["accessToken"])[0] in (200, 204), "logout")
ok(req("POST", "/auth/refresh", {"refreshToken": fresh["refreshToken"]})[0] == 401, "refresh after logout refused")
ok(req("GET", "/customers", tok=T)[0] == 200, "signing out one device leaves the others signed in")
everywhere = login(studios["b"]["email"], studios["b"]["password"])
ok(req("POST", "/auth/logout-everywhere", tok=everywhere["accessToken"])[0] == 200, "sign out everywhere")
ok(req("GET", "/customers", tok=T)[0] == 401 and req("GET", "/customers", tok=everywhere["accessToken"])[0] == 401,
   "sign out everywhere ends every open session at once")
T = login(studios["b"]["email"], studios["b"]["password"])["accessToken"]
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
# The status follows the date (only Cancelled is taken from the request).
for days, sent, expect in [(10, "Completed", "Upcoming"), (0, "Upcoming", "Ongoing"), (-2, "Upcoming", "Completed"), (10, "Cancelled", "Cancelled")]:
    c, SE, _ = req("POST", "/events", {"customerId": cid, "eventDate": str(TODAY + timedelta(days=days)), "eventStatus": sent, "budget": 1000}, Q)
    ok(c in (200, 201) and SE.get("eventStatus") == expect, f"event {days:+d} days, sent {sent} -> {expect}", (c, SE.get("eventStatus") if isinstance(SE, dict) else SE))
    if c in (200, 201) and days == 10 and sent == "Completed":
        moved = {k: SE[k] for k in ("customerId", "eventDate")}
        c2, SE2, _ = req("PUT", f"/events/{SE['eventId']}", {**moved, "budget": 1000, "eventDate": str(TODAY - timedelta(days=1)), "eventStatus": "Upcoming", "rowVersion": SE.get("rowVersion")}, Q)
        ok(c2 == 200 and SE2.get("eventStatus") == "Completed" and SE2.get("completedAt"), "moving the date into the past makes it Completed", (c2, SE2))
c, E1, _ = req("GET", f"/events/{eid}", tok=Q)
ok(float(E1["balance"]) == 35000, "balance 55,000 - 20,000 = 35,000", E1.get("balance"))
pay = {"customerId": cid, "eventId": eid, "amount": 10000, "paymentDate": str(TODAY), "paymentMethod": "UPI", "paymentStatus": "Completed"}
c, P, _ = req("POST", "/payments", pay, Q)
ok(c in (200, 201), "record a 10,000 payment", (c, P))
pid = P["paymentId"]
ok(float(req("GET", f"/events/{eid}", tok=Q)[1]["balance"]) == 25000, "balance now 25,000")
pend_ids = {x["paymentId"] for x in items(req("GET", "/payments?paymentStatus=Pending&pageSize=100", tok=Q)[1])}
done_ids = {x["paymentId"] for x in items(req("GET", "/payments?paymentStatus=Completed&pageSize=100", tok=Q)[1])}
ok(pid in pend_ids and pid not in done_ids, "Pending filter lists a payment whose event still has a balance owed (not under Completed)")
for bad, why in [({"amount": 0}, "amount 0"), ({"amount": -500}, "negative amount"), ({"paymentMethod": "Bitcoin"}, "unknown method"),
                 ({"amount": 999999}, "more than the balance"), ({"paymentDate": str(TODAY + timedelta(days=3))}, "future date")]:
    c, b, _ = req("POST", "/payments", {**pay, **bad}, Q)
    ok(c == 400, f"payment rejected: {why}", (c, b))
ok(req("PUT", f"/payments/{pid}", {**pay, "paymentStatus": "Cancelled"}, Q)[0] == 200, "cancel the payment")
ok(float(req("GET", f"/events/{eid}", tok=Q)[1]["balance"]) == 35000, "cancelled payment gives the balance back")
c, b, _ = req("PUT", f"/events/{eid}", {**ev, "budget": 10000}, Q)
ok(c == 400, "event total can't go below what's already paid", (c, b))
# Two people editing the same event: the one who saves second (with the version they loaded) is told.
version = req("GET", f"/events/{eid}", tok=Q)[1].get("rowVersion")
c, saved, _ = req("PUT", f"/events/{eid}", {**ev, "venue": "CI Hall 2", "rowVersion": version}, Q)
ok(c == 200 and saved.get("rowVersion") != version, "saving an event with its current version works", (c, saved))
c, b, _ = req("PUT", f"/events/{eid}", {**ev, "venue": "CI Hall 3", "rowVersion": version}, Q)
ok(c == 409 and b.get("code") == "EVENT_CHANGED", "saving with an out-of-date version -> 409", (c, b))
ok(req("PUT", f"/events/{eid}", {**ev, "venue": "CI Hall"}, Q)[0] == 200, "a save without a version still works")

area("List sorting and paging")
req("POST", "/events", {**ev, "budget": 90000, "advancePaid": 0}, Q)
c, b, _ = req("GET", "/events?sortBy=total&sortDesc=true&pageSize=50", tok=Q)
totals = [x["budget"] for x in items(b)]
ok(c == 200 and totals == sorted(totals, reverse=True) and len(totals) >= 2, "events sorted by total, highest first", totals)
c, b, _ = req("GET", "/events?sortBy=customer&pageSize=1&page=2", tok=Q)
ok(c == 200 and len(items(b)) == 1 and b.get("totalCount", 0) >= 2, "second page holds the next event", b)
for path in ["/events", "/customers", "/payments", "/quotations", "/leads"]:
    c, _, _ = req("GET", f"{path}?sortBy=%27%3BDROP%20TABLE%20x%3B--&sortDesc=true", tok=Q)
    ok(c == 200, f"{path}: an unknown sort column falls back to the usual order", c)

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
preview = next((p.get("previewUrl") for p in photos), None) or ""
ok(preview.startswith("/media/") and "sig=" in preview and "exp=" in preview, "previews come as signed, expiring links", preview)
c, img, h = req("GET", preview, base=ROOT)
ok(c == 200 and img[:4] == b"RIFF" and h.get("Content-Type") == "image/webp", "a signed link serves the preview", (c, h.get("Content-Type")))
ok("private" in (h.get("Cache-Control") or ""), "only the viewer's own browser may cache it", h.get("Cache-Control"))

area("Protected file links")
path_part, _, query = preview.partition("?")
params = dict(kv.split("=", 1) for kv in query.split("&"))
key = path_part[len("/media/"):]
sig = params["sig"]
bad_sig = ("A" if sig[0] != "A" else "B") + sig[1:]
ok(req("GET", f"{path_part}?exp={params['exp']}&sig={bad_sig}", base=ROOT)[0] == 403, "an altered signature is refused")
ok(req("GET", path_part, base=ROOT)[0] == 403, "a link without a signature is refused")
ok(req("GET", f"{path_part}?exp={int(params['exp']) + 3600}&sig={sig}", base=ROOT)[0] == 403, "changing the expiry breaks the link")
ok(req("GET", f"{path_part}?exp={int(time.time()) - 60}&sig={sig}", base=ROOT)[0] == 403, "an expired link is refused")
other = photos[1]["previewUrl"]
ok(req("GET", f"/media/{other.split('?')[0][len('/media/'):]}?exp={params['exp']}&sig={sig}", base=ROOT)[0] == 403,
   "one photo's signature doesn't open another photo")
for trick in ["/media/../appsettings.json", "/media/..%2Fappsettings.json", "/media/%2E%2E/%2E%2E/appsettings.json"]:
    c, _, _ = req("GET", f"{trick}?exp={params['exp']}&sig={sig}", base=ROOT)
    ok(c in (400, 403, 404), f"path trick refused: {trick} -> {c}")
ok(req("GET", f"/uploads/{key}", base=ROOT)[0] == 404, "the old public /uploads address no longer serves files")

raw, hdrs = multipart({}, "file", "logo.jpg", PHOTO, "image/jpeg")
c, prof, _ = req("POST", "/studio-profile/logo", raw=raw, headers=hdrs, tok=Q)
logo = (prof or {}).get("logoUrl") if isinstance(prof, dict) else None
ok(c == 200 and logo and logo.startswith("/media/logos/") and "sig=" in logo, "studio logo comes back as a signed link", (c, prof))
if logo:
    ok(req("GET", logo, base=ROOT)[0] == 200, "the logo link opens")

area("Customer link and selection")
c, link, _ = req("POST", f"/photo-galleries/{gid}/link", {"expiresInDays": 5}, Q)
token = next((v for v in (link or {}).values() if isinstance(v, str) and len(v) > 30), None)
ok(c == 200 and token, "generate the customer link", (c, link))
c, pub, _ = req("GET", f"/public/photo-selection/{token}")
ok(c == 200 and "CI Wedding" not in json.dumps(pub) and "sourceFolder" not in json.dumps(pub), "customer page opens, no folder names leak", (c, pub))

# Studio profile on the customer's link: the gallery's own studio, only the details it filled in.
c, mine, _ = req("GET", "/studio-profile", tok=Q)
base_profile = {k: mine.get(k) for k in ("studioName", "ownerName", "email", "phoneNumber", "address", "city", "state", "pincode", "gstNumber")}
c, _, _ = req("PUT", "/studio-profile", {**base_profile, "phoneNumber": None, "website": None}, Q)
brand = req("GET", f"/public/photo-selection/{token}")[1].get("studio") or {}
ok(c == 200 and brand.get("name") == mine["studioName"] and brand.get("logoUrl") and not brand.get("website")
   and not brand.get("description") and not brand.get("whatsAppUrl") and not brand.get("phone"),
   "a studio with only a name (and logo) shows just that - no empty contact fields", brand)
full = {**base_profile, "phoneNumber": "+91 98765 43210", "whatsAppNumber": "+91 98765 43210", "website": "ci-studio.example.com",
        "description": "Capturing your beautiful moments.", "instagramUrl": "instagram.com/cistudio"}
c, saved_prof, _ = req("PUT", "/studio-profile", full, Q)
ok(c == 200 and saved_prof.get("website") == "https://ci-studio.example.com/" and saved_prof.get("description") == "Capturing your beautiful moments.",
   "profile saves description, WhatsApp and links (website stored as https)", (c, saved_prof))
brand = req("GET", f"/public/photo-selection/{token}")[1].get("studio") or {}
ok(brand.get("description") == "Capturing your beautiful moments." and brand.get("website") == "https://ci-studio.example.com/"
   and brand.get("whatsAppUrl") == "https://wa.me/919876543210" and brand.get("instagramUrl") == "https://instagram.com/cistudio"
   and brand.get("phone") == "+91 98765 43210", "the customer's link shows the updated profile at once (link sent earlier)", brand)
ok(not any(k in json.dumps(brand) for k in ("gstNumber", "ownerName", "email", mine.get("email") or "@@")),
   "no private studio details on the customer's page", brand)
for bad, why in (({"website": "javascript:alert(1)"}, "a javascript: website"), ({"instagramUrl": "not a link"}, "a broken Instagram link"),
                 ({"whatsAppNumber": "98765"}, "a WhatsApp number without country code"), ({"phoneNumber": "call me"}, "letters in the phone number"),
                 ({"email": "not-an-email"}, "a bad email"), ({"studioName": ""}, "no studio name")):
    ok(req("PUT", "/studio-profile", {**full, **bad}, Q)[0] == 400, f"profile refused: {why}")
c, theirs, _ = req("GET", "/studio-profile", tok=T)
ok(c == 200 and theirs.get("studioId") != mine.get("studioId") and theirs.get("description") != "Capturing your beautiful moments.",
   "another studio sees only its own profile", theirs)
req("PUT", "/studio-profile", {**{k: theirs.get(k) for k in base_profile}, "description": "Studio B only"}, T)
brand = req("GET", f"/public/photo-selection/{token}")[1].get("studio") or {}
ok(brand.get("name") == mine["studioName"] and brand.get("description") == "Capturing your beautiful moments.",
   "another studio's change never shows on this studio's link", brand)
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

# Storage report (platform admin only): measured from the stored files.
c, sr, _ = req("GET", "/admin/storage?refresh=true", tok=A)
mine = next((x for x in (sr.get("studios") or []) if x["photoCount"] >= 3 and x["photosWithPreviews"] >= 3), None) if c == 200 else None
ok(c == 200 and sr["totalStoredBytes"] > 0 and sr["totalStoredFiles"] > 0 and mine is not None and mine["previewBytes"] > 0 and mine["thumbnailBytes"] > 0,
   "storage report measures previews and thumbnails", (c, mine))
ok(mine is not None and mine["previewBytes"] + mine["thumbnailBytes"] <= sr["totalStoredBytes"], "per-studio bytes fit inside the measured total", mine)
ok(req("GET", "/admin/storage", tok=Q)[0] == 403, "a studio owner can't see the storage report")

# Export of the selected originals: these photos were added from the studio's computer, so the
# server lists them (with their sorted destination) but never hands out a file for them.
c, xm, _ = req("GET", f"/photo-galleries/{gid}/selection-export", tok=Q)
ok(c == 200 and xm["selectedCount"] == 2 and xm["normalCount"] == 1 and xm["bigCount"] == 1 and xm["computerCount"] == 2,
   "export lists the 2 picks (1 Normal, 1 Big Size)", (c, xm))
ok(xm["rootFolderName"].endswith("_Selected") and all(f["sizeFolder"] in ("Normal", "Big Size") and f["category"] for f in xm["files"]),
   "each pick has a category and a Normal / Big Size folder", xm)
ok(all("/" not in f["fileName"] and "\\" not in f["fileName"] for f in xm["files"]), "export file names never contain a path", xm)
pick = xm["files"][0]["photoId"]
c, b, _ = req("GET", f"/photo-galleries/{gid}/selection-export/photos/{pick}", tok=Q)
ok(c == 409 and b.get("code") == "ORIGINAL_ON_COMPUTER", "an original kept on the studio's computer isn't served", (c, b))
not_picked = next(p["photoId"] for p in photos if p["photoId"] not in {f["photoId"] for f in xm["files"]})
ok(req("GET", f"/photo-galleries/{gid}/selection-export/photos/{not_picked}", tok=Q)[0] == 404, "a photo that isn't selected can't be exported")
ok(req("GET", f"/photo-galleries/{gid}/selection-export", tok=T)[0] == 404, "another studio can't see the export list")
ok(req("GET", f"/photo-galleries/{gid}/selection-export/photos/{pick}", tok=T)[0] == 404, "another studio can't download an original")
ok(req("GET", f"/photo-galleries/{gid}/selection-export/photos/{pick}")[0] == 401, "originals need a sign-in")
c, zl, _ = req("POST", f"/photo-galleries/{gid}/selection-export/zip-link", tok=Q)
ok(c == 200 and zl["url"].startswith("/api/selection-export-zip?t="), "ZIP link issued to the owner", (c, zl))
ok(req("POST", f"/photo-galleries/{gid}/selection-export/zip-link", tok=T)[0] == 404, "another studio can't get a ZIP link")
zt = zl["url"].split("t=", 1)[1]
ok(req("GET", "/selection-export-zip?t=" + zt.replace(f".{gid}.", f".{gid + 1}.", 1))[0] == 403, "a ZIP link edited to another gallery is refused")
ok(req("GET", "/selection-export-zip?t=1.1.9999999999.forged")[0] == 403, "a forged ZIP link is refused")
c, zb, zh = req("GET", "/selection-export-zip?t=" + zt)
ok(c == 200 and isinstance(zb, bytes) and zb[:2] == b"PK" and b"Export report.txt" in zb, "ZIP downloads with its export report", (c, zb[:60] if isinstance(zb, bytes) else zb))
c, b, _ = req("GET", "/public/photo-selection/not-a-real-token")
ok(c in (404, 410) and "stack" not in json.dumps(b).lower(), "bad link -> friendly 404/410", (c, b))
ok(req("DELETE", f"/photo-galleries/{gid}/link", tok=Q)[0] in (200, 204), "revoke the link")
ok(req("GET", f"/public/photo-selection/{token}")[0] in (404, 410), "revoked link no longer opens")

# ============================================================================================ EVENT EXPENSES
area("Event expenses and profit")
c, cat, _ = req("POST", "/expense-categories", {"categoryName": "Drone"}, Q)
ok(c == 200 and cat.get("expenseCategoryId"), "expense category created", c)
c, XC, _ = req("POST", "/customers", {"fullName": "CI Profit Customer", "mobileNumber": mobile("95")}, Q)
c, XE, _ = req("POST", "/events", {"customerId": XC["customerId"], "eventDate": str(TODAY + timedelta(days=40)), "budget": 100000, "eventStatus": "Upcoming"}, Q)
xeid = XE["eventId"]
req("POST", "/payments", {"customerId": XC["customerId"], "eventId": xeid, "amount": 30000, "paymentDate": str(TODAY), "paymentMethod": "UPI", "paymentStatus": "Completed"}, Q)
exp = {"expenseCategoryId": cat["expenseCategoryId"], "eventId": xeid, "expenseDate": str(TODAY), "amount": 15000,
       "vendorName": "CI Drone Vendor", "paymentStatus": "Paid", "description": "Drone for the reception"}
c, X1, _ = req("POST", "/expenses", exp, Q)
ok(c == 200 and X1["vendorName"] == "CI Drone Vendor" and X1["paymentStatus"] == "Paid" and X1["eventId"] == xeid, "expense saved with vendor, status and event", (c, X1))
c, X2, _ = req("POST", "/expenses", {**exp, "amount": 10000, "paymentStatus": "Pending", "vendorName": None}, Q)
ok(c == 200 and X2["paymentStatus"] == "Pending", "pending expense saved", c)
c, old, _ = req("POST", "/expenses", {**{k: v for k, v in exp.items() if k not in ("paymentStatus", "vendorName")}, "eventId": None, "amount": 1}, Q)
ok(c == 200 and old["paymentStatus"] == "Paid", "an expense sent without a status is recorded as Paid", (c, old))
c, S, _ = req("GET", f"/expenses/event/{xeid}", tok=Q)
ok(c == 200 and S["totalEventAmount"] == 100000 and S["totalExpenses"] == 25000 and S["paidExpenses"] == 15000 and S["pendingExpenses"] == 10000,
   "event summary: total, expenses, paid and pending", (c, S))
ok(S["netProfit"] == 75000 and S["profitMarginPercent"] == 75, "profit is the agreed total minus expenses (not what was collected)", S)
ok(S["amountReceived"] == 30000 and S["outstandingBalance"] == 70000, "customer money is reported apart: received and outstanding", S)
ok(len(S["expenses"]) == 2 and all(x["eventId"] == xeid for x in S["expenses"]), "only this event's expenses are listed")
c, U, _ = req("PUT", f"/expenses/{X2['expenseId']}", {**exp, "amount": 10000, "paymentStatus": "Paid"}, Q)
S = req("GET", f"/expenses/event/{xeid}", tok=Q)[1]
ok(c == 200 and S["pendingExpenses"] == 0 and S["paidExpenses"] == 25000 and S["netProfit"] == 75000, "marking an expense paid moves it from pending to paid; profit unchanged", S)
for bad, why in (({**exp, "amount": 0}, "zero amount"), ({**exp, "amount": -5}, "negative amount"), ({**exp, "paymentStatus": "Maybe"}, "unknown status"),
                 ({**exp, "vendorName": "v" * 151}, "vendor name too long"), ({**exp, "eventId": 99999999}, "unknown event")):
    ok(req("POST", "/expenses", bad, Q)[0] == 400, f"expense refused: {why}")
c, R, _ = req("GET", f"/reports/profit?preset=Custom&customStart={TODAY + timedelta(days=39)}&customEnd={TODAY + timedelta(days=41)}", tok=Q)
row = next((x for x in (R.get("events") or []) if x["eventId"] == xeid), None) if c == 200 else None
ok(row is not None and row["eventTotal"] == 100000 and row["expenses"] == 25000 and row["netProfit"] == 75000 and row["outstandingBalance"] == 70000,
   "profit report: event row on the agreed price", (c, row))
c, D, _ = req("GET", "/studio-dashboard/summary?preset=ThisMonth", tok=Q)
ok(c == 200 and D["paidExpenses"] + D["pendingExpenses"] == D["totalExpenses"], "dashboard: paid + pending expenses = total expenses", c)
c, D, _ = req("GET", "/studio-dashboard/summary?preset=ThisYear", tok=Q)
ok(c == 200 and D["totalEvents"] >= 0 and isinstance(D["totalEventValue"], (int, float)) and D["totalEventValue"] >= 0, "dashboard: event count and total event value for the period", c)
ok(req("GET", f"/expenses/event/{xeid}", tok=T)[0] == 404, "studio B can't read A's event expenses")
ok(req("PUT", f"/expenses/{X1['expenseId']}", exp, T)[0] in (400, 404), "studio B can't change A's expense")
ok(req("DELETE", f"/expenses/{X1['expenseId']}", tok=T)[0] == 404, "studio B can't delete A's expense")
ok(req("POST", "/expenses", exp, T)[0] == 400, "studio B can't add an expense to A's event")
ok(req("GET", f"/expenses/event/{xeid}")[0] == 401, "event expenses need a sign-in")
ok(req("DELETE", f"/expenses/{X2['expenseId']}", tok=Q)[0] == 204, "expense deleted")
S = req("GET", f"/expenses/event/{xeid}", tok=Q)[1]
ok(S["totalExpenses"] == 15000 and S["netProfit"] == 85000 and S["profitMarginPercent"] == 85, "totals follow the deletion", S)

area("Report analytics by date range")
COUNTS = ("newBookings", "events", "completed", "cancelled", "pending", "newCustomers", "repeatCustomers")
MONEY = ("eventValue", "moneyReceived", "expenses", "profit", "outstanding")
for preset, grouping, n in (("Last7Days", "Day", 7), ("Last1Month", "Day", None), ("Last3Months", "Month", 3), ("Last6Months", "Month", 6), ("Last1Year", "Month", 12)):
    c, AR, _ = req("GET", f"/reports/analytics?preset={preset}", tok=Q)
    if not ok(c == 200 and AR["grouping"] == grouping, f"{preset}: grouped by {grouping.lower()}", (c, AR if c != 200 else AR["grouping"])):
        continue
    bk = AR["buckets"]
    ok(n is None or len(bk) == n, f"{preset}: {n or 'every'} periods shown", len(bk))
    ok(AR["rangeLastDay"][:10] == str(TODAY) and bk[0]["start"][:10] == AR["rangeStart"][:10] and bk[-1]["lastDay"][:10] == str(TODAY),
       f"{preset}: periods cover exactly the range, ending today", (AR["rangeStart"], AR["rangeLastDay"]))
    gaps = [i for i in range(1, len(bk)) if (date.fromisoformat(bk[i]["start"][:10]) - date.fromisoformat(bk[i - 1]["lastDay"][:10])).days != 1]
    ok(not gaps, f"{preset}: no missing days or months (empty ones included)", gaps)
    ok(all(sum(b[k] for b in bk) == AR["summary"][k] for k in COUNTS + MONEY), f"{preset}: the periods add up to the summary cards")
    days = AR["eventDays"]
    ok(len(days) == (date.fromisoformat(AR["rangeLastDay"][:10]) - date.fromisoformat(AR["rangeStart"][:10])).days + 1
       and sum(d["events"] for d in days) == AR["summary"]["events"] - AR["summary"]["cancelled"],
       f"{preset}: busy days cover every day and add up to the events (cancelled left out)")
c, AR, _ = req("GET", f"/reports/analytics?preset=Custom&customStart={TODAY + timedelta(days=39)}&customEnd={TODAY + timedelta(days=41)}", tok=Q)
ok(c == 200 and AR["grouping"] == "Day" and len(AR["buckets"]) == 3 and AR["summary"]["events"] == 1 and AR["summary"]["eventValue"] == 100000
   and AR["summary"]["moneyReceived"] == 0, "custom 3 days: both dates included, only that event, payment dated elsewhere left out", (c, AR.get("summary") if isinstance(AR, dict) else AR))
ok(c == 200 and AR["summary"]["outstanding"] == 70000 and AR["summary"]["newCustomers"] + AR["summary"]["repeatCustomers"] == 1,
   "custom range: outstanding is what's unpaid (100,000 - 30,000) and the customer is counted once", AR.get("summary") if isinstance(AR, dict) else AR)
ok(c == 200 and any(t["events"] == 1 and t["eventValue"] == 100000 for t in AR["eventTypes"]) and sum(s["count"] for s in AR["statuses"]) == 1,
   "custom range: event types and statuses use the same range")
c, AR, _ = req("GET", f"/reports/analytics?preset=Custom&customStart={TODAY + timedelta(days=42)}&customEnd={TODAY + timedelta(days=60)}", tok=Q)
ok(c == 200 and AR["summary"]["events"] == 0, "custom range just after the event: not counted", c)
c, AR, _ = req("GET", f"/reports/analytics?preset=Custom&customStart={TODAY}&customEnd={TODAY}", tok=Q)
ok(c == 200 and AR["summary"]["moneyReceived"] >= 30000 and AR["summary"]["expenses"] >= 15000 and len(AR["buckets"]) == 1, "custom single day: today's money", c)
c, AR, _ = req("GET", f"/reports/analytics?preset=Custom&customStart=2024-01-15&customEnd=2024-06-10", tok=Q)
ok(c == 200 and AR["grouping"] == "Month" and [b["start"][:10] for b in AR["buckets"]][0] == "2024-01-15" and AR["buckets"][-1]["lastDay"][:10] == "2024-06-10"
   and len(AR["buckets"]) == 6, "long custom range: by month, first and last month cut to the chosen dates", c)
for q, why in ((f"customStart={TODAY}&customEnd={TODAY - timedelta(days=1)}", "start after end"), (f"customStart={TODAY}", "no end date"),
               ("customStart=2015-01-01&customEnd=2025-01-01", "more than 5 years")):
    ok(req("GET", f"/reports/analytics?preset=Custom&{q}", tok=Q)[0] == 400, f"custom range refused: {why}")
c, AR, _ = req("GET", f"/reports/analytics?preset=Custom&customStart={TODAY + timedelta(days=39)}&customEnd={TODAY + timedelta(days=41)}", tok=T)
ok(c == 200 and AR["summary"]["events"] == 0 and AR["summary"]["eventValue"] == 0, "studio B's report never includes A's events", c)
c, pdf_bytes, h = req("GET", f"/reports/analytics/export?preset=Custom&customStart={TODAY + timedelta(days=39)}&customEnd={TODAY + timedelta(days=41)}", tok=Q)
ok(c == 200 and "application/pdf" in h.get("Content-Type", "") and isinstance(pdf_bytes, bytes) and pdf_bytes[:5] == b"%PDF-" and len(pdf_bytes) > 2000,
   "PDF export of the report", (c, h.get("Content-Type")))
ok(f"studio-report-{TODAY + timedelta(days=39)}-to-{TODAY + timedelta(days=41)}.pdf" in (h.get("Content-Disposition") or ""), "PDF named after the chosen dates", h.get("Content-Disposition"))
c2, pdf_details, _ = req("GET", f"/reports/analytics/export?preset=Custom&customStart={TODAY + timedelta(days=39)}&customEnd={TODAY + timedelta(days=41)}&details=true", tok=Q)
ok(c2 == 200 and pdf_details[:5] == b"%PDF-" and len(pdf_details) > len(pdf_bytes), "PDF with details adds the table pages to the one-page summary", (c2, len(pdf_bytes), len(pdf_details) if isinstance(pdf_details, bytes) else pdf_details))
ok(req("GET", f"/reports/analytics/export?preset=Custom&customStart={TODAY}&customEnd={TODAY - timedelta(days=3)}", tok=Q)[0] == 400, "PDF export refuses a start after the end")
ok(req("GET", "/reports/analytics?preset=Last7Days")[0] == 401, "analytics need a sign-in")

# ============================================================================================ FOLDER IMPORTS
area("Folder imports: duplicates, rescans, concurrency")
import tempfile
import threading

# Each studio gets its own photo folder on the API's machine (the tests run on the same machine).
work = Path(tempfile.mkdtemp(prefix="studioos-ci-"))
root_a, root_b = work / "studio-a", work / "studio-b"


def put(path, content=PHOTO):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content)


for rel in ["ShootX/Candid/IMG_0001.jpg", "ShootX/Candid/IMG_0002.jpg", "ShootX/Traditional/IMG_0001.jpg",
            "ShootY/IMG_0001.jpg", "ShootW/IMG_1.jpg", "ShootW/IMG_2.jpg", "ShootV/IMG_1.jpg", "ShootZ/good.jpg"]:
    put(root_a / rel)
put(root_a / "ShootZ/broken.jpg", b"\xff\xd8\xff\xe0" + os.urandom(2000))   # looks like a JPEG, isn't one
put(root_b / "ShootX/Candid/IMG_0001.jpg")
ok(req("PUT", f"/admin/studios/{studios['a']['id']}/photo-root", {"path": str(root_a)}, A)[0] == 200, "studio A's photo folder set")
ok(req("PUT", f"/admin/studios/{studios['b']['id']}/photo-root", {"path": str(root_b)}, A)[0] == 200, "studio B's photo folder set")


cust_b = req("POST", "/customers", {"fullName": "CI Studio B Customer", "mobileNumber": mobile("93")}, T)[1]["customerId"]


def new_gallery(tok=Q, customer=None):
    cust_id = customer or cid
    c, e, _ = req("POST", "/events", {"customerId": cust_id, "eventDate": str(TODAY - timedelta(days=3)), "eventStatus": "Completed", "budget": 5000}, tok)
    return req("POST", f"/photo-galleries/events/{e['eventId']}", tok=tok)[1]["galleryId"]


def start_import(gallery, folder, tok=Q, anyway=False):
    return req("POST", f"/photo-galleries/{gallery}/import", {"sourceFolder": str(folder), "importIntoAnotherEvent": anyway}, tok)


def wait_job(gallery, job_id, tok=Q):
    for _ in range(120):
        c, j, _ = req("GET", f"/photo-galleries/{gallery}/import/{job_id}", tok=tok)
        if c == 200 and j["status"] not in ("Queued", "Running"):
            return j
        time.sleep(0.5)
    return None


def import_and_wait(gallery, folder, tok=Q, anyway=False):
    c, j, _ = start_import(gallery, folder, tok, anyway)
    return c, (wait_job(gallery, j["jobId"], tok) if c == 202 else j)


def gallery_photos(gallery, tok=Q):
    return items(req("GET", f"/photo-galleries/{gallery}/photos?page=1&pageSize=100", tok=tok)[1])


g1 = new_gallery()
c, j = import_and_wait(g1, root_a / "ShootX")
ok(c == 202 and j and j["status"] == "Completed" and len(gallery_photos(g1)) == 3,
   "folder imported: 3 photos, including two different files both named IMG_0001.jpg", (c, j))
c, b, _ = start_import(g1, root_a / "ShootX")
ok(c == 409 and b.get("code") == "ALREADY_IMPORTED" and len(gallery_photos(g1)) == 3, "the same folder again: nothing imported twice", (c, b))
c, b, _ = start_import(g1, str(root_a / "ShootX") + os.sep + "." + os.sep)
ok(c == 409 and b.get("code") == "ALREADY_IMPORTED", "the same folder typed differently is still recognised", (c, b))
c, b, _ = start_import(g1, root_a / "ShootX" / "Candid")
ok(c == 409 and b.get("code") == "ALREADY_IMPORTED" and len(gallery_photos(g1)) == 3, "a sub-folder of an imported folder isn't imported twice", (c, b))
c, j = import_and_wait(g1, root_a / "ShootY")
ok(c == 202 and j and j["status"] == "Completed" and len(gallery_photos(g1)) == 4,
   "another folder with a file of the same name (IMG_0001.jpg) is a different photo", (c, j))

# Another event's gallery: refused unless the owner confirms.
g2 = new_gallery()
c, b, _ = start_import(g2, root_a / "ShootX")
ok(c == 409 and b.get("code") == "IMPORTED_IN_ANOTHER_EVENT" and b.get("matchingPhotos") == 3 and len(gallery_photos(g2)) == 0,
   "a folder already in another event's gallery is refused with a clear message", (c, b))
c, j = import_and_wait(g2, root_a / "ShootX", anyway=True)
ok(c == 202 and j and j["status"] == "Completed" and len(gallery_photos(g2)) == 3, "...and imported when the owner confirms", (c, j))

# Two requests at the same moment: exactly one import starts.
g3, g4 = new_gallery(), new_gallery()
codes = []
def fire(gallery, folder):
    codes.append(start_import(gallery, folder)[0])
threads = [threading.Thread(target=fire, args=(g3, root_a / "ShootW")) for _ in range(2)]
[t.start() for t in threads]; [t.join() for t in threads]
ok(sorted(codes) == [202, 409], "two simultaneous imports of a folder into one gallery: one starts, one is refused", codes)
codes = []
threads = [threading.Thread(target=fire, args=(g, root_a / "ShootV")) for g in (g3, g4)]
time.sleep(3)  # let the ShootW job above finish first
[t.start() for t in threads]; [t.join() for t in threads]
ok(sorted(codes) == [202, 409], "two simultaneous imports of a folder into two events: one starts, one is refused", codes)
time.sleep(3)
ok(len(gallery_photos(g3)) + len(gallery_photos(g4)) == 2 + 1, "no photo was imported twice by the simultaneous requests",
   (len(gallery_photos(g3)), len(gallery_photos(g4))))

# A photo changed on disk: the rescan refreshes it in place (same photo, new preview).
before = {p["fileName"] + str(p["photoNumber"]): p for p in gallery_photos(g1)}
put(root_a / "ShootX/Candid/IMG_0002.jpg", PHOTO + b"\0" * 777)   # same picture, different file
c, j = import_and_wait(g1, root_a / "ShootX")
after = {p["fileName"] + str(p["photoNumber"]): p for p in gallery_photos(g1)}
changed = [k for k in after if k.startswith("IMG_0002") and before.get(k, {}).get("previewUrl", "").split("?")[0] != after[k].get("previewUrl", "").split("?")[0]]
ok(c == 202 and j and j["status"] == "Completed" and len(after) == 4 and len(changed) == 1
   and all(after[k]["photoId"] == before[k]["photoId"] for k in after),
   "a changed photo gets a new preview; same photo record, nothing duplicated", (c, j, len(after), changed))

# Studios never share: studio B can't read studio A's folder; its own identical folder is separate.
ok(start_import(new_gallery(T, customer=cust_b), root_a / "ShootX", tok=T)[0] in (400, 403), "studio B can't import studio A's folder")
c, j = import_and_wait(new_gallery(T, customer=cust_b), root_b / "ShootX", tok=T)
ok(c == 202 and j and j["status"] == "Completed", "studio B's own folder with the same names imports independently", (c, j))

# One unreadable file: the rest are imported and the job says it wasn't fully successful.
g5 = new_gallery()
c, j = import_and_wait(g5, root_a / "ShootZ")
ok(c == 202 and j and j["status"] == "CompletedWithErrors" and j["failedCount"] == 1 and len(gallery_photos(g5)) == 1,
   "partial import: 1 good photo imported, the broken one reported, not 'Completed'", (c, j))

# ============================================================================================ PREVIEW CLEANUP
area("Preview cleanup (never-sent galleries)")
def iso(d):
    return d.strftime("%Y-%m-%dT%H:%M:%SZ")
now_utc = datetime.now(timezone.utc)
c, plan, _ = req("GET", f"/admin/photo-cleanup?galleryId={g2}", tok=A)
ok(c == 200 and not plan["eligible"] and any(x["galleryId"] == g2 and "Still being prepared" in x["reason"] for x in plan["skipped"]),
   "never-sent gallery within the retention period is kept", (c, plan))
c, plan, _ = req("GET", f"/admin/photo-cleanup?galleryId={g2}&asOf={iso(now_utc + timedelta(days=11))}", tok=A)
el = plan.get("eligible") or []
ok(c == 200 and len(el) == 1 and el[0]["rule"] == "NeverSent" and len(el[0]["files"]) == 6 and el[0]["bytes"] > 0,
   "never-sent gallery older than the retention period is listed (dry run: 3 previews + 3 thumbnails)", (c, plan))
c, plan, _ = req("GET", f"/admin/photo-cleanup?galleryId={gid}", tok=A)
ok(c == 200 and not plan["eligible"] and not plan["skipped"], "a gallery whose link was sent recently isn't touched by either rule", (c, plan))
ok(req("GET", "/admin/photo-cleanup", tok=Q)[0] == 403, "a studio owner can't see the cleanup plan")
ok(len(gallery_photos(g2)) == 3 and all(p.get("previewUrl") for p in gallery_photos(g2)), "the dry run deleted nothing")

c, run, _ = req("POST", f"/admin/photo-cleanup/run?galleryId={g2}&asOf={iso(now_utc + timedelta(days=11))}", tok=A)
ok(c == 200 and run["galleriesCleaned"] == 1 and run["filesDeleted"] == 6 and not run["galleriesWithFailures"], "cleanup removes the 6 preview files", (c, run))
c, g, _ = req("GET", f"/photo-galleries/{g2}", tok=Q)
ok(c == 200 and g.get("previewsPurged") is True and g["counts"]["total"] == 3, "photo records stay; the gallery shows previews were removed", (c, g.get("counts")))
c, run2, _ = req("POST", f"/admin/photo-cleanup/run?galleryId={g2}&asOf={iso(now_utc + timedelta(days=11))}", tok=A)
ok(c == 200 and run2["galleriesCleaned"] == 0 and run2["filesDeleted"] == 0 and not run2["failures"], "running it again is harmless", (c, run2))
ok(all((root_a / rel).exists() for rel in ["ShootX/Candid/IMG_0001.jpg", "ShootX/Candid/IMG_0002.jpg", "ShootX/Traditional/IMG_0001.jpg"]),
   "the original photos are untouched")

# Selections survive: the customer's picks in the earlier gallery after its previews are removed.
c, run, _ = req("POST", f"/admin/photo-cleanup/run?galleryId={gid}&asOf={iso(now_utc + timedelta(days=60))}", tok=A)
ok(c == 200 and run["galleriesCleaned"] == 1, "expired-link gallery cleaned", (c, run))
c, sel, _ = req("GET", f"/photo-galleries/{gid}/device-photos/selection", tok=Q)
c2, xm2, _ = req("GET", f"/photo-galleries/{gid}/selection-export", tok=Q)
ok(c == 200 and len(sel) == 2 and c2 == 200 and xm2["selectedCount"] == 2, "selections and the Normal / Big Size export list remain after cleanup", (c, sel, c2))
c, b, _ = upload("CI Wedding", "Candid/IMG_0001.jpg")
rebuilt = next((p for p in gallery_photos(gid) if p["fileName"] == "IMG_0001.jpg"), {})
ok(c == 200 and b.get("outcome") == "PreviewRebuilt" and rebuilt.get("previewUrl"), "re-adding a photo from the computer after cleanup really restores its preview", (c, b, rebuilt))

# A file that can't be deleted (Windows: a file held open can't be removed) - reported, retried next run.
storage_root = os.environ.get("STORAGE_ROOT")
if os.name == "nt" and storage_root:
    g6 = new_gallery()
    import_and_wait(g6, root_a / "ShootW", anyway=True)
    key = gallery_photos(g6)[0]["previewUrl"].split("/media/", 1)[1].split("?")[0]
    held = open(Path(storage_root) / key, "rb")
    c, run, _ = req("POST", f"/admin/photo-cleanup/run?galleryId={g6}&asOf={iso(now_utc + timedelta(days=11))}", tok=A)
    ok(c == 200 and run["galleriesWithFailures"] == [g6] and run["galleriesCleaned"] == 0 and run["failures"],
       "a file that can't be deleted is reported and the gallery isn't marked cleaned", (c, run))
    held.close()
    c, run, _ = req("POST", f"/admin/photo-cleanup/run?galleryId={g6}&asOf={iso(now_utc + timedelta(days=11))}", tok=A)
    ok(c == 200 and run["galleriesCleaned"] == 1 and not run["failures"], "the next run finishes the job", (c, run))
else:
    print("  skip  cleanup-failure check needs Windows and STORAGE_ROOT (a file held open can't be deleted there)")

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
