// Add the bank_transactions tab + header row to SHEETS_TRANSACTIONS_ID if missing.
// Run from repo root: pnpm ensure-bank-tab
// Requires .env.local with GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, SHEETS_TRANSACTIONS_ID.

const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

const REPO_ROOT = path.join(__dirname, '..');

const TAB_TITLE = 'bank_transactions';
const HEADERS = [
  'txn_id',
  'company_id',
  'date',
  'narration',
  'ref_number',
  'amount',
  'balance',
  'type',
  'mode',
  'source',
  'created_at',
];

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

async function main() {
  loadEnvLocal();

  const spreadsheetId = process.env.SHEETS_TRANSACTIONS_ID;
  if (!spreadsheetId) {
    console.error('SHEETS_TRANSACTIONS_ID is not set in .env.local');
    process.exit(1);
  }
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!email || !privateKey) {
    console.error('GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY missing in .env.local');
    process.exit(1);
  }

  const auth = new google.auth.GoogleAuth({
    credentials: { client_email: email, private_key: privateKey },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const authClient = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: authClient });

  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'properties.title,sheets.properties(sheetId,title,gridProperties)',
  });

  const titles = new Set(
    (meta.data.sheets ?? []).map((s) => s.properties?.title).filter(Boolean)
  );

  if (titles.has(TAB_TITLE)) {
    console.log(`Tab "${TAB_TITLE}" already exists on ${spreadsheetId}. Nothing to do.`);
    return;
  }

  console.log(`Adding tab "${TAB_TITLE}" to spreadsheet ${spreadsheetId}…`);

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          addSheet: {
            properties: {
              title: TAB_TITLE,
              gridProperties: {
                rowCount: 2000,
                columnCount: Math.max(HEADERS.length, 26),
              },
            },
          },
        },
      ],
    },
  });

  const endCol = columnLetter(HEADERS.length);
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${TAB_TITLE}!A1:${endCol}1`,
    valueInputOption: 'RAW',
    requestBody: { values: [HEADERS] },
  });

  console.log(`Done. Open: https://docs.google.com/spreadsheets/d/${spreadsheetId}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
