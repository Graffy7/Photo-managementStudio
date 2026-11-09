# Project Handover — Studio OS

## ▶ Latest update — 9 Nov 2026, second computer (read this first)

Work done 7–9 Nov 2026 on the second computer (code folder `E:\project\MSproject`, SQL Server
**Express** `localhost\SQLEXPRESS`). Sections 1–13 further down are the original 6 Nov handover and
still apply.

### Completed on this computer
* **UI** (already pushed earlier): Midnight Blue theme, dashboard redesign, enquiry outcomes, calendar
  links, shared Yes/No dialogs, PDF preview pop-ups, compact forms, Day board crew rows, sidebar hover,
  "created" pop-up, detail-page icons.
* **In this commit:**
  * **Sign-out asks Yes/No** (`frontend/src/ui/SignOutConfirm.tsx`, used everywhere Sign out appears).
  * **Photo delivery page** cleaned up (stats strip, status rows, Yes/No before revoke/lock/regenerate/remove).
  * **Accessibility**: sidebar links and Super Admin module switches have proper names (`Toggle` gets
    `accessibilityLabel`).
  * **Bug fix – negative "Outstanding" on the dashboard.** It was *accepted quotations − payments*, so an
    event with a price and payments but no accepted quotation in the range went negative. Now it is
    each non-cancelled event's price minus its payments, never below 0 — the same rule as Reports.
    (`StudioDashboardService.cs`, `StudioDashboardRepository.cs`)
  * **Bug fix – cancelled events counted as owed** in the profit report / detailed report PDF (a
    cancelled ₹15,000 event showed "Customer owes ₹15,000"). (`ProfitReportRepository.cs`, `ProfitReportService.cs`)
  * **WhatsApp Cloud API backend** (Meta setup itself not finished — see "Next task"):
    webhook `api/webhooks/whatsapp` (checks Meta's `X-Hub-Signature-256`), Super Admin endpoints
    `api/admin/whatsapp/status | test-message | messages/{id}`, sender returns Meta's message id and
    error code, Graph API version now `v25.0`. Settings: `WhatsApp:*` in `appsettings.json` (empty);
    real values go in **user-secrets only**.
  * **Playwright end-to-end tests** in `e2e/` — **120 tests, all passing** (9 Nov). Own QA database
    `StudioOS_QA` (recreated each run; the real database is never touched), own API on :5238 and web
    build on :8082, fake Meta server for WhatsApp. Run: `cd e2e; npm install; npx playwright install chromium;
    npm run qa:build-web; npm test`. Report: `npx playwright show-report`.

### Database
* No new migrations (latest is still `20261021173655_EventStatusOngoing`).
* Data **did** change on this computer (new customers, a payment, a quotation, gallery 54 with 128
  photos), so a new backup was made:
  `StudioOS-transfer-2026-11-06\database\StudioManagementDb_2026-11-09_182740.bak` (25.9 MB,
  COPY_ONLY, checksummed, `RESTORE VERIFYONLY` passed; 46 tables, 10,220 rows — see the
  `.row-counts.csv` beside it). SHA256 `728F601CBDDF547DB5ED89ED75D3817B865E860E1BFCA36438617DB5B90A3F57`.
  The older backups in that folder were left untouched.
* Uploads synced into `StudioOS-transfer-2026-11-06\uploads` (661 files).
* Gallery 54's originals came from `E:\photos` on this computer → copied to
  `StudioOS-transfer-2026-11-06\original-photos\E_photos` (162 files, 1.44 GB).

### Back on the main computer — do this first
1. Copy the whole `StudioOS-transfer-2026-11-06` folder from the external drive (it now has the 9 Nov backup,
   uploads and `original-photos\E_photos`).
2. `git status` (clean) → `git pull` (never `--force`).
3. Restore the 9 Nov database over the old one (the old one is backed up automatically first):
   `powershell -ExecutionPolicy Bypass -File tools\transfer\restore-database.ps1 -BakFile <transfer>\database\StudioManagementDb_2026-11-09_182740.bak -Replace`
   → check the totals against `StudioManagementDb_2026-11-09_182740.row-counts.csv`.
4. Uploads: `powershell -ExecutionPolicy Bypass -File tools\transfer\sync-uploads.ps1 -From <transfer>\uploads`
5. Optional (only to copy gallery 54's originals for a selection): put `original-photos\E_photos` at `E:\photos`.
6. If your SQL Server there is not the default instance, keep your own `Server=` in
   `appsettings.Development.json` (that file's local change is deliberately **not** committed).
7. Start the API and app (section 11.8) and check the dashboard's Outstanding is no longer negative.

### Exact next task: finish the Meta WhatsApp Cloud API setup
Status: Facebook account signed in; business portfolio **Studio OS** (id 1156444656876754) has no apps or
WhatsApp accounts yet. **Meta developer registration is stuck at "Verify account"**: Meta's SMS never
reached +91 8610692101, and Meta showed a "Slow down" limit after many attempts.
Agreed details: app **Graffy Studio Management** (type Business, WhatsApp use case, under Studio OS),
sender **+91 8610692101** (must NOT have the WhatsApp app installed), display name **Graffy Studio**,
test recipient **+91 7448312831** (has WhatsApp).
1. Check the 8610692101 SIM can receive an ordinary SMS (a new/swapped SIM in India blocks SMS for 24 h).
2. developers.facebook.com → Get Started → **one** "Send SMS Again" → type the code → Continue.
3. Create the app, add the number (code by SMS or voice), create a permanent token via a Studio OS
   system user (`whatsapp_business_messaging`, `whatsapp_business_management`).
4. Store values with `dotnet user-secrets set` in `backend/StudioManagement.API`: `WhatsApp:Provider`=`CloudApi`,
   `WhatsApp:PhoneNumberId`, `WhatsApp:BusinessAccountId`, `WhatsApp:AccessToken`, `WhatsApp:AppSecret`,
   `WhatsApp:WebhookVerifyToken` (never in appsettings, the frontend or GitHub).
5. Webhook for testing: expose **only a QA-database API instance** (never the real-database API on :5237),
   e.g. API on :5239 against `StudioOS_QA` + `ssh -R 80:localhost:5239 nokey@localhost.run`; callback
   `https://<tunnel>/api/webhooks/whatsapp`. Production needs the deployed HTTPS address instead.
6. Send `hello_world` with `POST /api/admin/whatsapp/test-message` (Super Admin) and confirm the
   delivered/read receipts at `GET /api/admin/whatsapp/messages/{id}`.

### Known issues / risks
* `dotnet build` shows 36 NuGet warnings (NU1902/NU1903 — packages with known vulnerabilities). Not
  caused by this work; review package updates separately.
* Dashboard "Expected Profit" is still *accepted quotations − expenses* (can mislead like Outstanding did).
* Report PDFs: letter pairs like "ft"/"fk" are lost when copying/searching text (font ligatures); the
  printed totals are correct.
* Free tunnels (localhost.run) drop when idle and change address.

---

Prepared **6 Nov 2026** on the original laptop, before switching to another computer for a week.
Everything below was checked against the real project at that moment.

> **The GitHub repository is public.** It holds source code only. The database, uploaded files,
> original photos, secrets and sign-in details are in a **private transfer folder**
> (`F:\StudioOS-transfer-2026-11-06`) that goes on your external drive — never in GitHub.

---

## 1. Project

**Studio OS** — a multi-studio management app for photography studios: enquiries, customers,
events, calendar and day board, quotations (PDF + WhatsApp), payments and expenses, workers and
services, photo delivery with a private customer photo-selection link, reports (charts + PDF),
notifications, subscriptions, and a Super Admin console.

## 2. Technology

| Part | Technology | Folder |
|---|---|---|
| API | .NET 10 (SDK 10.0.201), ASP.NET Core, EF Core, QuestPDF | `backend/` |
| Database | SQL Server **2022** (Developer), database `StudioManagementDb`, Windows sign-in | — |
| App | Expo SDK 57 / React Native 0.86 / React 19, runs on web (also Android/iOS) | `frontend/` |
| Node | 22.x (npm 10) | — |
| API tests | Python, against a throwaway database | `tests/api/test_api.py` |
| CI | GitHub Actions (build + API tests) | `.github/workflows/ci.yml` |

Local addresses: API **http://localhost:5237** (health: `/health`), app **http://localhost:8081**.

## 3. Architecture

```
frontend (Expo web, :8081)  ──HTTP/JSON──>  backend API (:5237)  ──EF Core──>  SQL Server (StudioManagementDb)
                                                │
                                                └── files: backend/StudioManagement.API/wwwroot/uploads
                                                    (gallery previews/thumbnails, logos, signatures)
```

* **backend/StudioManagement.API** — controllers, auth (JWT), background jobs (event statuses,
  reminders, photo import/copy, gallery cleanup, usage).
* **backend/StudioManagement.Business** — services, DTOs, validation, PDF generation (quotations,
  reports + charts in `Reports/ChartSvg.cs`).
* **backend/StudioManagement.Data** — EF Core entities, repositories, migrations
  (latest: `20261021173655_EventStatusOngoing`).
* **frontend/src** — `screens/` (one per module), `navigation/` (sidebar, stacks), `ui/` (design
  system: `theme.ts` tokens, Button, DataList, FilterChips, RowAction…), `components/`, `api/`.
* Every studio's data is isolated by StudioId on the server.

## 4. Database

* SQL Server 2022, database `StudioManagementDb`, **45 tables, 71 relationships, 10,017 records**
  (6 Nov 2026).
* Connection (local): `backend/StudioManagement.API/appsettings.Development.json` →
  `Server=localhost;Database=StudioManagementDb;Trusted_Connection=True;TrustServerCertificate=True`
  (Windows sign-in, no database password).
* **Backup made for this handover:**
  `F:\StudioOS-transfer-2026-11-06\database\StudioManagementDb_2026-11-06_0847.bak` (3.2 MB,
  COPY_ONLY, checksummed). **Verified** by restoring it under another name: all 45 tables and
  10,017 records identical to the live database (the check copy was then removed).
  SHA256 `CAB627479E6871B642C8859AA7AE7A5C74C14223D8C461D7CFA9366A3AFF584F`.
* Back up / restore with the scripts in `tools/transfer/` (they never overwrite a database unless
  you add `-Replace`, and then they back it up first):

```powershell
powershell -ExecutionPolicy Bypass -File tools\transfer\backup-database.ps1 -OutDir E:\StudioOS-transfer\database
powershell -ExecutionPolicy Bypass -File tools\transfer\restore-database.ps1 -BakFile E:\...\StudioManagementDb_<date>.bak            # new computer
powershell -ExecutionPolicy Bypass -File tools\transfer\restore-database.ps1 -BakFile E:\...\StudioManagementDb_<date>.bak -Replace   # replace an existing one
```

The other computer needs **SQL Server 2022 or newer** — older versions cannot read the backup.

## 5. Files that are not in GitHub

| What | Where on this laptop | In the transfer folder |
|---|---|---|
| Gallery previews, thumbnails, logos, signatures (405 files, 15 MB) | `backend\StudioManagement.API\wwwroot\uploads` | `uploads\` |
| Original photos the galleries were imported from (485 files, 2 GB) | `G:\photoshoot`, `G:\Krish` | `original-photos\` |
| Secrets: JWT key, Razorpay keys, first-run admin (.NET user secrets) | `%APPDATA%\Microsoft\UserSecrets\d5a945ed-…\secrets.json` | `secrets\secrets.json` + `install-secrets.ps1` |
| Local sign-in details for the test accounts | `F:\MSproject-reports\local-logins.txt` | `secrets\local-logins.txt` |

## 6. GitHub

* Repository: **https://github.com/Graffy7/Photo-managementStudio** (public), branch **`main`**.
* All work is committed. Before this handover, 3 commits were waiting to be pushed (warm theme,
  sign-in page, Premium Dark theme); they are pushed together with this document.
* A local-only stash `stash@{0}` (from the early "event edit conflict check" work) exists on this
  laptop and is **not** in GitHub. It is old and not needed; leave it or delete it later.

## 7. Latest completed features (newest first)

1. **Premium Dark Photography theme** (charcoal + lavender) as the default across all modules;
   Inter font; 235px sidebar with lavender active state; subtle hover motion (respects reduced
   motion); icon row actions on Enquiries, Events, Customers, Workers, Services, Expenses; gallery
   photos zoom 1.03 on hover.
2. **Sign-in page**: full-screen sunset/mountain scene (drawn in code), "Welcome Back" + form.
   `EXPO_PUBLIC_LOGIN_PHOTO_URL` can show a real studio photo instead.
3. **Events list**: colour-coded event types (Wedding, Reception, Photoshoot, Birthday…), Team
   column with roles, weekday + time, Calendar view button.
4. **Two-computer docs and scripts**: `docs/SWITCHING-COMPUTERS.md`, `tools/transfer/*.ps1`.
5. **Payments**: "Pending" filter shows payments whose event still has a balance.
6. **Reports**: visual Business Overview (4 cards, 6 charts incl. busy-days heatmap), View details,
   one-page chart PDF (+ optional detail pages).
7. **Events**: status follows the date (Upcoming → Ongoing → Completed; Cancelled by hand);
   payment amounts editable in the event form.
8. Quotations: WhatsApp share; PDF named after the customer.

## 8. Current unfinished task

The **Premium Dark redesign is done and checked page by page** (no console errors, type check and
build pass). Not yet done from that brief — optional follow-ups:

* Quotations list still uses text buttons (PDF / WhatsApp / Change status) instead of icon actions.
* Tablet keeps the bottom navigation (no collapsible sidebar yet).
* Dashboard was restyled but not restructured (no "recent activity" panel).
* Icons are Ionicons (outline); Lucide was not added.

## 9. Exact next steps

1. Restore/sync on the other computer (section 11), start API + app, sign in, check the dashboard.
2. Pick up the follow-ups in section 8 if wanted (start with Quotations icon actions —
   `frontend/src/screens/studioOwner/QuotationListScreen.tsx`, reuse `frontend/src/ui/RowAction.tsx`).
3. Before leaving that computer: commit + push, then back up the database and uploads (section 12).

## 10. Errors and pending issues

* **The API stops when its window closes** (sleep/restart) → the app then shows "Unable to sign in".
  Fix: start it again (`dotnet run --project StudioManagement.API --launch-profile http`).
  An auto-start (Windows scheduled task) was offered but not set up.
* **Never-sent gallery cleanup is in DryRun** (`PhotoGallery:UnsentCleanupMode`) on purpose; real
  deletion waits for your approval.
* The test studio "UI Flow Test Studio" has its photo folder pointing at an old temporary folder
  on this laptop; its sample galleries' originals won't exist elsewhere (previews still work).
* The database contains a helper table `zz_EventStatusBackup_20261021` (old event statuses kept
  as a safety copy); harmless.
* No known build or type errors (checked 6 Nov 2026).

## 11. Continuing on another computer

1. Install: Git, **.NET 10 SDK**, `dotnet tool install --global dotnet-ef`, **Node 22**,
   **SQL Server 2022 (Developer or Express)** + SQL tools (sqlcmd).
2. Copy `StudioOS-transfer-2026-11-06` from the external drive to the computer (e.g. `D:\`).
   Check the backup: `Get-FileHash <bak> -Algorithm SHA256` matches section 4.
3. Get the code:
   ```powershell
   git clone https://github.com/Graffy7/Photo-managementStudio.git F:\MSproject
   cd F:\MSproject
   ```
4. Database: `powershell -ExecutionPolicy Bypass -File tools\transfer\restore-database.ps1 -BakFile D:\StudioOS-transfer-2026-11-06\database\StudioManagementDb_2026-11-06_0847.bak`
   (expect 45 tables, 10,017 rows). SQL Express or a named instance: add `-Server localhost\SQLEXPRESS`
   and use the same `Server=` in `appsettings.Development.json`.
5. Secrets: `powershell -ExecutionPolicy Bypass -File D:\StudioOS-transfer-2026-11-06\secrets\install-secrets.ps1`
6. Uploads: `powershell -ExecutionPolicy Bypass -File tools\transfer\sync-uploads.ps1 -From D:\StudioOS-transfer-2026-11-06\uploads`
7. Original photos (only needed to copy originals for a selection): put `original-photos\G_photoshoot`
   and `G_Krish` back at `G:\photoshoot` and `G:\Krish`.
8. Run:
   ```powershell
   cd backend; dotnet run --project StudioManagement.API --launch-profile http     # API :5237
   cd frontend; npm install; npx expo start --web                                    # app :8081
   ```
9. Sign in with the details in `secrets\local-logins.txt`.
10. Tell Claude on that computer: *"Read PROJECT_HANDOVER.md and docs/SWITCHING-COMPUTERS.md."*
    Claude's conversation history stays on each computer, not in your Claude account.

### Before leaving the other computer

```powershell
git add -A; git commit -m "Work from other computer"; git push
powershell -ExecutionPolicy Bypass -File tools\transfer\backup-database.ps1 -OutDir E:\StudioOS-transfer-<date>\database
powershell -ExecutionPolicy Bypass -File tools\transfer\sync-uploads.ps1 -To E:\StudioOS-transfer-<date>\uploads
```

**Only one computer holds the live database at a time.** Don't add records on this laptop while
you work on the other one.

## 12. Returning to this laptop next week

1. `cd F:\MSproject` → `git status` (should be clean) → `git pull`.
   Never use `--force` or `reset --hard`; if Git reports a conflict, stop and resolve it.
2. Bring the other computer's database across (this laptop's current one is backed up first
   automatically):
   `powershell -ExecutionPolicy Bypass -File tools\transfer\restore-database.ps1 -BakFile E:\StudioOS-transfer-<date>\database\StudioManagementDb_<date>.bak -Replace`
3. Uploads: `powershell -ExecutionPolicy Bypass -File tools\transfer\sync-uploads.ps1 -From E:\StudioOS-transfer-<date>\uploads`
4. If new migrations came with the pull:
   `cd backend; dotnet ef database update --project StudioManagement.Data --startup-project StudioManagement.API`
5. Start the API and app (section 11.8) and check.

## 13. Important files and folders

| Path | What |
|---|---|
| `frontend/src/ui/theme.ts` | All colours, type, spacing, shadows, motion (the design system) |
| `frontend/src/ui/` | Shared components: Button, DataList (tables), FilterChips, RowAction, PageHeader… |
| `frontend/src/navigation/Sidebar.tsx`, `RootNavigator.tsx` | Navigation |
| `frontend/src/screens/studioOwner/` | One screen per module |
| `frontend/src/screens/public/` | Customer photo-selection page |
| `frontend/.env` | `EXPO_PUBLIC_API_BASE_URL=http://localhost:5237` |
| `backend/StudioManagement.API/appsettings*.json` | Settings (no secrets) |
| `backend/StudioManagement.Business/Reports/` | Analytics, report PDF and chart drawing |
| `backend/StudioManagement.Data/Migrations/` | Database schema history |
| `tools/transfer/` | backup-database / restore-database / sync-uploads |
| `docs/SWITCHING-COMPUTERS.md` | Full two-computer guide |
| `docs/secrets.example.json` | Names of the secrets (no values) |
| `tests/api/test_api.py` | API test suite (CI runs it) |
