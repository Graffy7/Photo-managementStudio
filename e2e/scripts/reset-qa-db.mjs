// Recreates the QA database empty before a test run (the QA API then builds every table from the
// migrations when it starts) and empties the QA uploads folder. It only ever touches the database
// named StudioOS_QA - never the studio's real StudioManagementDb.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DB = "StudioOS_QA";
const server = process.env.QA_SQL_SERVER ?? "localhost\\SQLEXPRESS";
const here = path.dirname(fileURLToPath(import.meta.url));

if (DB !== "StudioOS_QA" || /StudioManagementDb/i.test(DB)) throw new Error("Refusing to reset anything but the QA database.");

const sql = `
IF DB_ID(N'${DB}') IS NOT NULL
BEGIN
  ALTER DATABASE [${DB}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
  DROP DATABASE [${DB}];
END
CREATE DATABASE [${DB}];`;
execFileSync("sqlcmd", ["-S", server, "-E", "-C", "-b", "-Q", sql], { stdio: "inherit" });
console.log(`QA database ${DB} recreated on ${server}.`);

const uploads = path.resolve(here, "..", ".qa-uploads");
fs.rmSync(uploads, { recursive: true, force: true });
fs.mkdirSync(uploads, { recursive: true });
console.log(`QA uploads folder emptied: ${uploads}`);

for (const dir of [".qa-photos", ".qa-photo-root"]) {
  const full = path.resolve(here, "..", dir);
  fs.rmSync(full, { recursive: true, force: true });
  fs.mkdirSync(full, { recursive: true });
  console.log(`QA folder emptied: ${full}`);
}
