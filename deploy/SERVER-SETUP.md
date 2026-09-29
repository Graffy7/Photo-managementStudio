# Studio OS – server setup and automatic deploys

This sets up **one Windows server** (a VPS) to run Studio OS. Once it's done, every push to `main`
that passes CI installs itself on the server automatically.

- Do the setup once, in order. Each part says what to click or type.
- Replace `example.com` with your real domain everywhere.
- **Never paste passwords or keys into chat, code or GitHub.** They only go on the server (part 5).

What you end up with:

| Address | What it is | Folder on the server |
|---|---|---|
| `https://app.example.com` | the website studios and customers open | `C:\StudioOS\web` |
| `https://api.example.com` | the API the website talks to | `C:\StudioOS\api` |

---

## 1. Buy and point the domain

1. Buy the domain (GoDaddy, Hostinger, Namecheap…).
2. In the domain's **DNS** settings add two **A records**, both pointing to your VPS's IP address:
   - `app` → your VPS IP
   - `api` → your VPS IP
3. Wait until they work (usually minutes, up to a few hours). Check from your PC:
   `nslookup app.example.com` should show the VPS IP.

## 2. Install the software (Remote Desktop into the VPS)

Run **PowerShell as Administrator** on the VPS:

```powershell
# IIS with WebSockets (live updates) and the pieces ASP.NET Core needs
Install-WindowsFeature Web-Server, Web-WebSockets, Web-Static-Content, Web-Http-Redirect -IncludeManagementTools
```

Then download and install (all free):

