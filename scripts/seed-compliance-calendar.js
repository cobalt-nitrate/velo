// Compliance calendar seeder.
// Generates due-date rows in VELO_COMPLIANCE.compliance_calendar for a full financial year.
// Run with: node scripts/seed-compliance-calendar.js [FY_START_YEAR]
//   e.g.:   node scripts/seed-compliance-calendar.js 2025   → generates FY 2025-26 (Apr 2025 – Mar 2026)
//
// Rules are read from configs/business/compliance_calendar_rules.json.
// Company settings (state, GST registration, PF/ESIC) are read from configs/business/company_config.json.

const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

// ─── Config ───────────────────────────────────────────────────────────────────

const REPO_ROOT = path.join(__dirname, '..');

function loadJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(REPO_ROOT, relPath), 'utf-8'));
}

const rules = loadJson('configs/business/compliance_calendar_rules.json');
const company = loadJson('configs/business/company_config.json');

// ─── Financial year resolution ────────────────────────────────────────────────

const fyStartYear = parseInt(process.argv[2] ?? new Date().getFullYear(), 10);
// FY runs April fyStartYear → March (fyStartYear + 1)
const fyEndYear = fyStartYear + 1;

console.log(`\nSeeding compliance calendar for FY ${fyStartYear}-${String(fyEndYear).slice(-2)}`);
console.log(`Company state: ${company.state_code}`);
console.log(`GST registered: ${company.gst_registered}`);
console.log(`PF registered: ${company.pf_registered}`);
console.log(`ESIC registered: ${company.esic_registered}`);

// ─── Due date generator ────────────────────────────────────────────────────────

/**
 * Generate the ISO due date for a monthly obligation.
 * @param {number} month - 1-based month the obligation relates to (e.g., April = 4)
 * @param {number} year - year the obligation relates to
 * @param {'following' | 'same'} relativeTo - whether due day is in the same month or following
 * @param {number} dueDay - day of month it's due
 */
function monthlyDueDate(month, year, relativeTo, dueDay) {
  let dueMonth = month;
  let dueYear = year;

  if (relativeTo === 'following') {
    dueMonth = month + 1;
    if (dueMonth > 12) {
      dueMonth = 1;
      dueYear = year + 1;
    }
  }

  // Handle months with fewer days
  const lastDay = new Date(dueYear, dueMonth, 0).getDate();
  const actualDay = Math.min(dueDay, lastDay);
  return `${dueYear}-${String(dueMonth).padStart(2, '0')}-${String(actualDay).padStart(2, '0')}`;
}

/**
 * Parse a fixed quarterly due date like "31st July".
 */
