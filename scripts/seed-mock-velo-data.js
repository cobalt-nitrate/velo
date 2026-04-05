#!/usr/bin/env node
// Append rich mock rows from data/mock/velo-demo-seed.json into your Velo Google Sheets.
// Requires .env.local with GOOGLE_* and all SHEETS_*_ID values.
//
//   node scripts/seed-mock-velo-data.js           # append all tables
//   node scripts/seed-mock-velo-data.js --dry-run # print plan only
//   node scripts/seed-mock-velo-data.js --only bank_transactions,ap_invoices
//
// Re-running duplicates rows (IDs use demo_ prefix). Delete demo_* rows in Sheets to reset.

const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

const REPO_ROOT = path.join(__dirname, '..');
const SEED_PATH = path.join(REPO_ROOT, 'data', 'mock', 'velo-demo-seed.json');

function loadEnvLocal() {
  const p = path.join(REPO_ROOT, '.env.local');
  if (!fs.existsSync(p)) {
    console.error('Missing .env.local in repo root.');
    process.exit(1);
  }
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if (v.startsWith('"') && v.endsWith('"')) {
      v = v.slice(1, -1).replace(/\\n/g, '\n');
    }
    process.env[key] = v;
  }
}

function columnLetter(n) {
  let result = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    result = String.fromCharCode(65 + rem) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}

function parseArgs(argv) {
  const dryRun = argv.includes('--dry-run');
  const onlyIdx = argv.findIndex((a) => a === '--only');
  const only =
    onlyIdx >= 0 && argv[onlyIdx + 1]
      ? argv[onlyIdx + 1].split(',').map((s) => s.trim()).filter(Boolean)
      : null;
  return { dryRun, only };
}

async function sheetTitles(sheets, spreadsheetId) {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties.title',
  });
  return new Set(
    (meta.data.sheets ?? []).map((s) => s.properties?.title).filter(Boolean)
  );
}

async function appendRows(sheets, spreadsheetId, sheetName, headers, rowObjects) {
  const values = rowObjects.map((obj) => headers.map((h) => String(obj[h] ?? '')));
  const endCol = columnLetter(headers.length);
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A:${endCol}`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values },
  });
}

async function main() {
  const { dryRun, only } = parseArgs(process.argv.slice(2));
  loadEnvLocal();

  if (!fs.existsSync(SEED_PATH)) {
    console.error('Seed file not found:', SEED_PATH);
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'));
  const tables = raw.tables;
  if (!Array.isArray(tables)) {
    console.error('Invalid seed: missing tables[]');
    process.exit(1);
  }

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!email || !privateKey) {
    console.error('GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY required.');
    process.exit(1);
  }

  const auth = new google.auth.GoogleAuth({
    credentials: { client_email: email, private_key: privateKey },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const client = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: client });

  let totalRows = 0;

  for (const t of tables) {
    const { envKey, sheet, headers, rows } = t;
    if (!envKey || !sheet || !headers || !rows?.length) continue;
    if (only && !only.includes(sheet)) continue;

    const spreadsheetId = process.env[envKey];
    if (!spreadsheetId) {
      console.warn(`Skip ${sheet}: ${envKey} not set`);
      continue;
    }

    const titles = await sheetTitles(sheets, spreadsheetId);
    if (!titles.has(sheet)) {
      console.warn(`Skip ${sheet}: tab not in spreadsheet ${spreadsheetId} (run ensure-* scripts or add tab)`);
      continue;
    }

    if (dryRun) {
      console.log(`[dry-run] ${envKey} / ${sheet}: ${rows.length} rows`);
      totalRows += rows.length;
      continue;
    }

    await appendRows(sheets, spreadsheetId, sheet, headers, rows);
    console.log(`✓ ${sheet}: appended ${rows.length} rows → ${spreadsheetId}`);
    totalRows += rows.length;
  }

  console.log(dryRun ? `\nDry run: ${totalRows} rows would be appended.` : `\nDone: ${totalRows} rows appended.`);
  console.log('Sample CSV for bank parser: data/mock/samples/demo-bank-statement.csv');
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
