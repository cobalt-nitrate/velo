// Create file_links tab on VELO_LOGS (SHEETS_LOGS_ID) if missing — Drive URL index for Sheets cohesion.
// Run: node scripts/ensure-file-links-tab.js

const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

const REPO_ROOT = path.join(__dirname, '..');

const TAB_TITLE = 'file_links';
const HEADERS = [
  'link_id',
  'scope_table',
  'scope_record_id',
  'role',
  'drive_file_id',
  'drive_web_view_url',
  'mime',
  'filename',
  'local_upload_id',
  'source',
  'meta_json',
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

  const spreadsheetId = process.env.SHEETS_LOGS_ID;
  if (!spreadsheetId) {
    console.error('SHEETS_LOGS_ID is not set in .env.local');
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
    fields: 'sheets.properties.title',
  });

  const titles = new Set(
    (meta.data.sheets ?? []).map((s) => s.properties?.title).filter(Boolean)
  );

  if (titles.has(TAB_TITLE)) {
    console.log(`Tab "${TAB_TITLE}" already exists on LOGS spreadsheet. Nothing to do.`);
    return;
  }

  console.log(`Adding "${TAB_TITLE}" to LOGS ${spreadsheetId}…`);

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          addSheet: {
            properties: {
              title: TAB_TITLE,
              gridProperties: { rowCount: 5000, columnCount: Math.max(HEADERS.length, 12) },
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

  console.log('Done. Optional: add columns to existing sheets — hr_tasks: primary_drive_url, primary_drive_file_id; approval_requests: attachment_drive_urls_json');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
