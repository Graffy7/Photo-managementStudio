# Working on two computers

Code moves through **GitHub**. Everything else — the **database**, **uploaded files**, **original
photos** and **secrets** — moves in a private **transfer folder** that you carry on a USB drive or keep
in a private cloud folder (OneDrive / Google Drive). The GitHub repository is **public**: never put the
transfer folder, a `.bak` file or `secrets.json` in it (`.gitignore` blocks the usual names).

```
StudioOS-transfer-<date>\
  database\        StudioManagementDb_<date>.bak  + row-counts.csv   (all tables, keys, indexes, records)
  uploads\         gallery previews/thumbnails, logos, signatures     (wwwroot\uploads)
  original-photos\ G_photoshoot, G_Krish                              (originals the galleries were imported from)
  secrets\         secrets.json + install-secrets.ps1                 (JWT key, Razorpay keys, first-run admin)
```

## The one rule

**Only one computer has the "live" database at a time.** Code changes from two computers can be
merged by Git; database records cannot. So:

1. Before you stop on a computer: push the code **and** take a database backup.
2. When you start on the other computer: pull the code **and** restore that backup.
3. Don't add or change records on the computer you left until you bring the newer backup back.

If you ever do change data on both, nothing is lost — every restore first backs up the database it
replaces (`*_before-restore_*.bak`) — but you will have to choose which copy to keep.

---

## A. Leaving a computer (do this every time)

From the project folder (e.g. `F:\MSproject`), with your USB drive as `E:` (use any folder):

```powershell
# 1. Code: commit and push everything
git status                       # nothing should be listed as modified/untracked that you want to keep
git add -A
git commit -m "Work from <this computer> <date>"
git push

# 2. Database: verified copy-only backup (the live database is only read)
powershell -ExecutionPolicy Bypass -File tools\transfer\backup-database.ps1 -OutDir E:\StudioOS-transfer\database

# 3. Uploaded files (adds/updates only, never deletes)
powershell -ExecutionPolicy Bypass -File tools\transfer\sync-uploads.ps1 -To E:\StudioOS-transfer\uploads

# 4. New original photos, if you imported any from a new folder: copy that folder into
#    E:\StudioOS-transfer\original-photos\
```

The **first** transfer folder (31 Oct 2026) was prepared on the original laptop at
`F:\StudioOS-transfer-2026-10-31` — copy that whole folder to the USB drive / private cloud folder.

## B. First time on the other computer

1. Install: Git, .NET 10 SDK, `dotnet tool install --global dotnet-ef`, Node.js 22, and
   **SQL Server 2022 or newer** (Developer or Express edition) — older versions can't read the backup.
2. Clone the code:
   ```powershell
   git clone https://github.com/Graffy7/Photo-managementStudio.git F:\MSproject
   cd F:\MSproject
   ```
   (Any folder works; `F:\MSproject` keeps the paths the same as the laptop.)
3. Copy the transfer folder from the USB drive to the computer, e.g. `D:\StudioOS-transfer`.

### 2. Restore the database

```powershell
powershell -ExecutionPolicy Bypass -File tools\transfer\restore-database.ps1 -BakFile D:\StudioOS-transfer\database\StudioManagementDb_2026-10-31.bak
```

* It checks the file first, then restores **all tables, relationships, indexes and records** as
  `StudioManagementDb`.
* It prints the number of tables and rows — compare with `row-counts.csv` (31 Oct 2026: **45 tables,
  9,999 rows**).
* If a `StudioManagementDb` already exists there it **stops without changing anything**. Add
  `-Replace` only when you mean to replace it; it then backs up the existing one first.
* SQL Server Express or a named instance: add `-Server localhost\SQLEXPRESS` and use the same
  `Server=` value in `backend\StudioManagement.API\appsettings.Development.json` (don't commit that
  change if the laptop uses `localhost` — or keep the instance name the same on both).

### 3. Secrets

```powershell
powershell -ExecutionPolicy Bypass -File D:\StudioOS-transfer\secrets\install-secrets.ps1
```

### 4. Uploaded files and original photos

```powershell
powershell -ExecutionPolicy Bypass -File tools\transfer\sync-uploads.ps1 -From D:\StudioOS-transfer\uploads
```

Gallery previews and logos then show exactly as on the laptop. The database remembers where each
gallery's **original** photos were imported from (`G:\photoshoot`, `G:\Krish`). Previews, customer
selection and downloads of previews work without them; to **copy original photos for a selection** on
this computer, put the folders from `original-photos\` back at the same paths (e.g. a `G:` drive, or
any drive mapped as `G:`).

### 5. Run

```powershell
cd backend
dotnet ef database update --project StudioManagement.Data --startup-project StudioManagement.API   # only needed if new migrations were pulled; safe to run anytime
dotnet run --project StudioManagement.API --launch-profile http
```

Second terminal:

```powershell
cd frontend
npm install
npx expo start --web
```

Open http://localhost:8081 and sign in with your usual account (the users come with the database).

## C. Returning to the original laptop

1. **Before pulling**, check the laptop has nothing unsaved:
   ```powershell
   cd F:\MSproject
   git status
   ```
   * Nothing listed → go on.
   * Changes you want to keep → `git add -A` and `git commit -m "Laptop work"` first.
   * Changes you're not sure about → `git stash` (bring them back later with `git stash pop`).
2. Get the weekend's code:
   ```powershell
   git pull
   ```
   If Git reports a conflict, stop and resolve it (or ask Claude) — don't use `--force` or
   `reset --hard`.
3. Bring the weekend's **database** across (the laptop's current database is backed up automatically
   before it is replaced):
   ```powershell
   powershell -ExecutionPolicy Bypass -File tools\transfer\restore-database.ps1 -BakFile E:\StudioOS-transfer\database\StudioManagementDb_<weekend date>.bak -Replace
   ```
4. Bring the weekend's **uploaded files**:
   ```powershell
   powershell -ExecutionPolicy Bypass -File tools\transfer\sync-uploads.ps1 -From E:\StudioOS-transfer\uploads
   ```
5. Apply any new migrations and run (section B.5).

## Checklist

| Step | Leaving | Arriving |
|---|---|---|
| Code | `git add -A`, `git commit`, `git push` | `git status` clean, then `git pull` |
| Database | `backup-database.ps1` | `restore-database.ps1` (`-Replace` if one exists) |
| Uploaded files | `sync-uploads.ps1 -To` | `sync-uploads.ps1 -From` |
| Original photos | copy new folders | put them back at the same paths |
| Secrets | (only once) | `install-secrets.ps1` (only once) |
| Migrations | — | `dotnet ef database update` |

## Notes

* Claude Code's conversation history and its notes are stored on each computer, not in your Claude
  account — the other computer starts a fresh conversation. Point it at this file and the README.
* `.gitignore` keeps `bin/`, `obj/`, `node_modules/`, logs, uploads, backups and secrets out of Git.
  Everything else in the repository is the complete source.
