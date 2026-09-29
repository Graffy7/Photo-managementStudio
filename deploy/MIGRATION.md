# Moving Studio OS to another server

Studio OS is three separate parts. Each one can move on its own:

```text
                  STUDIO OS
                      │
      ┌───────────────┼────────────────┐
      ▼               ▼                ▼
 Application      SQL Server       Photo storage
 (code: GitHub)   (database)       (previews, thumbnails, logos, signatures)
                                        │
                     keys like "photo-gallery/12/abc.webp" point here
```

| Part | Where it lives | How to back it up | What tells the app where it is |
|---|---|---|---|
| Application | GitHub (`main`) | nothing to do - it's in GitHub | - |
| Database | SQL Server | `.bak` file (`deploy\backup.ps1`) | `ConnectionStrings__DefaultConnection` |
| Photo storage | a folder, e.g. `C:\StudioOSData\storage` | copy the folder (`deploy\backup.ps1`) | `Storage__Local__RootPath` |
| Settings & secrets | environment variables on the server | write them down somewhere safe (password manager) | - |

**Original photos are not in any of these.** They stay on each studio's own computer (or in the
studio's own folder), exactly where the photographer keeps them. Studio OS only stores small
previews, and the database only stores *where* things are (keys), never server addresses.

---

## Server A → Server B, step by step

1. **Stop changes on Server A** (optional but safest): in IIS stop the `StudioOS-API` site, so no
   one saves anything while you copy.
2. **Back up the database** on Server A:
   `powershell -ExecutionPolicy Bypass -File deploy\backup.ps1 -Destination D:\move`
   → gives `D:\move\database\StudioManagementDb-<date>.bak` **and** `D:\move\storage\` (the photos).
3. **Move the files** (`D:\move`) to Server B (copy over the network, or upload/download).
4. **Set up Server B** with `deploy/SERVER-SETUP.md` parts 2, 3, 5, 6, 7, 8:
   install the software, create the folders, set the environment variables, make the IIS sites,
   HTTPS, and the GitHub runner.
5. **Restore the database** on Server B (SERVER-SETUP part 4, the `RESTORE DATABASE` command,
   using the `.bak` from step 2).
6. **Put the photos in place**: copy everything in `D:\move\storage\` into the storage folder
   (`C:\StudioOSData\storage`, or whatever `Storage__Local__RootPath` says).
7. **Deploy the application**: GitHub → Actions → CI → **Run workflow**.
   (Remove the old runner from Server A in GitHub → Settings → Actions → Runners.)
8. **Point the domain at Server B**: change the `app` and `api` DNS A records to Server B's IP.
   Keep Server A running until the change has spread (a few hours), then switch it off.
9. **Check**: sign in, open an event's photos, open a customer link.

Nothing in the code changes. Customers' links keep working because they use your domain,
not the server's address.

---

## Moving only one part

**Bigger or faster server (same provider):** usually just resize the VPS - nothing changes.
Otherwise follow the full steps above.

**Database to its own server** (e.g. a managed SQL Server):
1. Back up (`deploy\backup.ps1`) and restore the `.bak` on the new SQL Server.
2. Change one setting on the application server, then run `iisreset`:
   `ConnectionStrings__DefaultConnection = Server=<new server>;Database=StudioManagementDb;User Id=<user>;Password=<password>;TrustServerCertificate=True`

**Photo storage to another disk or folder:**
1. Copy the storage folder to the new place (`robocopy <old> <new> /MIR`).
2. Change `Storage__Local__RootPath` to the new folder, give `IIS APPPOOL\StudioOS-API` modify
   rights on it, run `iisreset`.

**Photo storage to cloud / object storage (S3, Cloudflare R2, Azure Blob…):**
the app talks to storage only through `IFileStorage`, and the database holds keys like
`photo-gallery/12/abc.webp`. Adding a cloud provider means one new class that implements
`IFileStorage` plus one line in `Program.cs` - the rest of the app doesn't change. Upload the
storage folder to the bucket with the same folder structure and set `Storage__Provider` to the
new provider. (Not built yet - ask when you need it.)

---

## What is never tied to one server

- No server paths, IP addresses, passwords or photo folders are written in the C# code.
- The database connection comes only from `ConnectionStrings__DefaultConnection`.
- File locations come only from the `Storage` settings; the database stores keys, not addresses.
- Photo links are made fresh for every page, signed and time-limited
  (`/media/<key>?exp=…&sig=…`), so they don't depend on a server name and can't be shared forever.
- Secrets live only in the server's environment variables - never in Git.
