const fs = require("fs");
const crypto = require("crypto");
const path = require("path");
const { Client } = require("pg");

loadDotEnv(".env");

const projectRef = process.env.SUPABASE_PROJECT_REF;
const password = process.env.PGPASSWORD;
const poolerRegion = process.env.SUPABASE_POOLER_REGION;
const postgresUser = process.env.SUPABASE_DB_USER;
const databaseUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
const postgresPort = process.env.SUPABASE_DB_PORT
  ? Number(process.env.SUPABASE_DB_PORT)
  : undefined;

if (!databaseUrl && (!projectRef || !password)) {
  throw new Error("SUPABASE_DB_URL or SUPABASE_PROJECT_REF + PGPASSWORD are required.");
}

const requiredTables = ["scoring_test_submissions", "ai_report_settings"];

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return;

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;

    const separatorIndex = trimmed.indexOf("=");
    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^['"]|['"]$/g, "");

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function getClientConfig() {
  if (databaseUrl) {
    return {
      connectionString: databaseUrl,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 20000,
    };
  }

  return {
    host: poolerRegion
      ? `aws-0-${poolerRegion}.pooler.supabase.com`
      : `db.${projectRef}.supabase.co`,
    port: postgresPort || (poolerRegion ? 6543 : 5432),
    database: "postgres",
    user: postgresUser || (poolerRegion ? `postgres.${projectRef}` : "postgres"),
    password,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 20000,
  };
}

function getBackofficePasscodeHash() {
  if (process.env.BACKOFFICE_PASSCODE_SHA256) {
    const hash = process.env.BACKOFFICE_PASSCODE_SHA256.trim();
    if (!/^[a-f0-9]{64}$/i.test(hash)) {
      throw new Error("BACKOFFICE_PASSCODE_SHA256 must be a 64-character SHA-256 hex hash.");
    }
    return hash.toLowerCase();
  }

  if (!process.env.BACKOFFICE_PASSCODE) {
    return "";
  }

  const hash = crypto.createHash("sha256").update(process.env.BACKOFFICE_PASSCODE).digest("hex");
  if (!/^[a-f0-9]{64}$/i.test(hash)) {
    throw new Error("BACKOFFICE_PASSCODE hash generation failed.");
  }

  return hash.toLowerCase();
}

function loadMigrationSql(filePath) {
  let sql = fs.readFileSync(filePath, "utf8");
  const passcodeHash = getBackofficePasscodeHash();

  if (passcodeHash) {
    sql = sql.replace(/<> '[a-f0-9]{64}'/g, `<> '${passcodeHash}'`);
  }

  return sql;
}

async function assertSupabaseInfra(client) {
  const tableResult = await client.query(
    `select table_name
     from information_schema.tables
     where table_schema = 'public'
       and table_name = any($1::text[])`,
    [requiredTables],
  );
  const existingTables = new Set(tableResult.rows.map((row) => row.table_name));
  const missingTables = requiredTables.filter((table) => !existingTables.has(table));

  if (missingTables.length > 0) {
    throw new Error(`Missing Supabase tables after migration: ${missingTables.join(", ")}`);
  }

  const functionResult = await client.query(
    `select p.proname
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = any($1::text[])`,
    [["update_ai_report_settings", "get_ai_report_settings"]],
  );

  const existingFunctions = new Set(functionResult.rows.map((row) => row.proname));
  const missingFunctions = ["update_ai_report_settings", "get_ai_report_settings"].filter(
    (functionName) => !existingFunctions.has(functionName),
  );

  if (missingFunctions.length > 0) {
    throw new Error(`Missing Supabase RPC function: ${missingFunctions.join(", ")}.`);
  }
}

async function main() {
  const migrationsDir = path.join("supabase", "migrations");
  const migrationFiles = fs
    .readdirSync(migrationsDir)
    .filter((fileName) => fileName.endsWith(".sql"))
    .sort()
    .map((fileName) => path.join(migrationsDir, fileName));

  if (migrationFiles.length === 0) {
    throw new Error("No Supabase migrations found.");
  }

  const client = new Client(getClientConfig());

  await client.connect();
  try {
    for (const filePath of migrationFiles) {
      await client.query(loadMigrationSql(filePath));
      console.log(`applied ${filePath}`);
    }

    await assertSupabaseInfra(client);
  } finally {
    await client.end();
  }

  console.log("Supabase infra is ready");
}

main().catch((error) => {
  if (error && Array.isArray(error.errors)) {
    console.error(
      error.errors.map((item) => `${item.code || item.name}: ${item.message}`).join("\n"),
    );
  } else {
    console.error(error && error.message ? error.message : String(error));
  }
  process.exit(1);
});
