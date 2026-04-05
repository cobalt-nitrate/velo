// Show which Google Drive folder each Velo workbook (SHEETS_*_ID) lives in.
// Optional: --move  → place each workbook inside your Velo Data folder (same as setup-sheets-run.js).
//
// Run: node scripts/audit-velo-sheet-locations.js
//      node scripts/audit-velo-sheet-locations.js --move
//
// The app always talks to spreadsheets by ID; folders are only for your sanity in Drive.
// Set VELO_DATA_FOLDER_ID in .env.local if your Velo Data folder is not the default below.

const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

const REPO_ROOT = path.join(__dirname, '..');

/** Same folder setup-sheets-run.js moves new workbooks into; override with VELO_DATA_FOLDER_ID. */
const DEFAULT_VELO_DATA_FOLDER_ID = '1b526Cgd8_AYDa1KimK6Hw0wRTAPuwzTc';

const SHEET_ENV_KEYS = [
  ['CONFIG', 'SHEETS_CONFIG_ID'],
  ['MASTER', 'SHEETS_MASTER_ID'],
  ['TRANSACTIONS', 'SHEETS_TRANSACTIONS_ID'],
  ['COMPLIANCE', 'SHEETS_COMPLIANCE_ID'],
  ['LOGS', 'SHEETS_LOGS_ID'],
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

async function main() {
  const doMove = process.argv.includes('--move');
  loadEnvLocal();

  const targetFolderId =
    process.env.VELO_DATA_FOLDER_ID?.trim() || DEFAULT_VELO_DATA_FOLDER_ID;

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!email || !privateKey) {
    console.error('GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY missing in .env.local');
    process.exit(1);
  }

  const auth = new google.auth.GoogleAuth({
    credentials: { client_email: email, private_key: privateKey },
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive',
    ],
  });
  const authClient = await auth.getClient();
  const drive = google.drive({ version: 'v3', auth: authClient });

  let targetFolderName = targetFolderId;
  try {
    const tmeta = await drive.files.get({
      fileId: targetFolderId,
      fields: 'name',
    });
    if (tmeta.data.name) targetFolderName = `${tmeta.data.name} (${targetFolderId})`;
  } catch {
    // keep id only
  }

  console.log(`Target Velo Data folder: ${targetFolderName}\n`);

  const parentNameCache = new Map();

  async function parentNames(parentIds) {
    const labels = [];
    for (const pid of parentIds) {
      if (parentNameCache.has(pid)) {
        labels.push(parentNameCache.get(pid));
        continue;
      }
      try {
        const pm = await drive.files.get({
          fileId: pid,
          fields: 'name,mimeType',
        });
        const label =
          pm.data.mimeType === 'application/vnd.google-apps.folder'
            ? `📁 ${pm.data.name} (${pid})`
            : `${pm.data.name} (${pid})`;
        parentNameCache.set(pid, label);
        labels.push(label);
      } catch {
        const unknown = `(unknown parent ${pid})`;
        parentNameCache.set(pid, unknown);
        labels.push(unknown);
      }
    }
    return labels;
  }

  for (const [label, envKey] of SHEET_ENV_KEYS) {
    const fileId = process.env[envKey]?.trim();
    if (!fileId) {
      console.log(`${label} (${envKey}): not set`);
      continue;
    }

    let meta;
    try {
      meta = await drive.files.get({
        fileId,
        fields: 'name,parents,id',
      });
    } catch (e) {
      console.log(`${label}: ${envKey}=${fileId} — error: ${e.message}`);
      continue;
    }

    const parents = meta.data.parents || [];
    const insideVelo = parents.includes(targetFolderId);
    const paths = await parentNames(parents);

    console.log(`${label} (${envKey})`);
    console.log(`  Title: ${meta.data.name}`);
    console.log(`  ID:    ${fileId}`);
    console.log(`  In Velo Data folder: ${insideVelo ? 'yes' : 'no'}`);
    console.log(`  Parent(s): ${paths.join('  |  ') || '(none — shared drive root?)'}`);
    console.log('');

    if (doMove && !insideVelo && parents.length > 0) {
      const removeParents = parents.join(',');
      console.log(`  → Moving into Velo Data folder…`);
      await drive.files.update({
        fileId,
        addParents: targetFolderId,
        removeParents,
        fields: 'id,name,parents',
      });
      console.log(`  → Done.\n`);
    } else if (doMove && !insideVelo && parents.length === 0) {
      console.log(`  → Skip move: no parents reported (Shared drive? move manually in UI).\n`);
    }
  }

  if (doMove) {
    console.log(
      'Move complete. Extra spreadsheets in “My Drive” that are not in .env.local are unrelated to Velo—you can delete or archive them if they are old copies.\n' +
        'Set VELO_DRIVE_FOLDER_ID to the same folder ID as Velo Data if you want the web Files page to list that folder.'
    );
  } else {
    console.log(
      'Tip: run with --move to put all five workbooks into the Velo Data folder.\n' +
        'Other spreadsheets in Drive are often from an old setup or manual copies—only SHEETS_*_ID in .env.local are used by the app.'
    );
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