1. **IIS URL Rewrite** – https://www.iis.net/downloads/microsoft/url-rewrite
2. **.NET 10 SDK** (includes the Hosting Bundle's runtime; the deploy builds on the server) –
   https://dotnet.microsoft.com/download/dotnet/10.0 → install the **SDK**, then also the
   **ASP.NET Core Runtime – Hosting Bundle** from the same page.
3. **SQL Server 2022 Express** – https://www.microsoft.com/sql-server/sql-server-downloads → Express → Basic.
4. **SQL command-line tools (sqlcmd)** – https://learn.microsoft.com/sql/tools/sqlcmd/sqlcmd-utility
5. **Node.js 22 LTS** – https://nodejs.org
6. **Git** – https://git-scm.com/download/win

Restart the VPS after installing, so IIS picks up the Hosting Bundle.

## 3. Folders

```powershell
New-Item -ItemType Directory -Force C:\StudioOS\api, C:\StudioOS\web, C:\StudioOS\backups, C:\StudioOS\releases
# SQL Server writes the database backups itself, so it needs write access to the backups folder
icacls C:\StudioOS\backups /grant "NT Service\MSSQL`$SQLEXPRESS:(OI)(CI)M"
```

## 4. Move your database

On **your current PC**, make a fresh backup (SQL Server Management Studio → right-click
`StudioManagementDb` → Tasks → Back Up, or):

```powershell
sqlcmd -S localhost -E -Q "BACKUP DATABASE StudioManagementDb TO DISK='C:\SqlBackupShare\StudioManagementDb_for_server.bak' WITH COPY_ONLY, INIT"
```

Copy the `.bak` file to the VPS (e.g. into `C:\StudioOS\backups`), then on the VPS:

```powershell
sqlcmd -S localhost\SQLEXPRESS -E -Q "RESTORE FILELISTONLY FROM DISK='C:\StudioOS\backups\StudioManagementDb_for_server.bak'"
# Use the two logical names it prints (usually StudioManagementDb and StudioManagementDb_log):
sqlcmd -S localhost\SQLEXPRESS -E -Q "RESTORE DATABASE StudioManagementDb FROM DISK='C:\StudioOS\backups\StudioManagementDb_for_server.bak' WITH MOVE 'StudioManagementDb' TO 'C:\Program Files\Microsoft SQL Server\MSSQL16.SQLEXPRESS\MSSQL\DATA\StudioManagementDb.mdf', MOVE 'StudioManagementDb_log' TO 'C:\Program Files\Microsoft SQL Server\MSSQL16.SQLEXPRESS\MSSQL\DATA\StudioManagementDb_log.ldf'"
```

Give the website's IIS account access to the database (done after part 6 creates the app pool,
come back to this):

```powershell
sqlcmd -S localhost\SQLEXPRESS -E -Q "CREATE LOGIN [IIS APPPOOL\StudioOS-API] FROM WINDOWS; USE StudioManagementDb; CREATE USER [IIS APPPOOL\StudioOS-API] FOR LOGIN [IIS APPPOOL\StudioOS-API]; ALTER ROLE db_owner ADD MEMBER [IIS APPPOOL\StudioOS-API];"
```

## 5. The API's settings and secrets (only on the server)

These are **machine environment variables** – the API reads them; they are never in GitHub.
Run in **PowerShell as Administrator**, replacing every `<...>`:

```powershell
function Set-Secret($name, $value) { [Environment]::SetEnvironmentVariable($name, $value, "Machine") }

Set-Secret ASPNETCORE_ENVIRONMENT "Production"
Set-Secret ConnectionStrings__DefaultConnection "Server=localhost\SQLEXPRESS;Database=StudioManagementDb;Trusted_Connection=True;TrustServerCertificate=True"
Set-Secret Database__MigrateOnStartup "true"          # new database changes apply themselves on deploy
Set-Secret Cors__AllowedOrigins__0 "https://app.example.com"

# Sign-in token key: a NEW long random value just for the server (this makes one for you)
$bytes = New-Object byte[] 64; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
Set-Secret Jwt__Key ([Convert]::ToBase64String($bytes))

# Super Admin phone for password-reset codes (optional)
Set-Secret PasswordReset__SuperAdminPhone "<your mobile>"

# Razorpay (live keys when you go live)
Set-Secret Payments__Razorpay__KeyId "<key id>"
Set-Secret Payments__Razorpay__KeySecret "<key secret>"
Set-Secret Payments__Razorpay__WebhookSecret "<webhook secret>"

# Email reset codes through Gmail (App Password, needs Google 2-Step Verification)
Set-Secret Email__Smtp__Host "smtp.gmail.com"
Set-Secret Email__Smtp__Port "587"
Set-Secret Email__Smtp__Username "<your gmail>"
Set-Secret Email__Smtp__Password "<gmail app password>"

# SMS reset codes: Twilio or Msg91 (leave out until you have the keys)
# Set-Secret Sms__Provider "Msg91"   ... plus that provider's keys

# WhatsApp owner messages (leave out until Meta approves the templates)
# Set-Secret WhatsApp__Provider "CloudApi"
# Set-Secret WhatsApp__PhoneNumberId "<id>"; Set-Secret WhatsApp__AccessToken "<token>"
# Set-Secret WhatsApp__FunctionDetailsTemplate "function_details"; Set-Secret WhatsApp__PaymentDetailsTemplate "payment_details"
```

> Changing the sign-in key signs everyone out once – normal on first launch.
> After changing any setting later, run `iisreset` so the API picks it up.

## 6. The two IIS websites

In **PowerShell as Administrator**:

```powershell
Import-Module WebAdministration
New-WebAppPool -Name "StudioOS-API"
Set-ItemProperty IIS:\AppPools\StudioOS-API -Name managedRuntimeVersion -Value ""
Set-ItemProperty IIS:\AppPools\StudioOS-API -Name startMode -Value "AlwaysRunning"   # background jobs keep running
Set-ItemProperty IIS:\AppPools\StudioOS-API -Name processModel.idleTimeout -Value "00:00:00"
New-Website -Name "StudioOS-API" -PhysicalPath C:\StudioOS\api -ApplicationPool "StudioOS-API" -HostHeader "api.example.com" -Port 80

New-WebAppPool -Name "StudioOS-Web"
New-Website -Name "StudioOS-Web" -PhysicalPath C:\StudioOS\web -ApplicationPool "StudioOS-Web" -HostHeader "app.example.com" -Port 80
```

Now go back and run the database-access command at the end of part 4.

## 7. HTTPS certificates (free)

1. Download **win-acme** – https://www.win-acme.com – and unzip it to `C:\win-acme`.
2. Run `C:\win-acme\wacs.exe` as Administrator → **N** (new certificate) → choose the IIS site
   `StudioOS-API` → accept. Repeat for `StudioOS-Web`.
3. win-acme adds the HTTPS binding and renews the certificates automatically.

HTTPS is **required**: Chrome only allows "Choose folder on this computer" and
"Create Selected Photos" on secure (https) sites.

## 8. Automatic deploys from GitHub

### 8a. Install the GitHub runner on the VPS

1. On GitHub: your repository → **Settings → Actions → Runners → New self-hosted runner** → **Windows**.
2. Follow the commands it shows, **but** when asked:
   - folder: `C:\actions-runner`
   - runner name: `studioos-vps`
   - **additional labels: `studio-os`**  ← important
   - **run as service: Y** (keep the suggested `NT AUTHORITY\NETWORK SERVICE`, or a local admin account)
3. Give the runner's account the rights it needs:

```powershell
$runner = "NT AUTHORITY\NETWORK SERVICE"      # or the account you chose
icacls C:\StudioOS /grant "${runner}:(OI)(CI)M"
sqlcmd -S localhost\SQLEXPRESS -E -Q "CREATE LOGIN [$runner] FROM WINDOWS; USE StudioManagementDb; CREATE USER [$runner] FOR LOGIN [$runner]; ALTER ROLE db_backupoperator ADD MEMBER [$runner];"
```

### 8b. Tell GitHub about the server

Repository → **Settings → Secrets and variables → Actions → Variables** tab → add:

| Name | Value |
|---|---|
| `STUDIOOS_API_URL` | `https://api.example.com` |
| `STUDIOOS_APP_URL` | `https://app.example.com` |
| `DEPLOY_ENABLED` | `true`  ← this switches automatic deploys on |

(Optional: `STUDIOOS_ROOT` if not `C:\StudioOS`, `STUDIOOS_SQL_SERVER` if not `localhost\SQLEXPRESS`.)

Optional safety: **Settings → Environments → production → Required reviewers** – then each deploy
waits for you to click **Approve** on GitHub before it installs.

### 8c. First deploy

GitHub → **Actions → CI → Run workflow** (or push anything to `main`). After the two checks pass,
**Deploy to the server** runs on the VPS and:

1. builds the API and the website (with the API address above),
2. backs up the database to `C:\StudioOS\backups` (keeps the last 10),
3. keeps the running version in `C:\StudioOS\releases\previous`,
4. installs the new version (uploaded logos and photo previews are never touched),
5. checks `https://api.example.com/health` – and **puts the previous version back** if it fails.

Open `https://app.example.com` and sign in.

---

## Everyday use

- Just **push to `main`**. CI tests it; if everything passes it goes live in a few minutes.
- If a deploy fails, the site stays on the previous version and GitHub emails you.
- **Undo a bad database change**: restore the newest `C:\StudioOS\backups\StudioManagementDb-before-deploy-*.bak`
  (ask before doing this – it replaces all data since that deploy).
- **Turn automatic deploys off**: set `DEPLOY_ENABLED` to `false`.
- **Deploy by hand on the VPS** (same steps, from a checked-out copy of the repo):
  `$env:STUDIOOS_API_URL="https://api.example.com"; powershell -ExecutionPolicy Bypass -File deploy\deploy.ps1`
