// Document generator — produces HTML documents and uploads to Google Drive.
// Falls back to returning the HTML as a data-url if Drive credentials are absent.
//
// Drive folder: VELO_DRIVE_FOLDER_ID env var (root of all Velo documents).
// Folder layout: /VELO_DRIVE_FOLDER/<doc_type>/<year>/<employee_id>/

import { google } from 'googleapis';
import { Readable } from 'stream';

// ─── Auth ────────────────────────────────────────────────────────────────────

async function getDriveClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  const authClient = await auth.getClient();
  return google.drive({ version: 'v3', auth: authClient as Parameters<typeof google.drive>[0]['auth'] });
}

function useDrive(): boolean {
  return !!(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY);
}

async function uploadToDrive(
  name: string,
  html: string,
  parentFolderId?: string
): Promise<{ file_id: string; web_view_link: string; download_link: string }> {
  const drive = await getDriveClient();

  const stream = Readable.from([html]);
  const res = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'text/html',
      ...(parentFolderId ? { parents: [parentFolderId] } : {}),
    },
    media: {
      mimeType: 'text/html',
      body: stream,
    },
    fields: 'id, webViewLink, webContentLink',
  });

  // Make the file readable by anyone with the link
  await drive.permissions.create({
    fileId: res.data.id!,
    requestBody: { role: 'reader', type: 'anyone' },
  });

  return {
    file_id: res.data.id ?? '',
    web_view_link: res.data.webViewLink ?? '',
    download_link: res.data.webContentLink ?? '',
  };
}

// ─── HTML templates ───────────────────────────────────────────────────────────

