import "dotenv/config";
import dns from "node:dns";
import { neon } from "@neondatabase/serverless";
import fs from "node:fs";
import path from "node:path";

/**
 * Prefer IPv4 when resolving the database host.
 *
 * Neon publishes both A and AAAA records. Node 18+ defaults to whatever the
 * resolver returns first, which on many home and campus networks means an IPv6
 * address that then has no working route — the connection hangs for the full
 * 10-second timeout and surfaces as a bare `TypeError: fetch failed`, or as
 * Prisma's `P1001: Can't reach database server`.
 *
 * The tell is that it is *intermittent*: retrying sometimes picks the IPv4
 * record and succeeds, which makes it look like a flaky database rather than a
 * routing problem. Pinning the order makes it deterministic.
 */
dns.setDefaultResultOrder("ipv4first");

/**
 * Applies a SQL file to the database over HTTPS.
 *
 * `prisma db push` connects on port 5432, which plenty of corporate networks,
 * VPNs and home routers block outright — and when that happens the schema
 * silently stops matching the code, which surfaces later as a confusing runtime
 * error rather than an obvious connection failure.
 *
 * Neon's serverless driver speaks to the same database over port 443, so this
 * gets through where the CLI can't. Files live in prisma/manual/ and are
 * written to be safe to re-run.
 *
 *   npm run db:apply prisma/manual/001-exam-tables.sql
 */

const file = process.argv[2];

if (!file) {
  console.error("Usage: npm run db:apply <path-to-sql-file>");
  process.exit(1);
}

const fullPath = path.resolve(file);
if (!fs.existsSync(fullPath)) {
  console.error(`No such file: ${fullPath}`);
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

/**
 * Splits a script into statements, keeping `DO $$ ... $$;` blocks whole —
 * they contain semicolons that must not be treated as boundaries.
 */
function splitStatements(script: string): string[] {
  const statements: string[] = [];
  let buffer = "";
  let inDollarBlock = false;

  for (const line of script.split("\n")) {
    if (line.trim().startsWith("--")) continue;
    if (/DO \$\$/.test(line)) inDollarBlock = true;
    buffer += `${line}\n`;

    const endsBlock = inDollarBlock && /END \$\$;/.test(line);
    const endsStatement = !inDollarBlock && line.trim().endsWith(";");

    if (endsBlock || endsStatement) {
      statements.push(buffer.trim());
      buffer = "";
      inDollarBlock = false;
    }
  }

  return statements.filter(Boolean);
}

(async () => {
  const statements = splitStatements(fs.readFileSync(fullPath, "utf8"));
  let applied = 0;

  for (const statement of statements) {
    const label = statement.split("\n")[0]!.slice(0, 60);
    try {
      // v0.10 exposes the plain-string form as a direct call; `sql.query`
      // only exists on the 1.x client, which the Prisma adapter pins away from.
      await sql(statement);
      console.log(`  OK   ${label}`);
      applied += 1;
    } catch (error) {
      console.log(`  FAIL ${label}`);
      console.log(`       ${(error as Error).message.slice(0, 160)}`);
    }
  }

  console.log(`\n  ${applied}/${statements.length} statements applied`);
  process.exit(applied === statements.length ? 0 : 1);
})();