function quarterlyDueDate(dueDateStr, fyStartYear) {
  const MONTH_NAMES = {
    january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
    july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  };
  const match = dueDateStr.match(/(\d+)(?:st|nd|rd|th)?\s+(\w+)/i);
  if (!match) return null;
  const day = parseInt(match[1], 10);
  const monthNum = MONTH_NAMES[match[2].toLowerCase()];
  if (!monthNum) return null;

  // Determine which FY year this falls in
  // FY April fyStartYear → March fyEndYear
  const year = monthNum >= 4 ? fyStartYear : fyStartYear + 1;
  return `${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// ─── Row builders ─────────────────────────────────────────────────────────────

function makeId() {
  return `cal_${Date.now()}_${Math.random().toString(16).slice(2, 6)}`;
}

const rows = [];

for (const rule of rules.rules) {
  // ── Skip rules that don't apply to this company ────────────────────────────
  if (rule.applicable_states && !rule.applicable_states.includes(company.state_code)) continue;
  if (rule.id.startsWith('pf_') && !company.pf_registered) continue;
  if (rule.id.startsWith('esic_') && !company.esic_registered) continue;
  if (['gstr1', 'gstr3b'].includes(rule.id) && !company.gst_registered) continue;

  // ── Monthly rules ──────────────────────────────────────────────────────────
  if (rule.frequency === 'monthly') {
    // Generate one row per month of the FY (April through March)
    for (let m = 4; m <= 15; m++) {
      const month = m <= 12 ? m : m - 12;
      const year = m <= 12 ? fyStartYear : fyEndYear;

      // Special case: TDS for March is due on 30th April (not 7th April)
      let dueDay = rule.due_day_of_following_month ?? rule.due_day_of_same_month;
      let relativeTo = rule.due_day_of_following_month ? 'following' : 'same';

      if (rule.id === 'tds_payment' && month === 3) {
        dueDay = 30;
        relativeTo = 'following'; // 30th April
      }

      const dueDate = monthlyDueDate(month, year, relativeTo, dueDay);
      const monthName = new Date(year, month - 1, 1).toLocaleString('en-IN', { month: 'long' });
      const fyLabel = `${String(fyStartYear).slice(-2)}-${String(fyEndYear).slice(-2)}`;

      rows.push([
        makeId(),
        rule.id,
        `${rule.label} — ${monthName} ${year}`,
        String(month),
        String(year),
        dueDate,
        'UPCOMING',
        'FALSE', // alert_sent_7d
        'FALSE', // alert_sent_2d
        '',      // completed_date
        '',      // filing_reference
        rule.notes ?? rule.portal ?? '',
      ]);
    }
    continue;
  }

  // ── Quarterly rules ────────────────────────────────────────────────────────
  if (rule.frequency === 'quarterly') {
    const dueDate = quarterlyDueDate(rule.due_date, fyStartYear);
    if (!dueDate) {
      console.warn(`  Skipped ${rule.id}: could not parse due_date "${rule.due_date}"`);
      continue;
    }

    // Determine which quarter this falls in
    const dueMm = parseInt(dueDate.split('-')[1], 10);
    const periodQuarter =
      dueMm >= 4 && dueMm <= 6 ? 'Q1' :
      dueMm >= 7 && dueMm <= 9 ? 'Q2' :
      dueMm >= 10 && dueMm <= 12 ? 'Q3' : 'Q4';

    const fyLabel = `FY${String(fyStartYear).slice(-2)}-${String(fyEndYear).slice(-2)}`;

    rows.push([
      makeId(),
      rule.id,
      `${rule.label} — ${fyLabel}`,
      periodQuarter,
      String(fyStartYear),
      dueDate,
      'UPCOMING',
      'FALSE',
      'FALSE',
      '',
      '',
      rule.notes ?? '',
    ]);
  }
}

console.log(`\nGenerated ${rows.length} compliance calendar rows.`);

// ─── Write to Sheets ──────────────────────────────────────────────────────────

const auth = new google.auth.GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const HEADERS = [
  'calendar_id', 'type', 'label', 'period_month', 'period_year', 'due_date',
  'status', 'alert_sent_7d', 'alert_sent_2d',
  'completed_date', 'filing_reference', 'notes',
];

async function main() {
  const authClient = await auth.getClient();
  const sheetsClient = google.sheets({ version: 'v4', auth: authClient });

  const spreadsheetId = process.env.SHEETS_COMPLIANCE_ID;
  if (!spreadsheetId) {
    console.error('\nSHEETS_COMPLIANCE_ID is not set in environment.');
    console.log('\nDry run — first 5 rows that would be written:\n');
    rows.slice(0, 5).forEach((r) =>
      console.log('  ', HEADERS.reduce((o, h, i) => ({ ...o, [h]: r[i] }), {}))
    );
    return;
  }

  // Check if sheet already has data beyond the header row
  const existing = await sheetsClient.spreadsheets.values.get({
    spreadsheetId,
    range: 'compliance_calendar!A2:A',
  });

  if ((existing.data.values?.length ?? 0) > 0) {
    const fyTag = `— ${fyStartYear}`;
    // Check if this FY is already seeded
    const fyRows = (existing.data.values ?? []).filter((r) => r[0] && String(r[0]).includes(String(fyStartYear)));
    if (fyRows.length > 0) {
      console.log(`\nFY ${fyStartYear} already has ${fyRows.length} rows in compliance_calendar. Skipping.`);
      console.log('To re-seed, clear those rows first.');
      return;
    }
  }

  // Append all rows
  await sheetsClient.spreadsheets.values.append({
    spreadsheetId,
    range: 'compliance_calendar!A:L',
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: rows },
  });

  console.log(`\n✓ Seeded ${rows.length} rows into compliance_calendar.`);
  console.log('\nSample rows:');
  rows.slice(0, 3).forEach((r) => {
    const obj = HEADERS.reduce((o, h, i) => ({ ...o, [h]: r[i] }), {});
    console.log(' ', obj);
  });
}

// Load .env.local if present
const envPath = path.join(REPO_ROOT, '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const match = line.match(/^([A-Z_]+)=(.*)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^"(.*)"$/, '$1').replace(/\\n/g, '\n');
    }
  }
}

main().catch((err) => {
  console.error('\nSeeding failed:', err.message);
  process.exit(1);
});