const STYLE = `
  <style>
    * { box-sizing: border-box; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 13px;
           color: #1a1a1a; margin: 0; padding: 32px; background: #fff; }
    h1 { font-size: 22px; font-weight: 700; margin: 0 0 4px; }
    h2 { font-size: 15px; font-weight: 600; margin: 24px 0 8px; color: #333; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    th { background: #111; color: #fff; padding: 8px 10px; text-align: left;
         font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
    td { padding: 7px 10px; border-bottom: 1px solid #eee; }
    tr:last-child td { border-bottom: none; }
    .right { text-align: right; }
    .muted { color: #666; font-size: 12px; }
    .label { color: #555; font-size: 11px; text-transform: uppercase; letter-spacing: 0.4px; }
    .value { font-weight: 600; }
    .net { background: #f0fdf4; font-weight: 700; font-size: 15px; }
    .header-row { display: flex; justify-content: space-between; align-items: flex-start;
                   margin-bottom: 24px; border-bottom: 2px solid #111; padding-bottom: 16px; }
    .badge { display: inline-block; background: #e0f2f1; color: #00695c;
              font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px;
              text-transform: uppercase; letter-spacing: 0.5px; }
    .confidential { position: fixed; top: 40%; left: 50%; transform: translate(-50%,-50%) rotate(-35deg);
                     font-size: 80px; font-weight: 900; color: rgba(0,0,0,0.04);
                     pointer-events: none; user-select: none; white-space: nowrap; }
  </style>
`;

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function inr(n: unknown): string {
  const num = Number(n ?? 0);
  return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// ── Salary Slip ───────────────────────────────────────────────────────────────

function salarySlipHtml(p: Record<string, unknown>): string {
  const month = esc(p.month);
  const year = esc(p.year);
  const name = esc(p.employee_name);
  const empId = esc(p.employee_id);
  const designation = esc(p.designation ?? '');
  const department = esc(p.department ?? '');
  const doj = esc(p.doj ?? '');
  const pan = esc(p.pan ?? '');

  const gross = Number(p.gross_salary ?? 0);
  const basic = Number(p.basic ?? 0);
  const hra = Number(p.hra ?? 0);
  const lta = Number(p.lta ?? 0);
  const special = Number(p.special_allowance ?? gross - basic - hra - lta);

  const pfEmployee = Number(p.pf_employee ?? 0);
  const esicEmployee = Number(p.esic_employee ?? 0);
  const pt = Number(p.pt ?? 0);
  const tds = Number(p.tds ?? 0);
  const lop = Number(p.lop_deduction ?? 0);
  const totalDeductions = pfEmployee + esicEmployee + pt + tds + lop;
  const net = Number(p.net_salary ?? gross - totalDeductions);

  const workingDays = esc(p.working_days ?? 26);
  const lopDays = esc(p.lop_days ?? 0);
  const companyName = esc(p.company_name ?? process.env.VELO_COMPANY_NAME ?? 'Your Company');

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>Salary Slip — ${name} — ${month} ${year}</title>${STYLE}</head>
  <body>
    <div class="confidential">CONFIDENTIAL</div>
    <div class="header-row">
      <div>
        <h1>${companyName}</h1>
        <div class="muted">Salary Slip for <strong>${month} ${year}</strong></div>
      </div>
      <div class="badge">Salary Slip</div>
    </div>

    <table>
      <tr><td class="label">Employee Name</td><td class="value">${name}</td>
          <td class="label">Employee ID</td><td class="value">${empId}</td></tr>
      <tr><td class="label">Designation</td><td>${designation}</td>
          <td class="label">Department</td><td>${department}</td></tr>
      <tr><td class="label">Date of Joining</td><td>${doj}</td>
          <td class="label">PAN</td><td>${pan}</td></tr>
      <tr><td class="label">Working Days</td><td>${workingDays}</td>
          <td class="label">LOP Days</td><td>${lopDays}</td></tr>
    </table>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;">
      <div>
        <h2>Earnings</h2>
        <table>
          <tr><th>Component</th><th class="right">Amount</th></tr>
          <tr><td>Basic Salary</td><td class="right">${inr(basic)}</td></tr>
          <tr><td>HRA</td><td class="right">${inr(hra)}</td></tr>
          ${lta > 0 ? `<tr><td>LTA</td><td class="right">${inr(lta)}</td></tr>` : ''}
          <tr><td>Special Allowance</td><td class="right">${inr(special)}</td></tr>
          <tr style="font-weight:600;background:#f9f9f9;">
            <td>Gross Salary</td><td class="right">${inr(gross)}</td>
          </tr>
        </table>
      </div>
      <div>
        <h2>Deductions</h2>
        <table>
          <tr><th>Component</th><th class="right">Amount</th></tr>
          ${pfEmployee > 0 ? `<tr><td>PF (Employee)</td><td class="right">${inr(pfEmployee)}</td></tr>` : ''}
          ${esicEmployee > 0 ? `<tr><td>ESIC (Employee)</td><td class="right">${inr(esicEmployee)}</td></tr>` : ''}
          ${pt > 0 ? `<tr><td>Professional Tax</td><td class="right">${inr(pt)}</td></tr>` : ''}
          ${tds > 0 ? `<tr><td>TDS (Income Tax)</td><td class="right">${inr(tds)}</td></tr>` : ''}
          ${lop > 0 ? `<tr><td>LOP Deduction</td><td class="right">${inr(lop)}</td></tr>` : ''}
          <tr style="font-weight:600;background:#f9f9f9;">
            <td>Total Deductions</td><td class="right">${inr(totalDeductions)}</td>
          </tr>
        </table>
      </div>
    </div>

    <table>
      <tr class="net">
        <td>Net Salary (Take-Home)</td>
        <td class="right">${inr(net)}</td>
      </tr>
    </table>

    <div class="muted" style="margin-top:32px;border-top:1px solid #eee;padding-top:12px;">
      This is a computer-generated payslip and does not require a signature.
      Generated by Velo on ${new Date().toLocaleDateString('en-IN')}.
    </div>
  </body></html>`;
}

// ── Offer Letter ──────────────────────────────────────────────────────────────

function offerLetterHtml(p: Record<string, unknown>): string {
  const candidate = esc(p.candidate_name);
  const designation = esc(p.designation);
  const department = esc(p.department ?? '');
  const ctc = Number(p.ctc_annual);
  const joiningDate = esc(p.joining_date);
  const reportingTo = esc(p.reporting_to ?? '');
  const probation = Number(p.probation_months ?? 3);
  const notice = Number(p.notice_period_months ?? 2);
  const workLocation = esc(p.work_location ?? 'Office');
  const companyName = esc(p.company_name ?? process.env.VELO_COMPANY_NAME ?? 'Your Company');
  const date = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  // Salary breakup (approximate)
  const monthly = ctc / 12;
  const basic = Math.round(monthly * 0.45);
  const hra = Math.round(basic * 0.45);
  const lta = Math.round(monthly * 0.05);
  const special = Math.round(monthly - basic - hra - lta);

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>Offer Letter — ${candidate}</title>${STYLE}</head>
  <body>
    <div class="header-row">
      <div>
        <h1>${companyName}</h1>
        <div class="muted">Offer of Employment</div>
      </div>
      <div class="muted">${date}</div>
    </div>

    <p>Dear <strong>${candidate}</strong>,</p>

    <p>We are pleased to extend this offer of employment for the position of
    <strong>${designation}</strong>${department ? ` in the ${department} department` : ''}.
    We believe your skills and experience make you an excellent fit for our team.</p>

    <h2>Terms of Employment</h2>
    <table>
      <tr><td class="label">Position</td><td class="value">${designation}</td></tr>
      ${department ? `<tr><td class="label">Department</td><td>${department}</td></tr>` : ''}
      <tr><td class="label">Date of Joining</td><td class="value">${joiningDate}</td></tr>
      ${reportingTo ? `<tr><td class="label">Reporting To</td><td>${reportingTo}</td></tr>` : ''}
      <tr><td class="label">Work Location</td><td>${workLocation}</td></tr>
      <tr><td class="label">Annual CTC</td><td class="value">${inr(ctc)}</td></tr>
      <tr><td class="label">Probation Period</td><td>${probation} months</td></tr>
      <tr><td class="label">Notice Period</td><td>${notice} months</td></tr>
    </table>

    <h2>Compensation Breakup (Monthly)</h2>
    <table>
      <tr><th>Component</th><th class="right">Amount/Month</th><th class="right">Annual</th></tr>
      <tr><td>Basic Salary</td><td class="right">${inr(basic)}</td><td class="right">${inr(basic * 12)}</td></tr>
      <tr><td>HRA</td><td class="right">${inr(hra)}</td><td class="right">${inr(hra * 12)}</td></tr>
      <tr><td>LTA</td><td class="right">${inr(lta)}</td><td class="right">${inr(lta * 12)}</td></tr>
      <tr><td>Special Allowance</td><td class="right">${inr(special)}</td><td class="right">${inr(special * 12)}</td></tr>
      <tr style="font-weight:700;background:#f9f9f9;">
        <td>Total CTC</td><td class="right">${inr(monthly)}</td><td class="right">${inr(ctc)}</td>
      </tr>
    </table>

    <p>This offer is subject to satisfactory completion of background verification and document submission.
    Please confirm your acceptance by signing and returning this letter.</p>

    <p>We look forward to welcoming you to the team!</p>

    <div style="margin-top:48px;">
      <p style="margin:0;">Authorised Signatory</p>
      <p style="margin:4px 0 0;">${companyName}</p>
    </div>

    <div class="muted" style="margin-top:32px;border-top:1px solid #eee;padding-top:12px;">
      Generated by Velo on ${date}. This offer is confidential.
    </div>
  </body></html>`;
}

// ── Experience Certificate ─────────────────────────────────────────────────────

function experienceCertificateHtml(p: Record<string, unknown>): string {
  const name = esc(p.employee_name);
  const empId = esc(p.employee_id);
  const designation = esc(p.designation);
  const department = esc(p.department ?? '');
  const doj = esc(p.doj);
  const doe = esc(p.doe ?? p.last_working_day);
  const companyName = esc(p.company_name ?? process.env.VELO_COMPANY_NAME ?? 'Your Company');
  const date = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>Experience Certificate — ${name}</title>${STYLE}</head>
  <body>
    <div class="header-row">
      <h1>${companyName}</h1>
      <div class="muted">To Whom It May Concern</div>
    </div>

    <h2>Experience Certificate</h2>
    <p>This is to certify that <strong>${name}</strong> (Employee ID: ${empId}) was employed with
    ${companyName} as <strong>${designation}</strong>${department ? ` in the ${department} department` : ''}
    from <strong>${doj}</strong> to <strong>${doe}</strong>.</p>

    <p>During the tenure, ${name.split(' ')[0]} demonstrated professionalism and dedication. We wish
    ${name.split(' ')[0]} all the best for future endeavours.</p>

    <div style="margin-top:48px;">
      <p style="margin:0;">Authorised Signatory</p>
      <p style="margin:4px 0 0;">${companyName}</p>
      <p class="muted" style="margin:4px 0 0;">Date: ${date}</p>
    </div>
  </body></html>`;
}

// ── Relieving Letter ──────────────────────────────────────────────────────────

function relievingLetterHtml(p: Record<string, unknown>): string {
  const name = esc(p.employee_name);
  const empId = esc(p.employee_id);
  const designation = esc(p.designation);
  const lwd = esc(p.last_working_day ?? p.doe);
  const companyName = esc(p.company_name ?? process.env.VELO_COMPANY_NAME ?? 'Your Company');
  const date = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>Relieving Letter — ${name}</title>${STYLE}</head>
  <body>
    <div class="header-row">
      <h1>${companyName}</h1>
      <div class="muted">Relieving Letter</div>
    </div>

    <p>Date: <strong>${date}</strong></p>
    <p>To Whom It May Concern,</p>

    <p>This is to certify that <strong>${name}</strong> (Employee ID: ${empId}), who was employed as
    <strong>${designation}</strong> at ${companyName}, has been relieved from their duties effective
    <strong>${lwd}</strong>.</p>

    <p>${name.split(' ')[0]} has been cleared of all dues and liabilities. All company assets have been
    returned and access credentials have been revoked. ${name.split(' ')[0]} is free to join any other
    organization with effect from ${lwd}.</p>

    <p>We wish ${name.split(' ')[0]} the very best in all future endeavours.</p>

    <div style="margin-top:48px;">
      <p style="margin:0;">Authorised Signatory</p>
      <p style="margin:4px 0 0;">${companyName}</p>
    </div>
  </body></html>`;
}

// ─── Document dispatch ─────────────────────────────────────────────────────────

function buildHtml(toolId: string, params: Record<string, unknown>): { html: string; filename: string } {
  if (toolId.includes('salary_slip')) {
    return {
      html: salarySlipHtml(params),
      filename: `salary_slip_${params.employee_id ?? 'emp'}_${params.month ?? ''}_${params.year ?? ''}.html`,
    };
  }
  if (toolId.includes('offer_letter')) {
    const slug = String(params.candidate_name ?? 'candidate').replace(/\s+/g, '_');
    return { html: offerLetterHtml(params), filename: `offer_letter_${slug}.html` };
  }
  if (toolId.includes('experience_certificate')) {
    return {
      html: experienceCertificateHtml(params),
      filename: `experience_certificate_${params.employee_id ?? 'emp'}.html`,
    };
  }
  if (toolId.includes('relieving_letter')) {
    return {
      html: relievingLetterHtml(params),
      filename: `relieving_letter_${params.employee_id ?? 'emp'}.html`,
    };
  }
  // Generic / invoice upload
  const documentId = `doc_${Date.now()}_${Math.random().toString(16).slice(2, 6)}`;
  return {
    html: `<html><body><pre>${esc(JSON.stringify(params, null, 2))}</pre></body></html>`,
    filename: `document_${documentId}.html`,
  };
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function generatePdfDocument(
  params: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const toolId = String(params.tool_id ?? '');
  const { html, filename } = buildHtml(toolId, params);
  const documentId = `doc_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;

  if (useDrive()) {
    try {
      const folderId = process.env.VELO_DRIVE_FOLDER_ID;
      const result = await uploadToDrive(filename, html, folderId);
      return {
        ok: true,
        document_id: documentId,
        file_id: result.file_id,
        url: result.web_view_link,
        download_url: result.download_link,
        filename,
        generated_at: new Date().toISOString(),
        storage: 'google_drive',
      };
    } catch (err) {
      console.error('[documents] Drive upload failed, returning html fallback:', err);
    }
  }

  // Dev fallback — return base64 data URL
  const b64 = Buffer.from(html).toString('base64');
  return {
    ok: true,
    document_id: documentId,
    url: `data:text/html;base64,${b64}`,
    filename,
    generated_at: new Date().toISOString(),
    storage: 'inline',
    note: 'Set GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY + VELO_DRIVE_FOLDER_ID to upload to Drive',
  };
}
