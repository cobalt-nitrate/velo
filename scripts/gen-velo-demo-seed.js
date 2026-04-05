#!/usr/bin/env node
/**
 * Writes data/mock/velo-demo-seed.json with rich, cross-linked demo rows.
 * Run: node scripts/gen-velo-demo-seed.js
 *
 * IDs use demo_ / demo- prefixes so you can delete or filter seeded rows in Sheets.
 */
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'data', 'mock', 'velo-demo-seed.json');

const iso = (d) => d.toISOString();
const pad = (n, w = 3) => String(n).padStart(w, '0');

function lineItems(desc, qty, rate, gstPct = 18) {
  return JSON.stringify([{ desc, qty, rate, gst_pct: gstPct }]);
}

/** Running-balance bank rows */
function buildBankTxns(startBal, days = 45) {
  const rows = [];
  let bal = startBal;
  let seq = 100;
  const company = 'demo-company';
  const base = new Date('2026-02-15T06:00:00.000Z');

  const movements = [
    { narr: 'OPENING BAL B/F', amt: 0, type: 'credit', mode: 'system' },
    { narr: 'NEFT CR — HORIZON RETAIL — NVF-FEB26-009', amt: 318000, type: 'credit', mode: 'neft' },
    { narr: 'IFT DR — CloudScale Infra — hosting Feb', amt: -142500.25, type: 'debit', mode: 'imps' },
    { narr: 'NEFT CR — VERTEX MOBILITY — milestone', amt: 189000, type: 'credit', mode: 'neft' },
    { narr: 'GST_PAYMENT Feb-26 combined', amt: -95500, type: 'debit', mode: 'neft' },
    { narr: 'UPI DR — Statutory — professional tax batch', amt: -1200, type: 'debit', mode: 'upi' },
    { narr: 'SALARY — Payroll Feb-26', amt: -598000, type: 'debit', mode: 'neft' },
    { narr: 'IMPS CR — APEX LOGISTICS — INV refund adj', amt: 4500, type: 'credit', mode: 'imps' },
    { narr: 'CARD DR — AWS *Invoice', amt: -88440, type: 'debit', mode: 'card' },
    { narr: 'NEFT CR — HORIZON RETAIL — NVF-MAR26-014', amt: 442600, type: 'credit', mode: 'neft' },
    { narr: 'GST_PAYMENT Mar-26 — CGST+SGST', amt: -128400, type: 'debit', mode: 'neft' },
    { narr: 'IFT — CloudScale Infra — AWS host Mar', amt: -186500.5, type: 'debit', mode: 'imps' },
    { narr: 'PAYOUT — Payroll Mar-26 — batch', amt: -612000, type: 'debit', mode: 'neft' },
    { narr: 'UPI DR — MindCanvas — creative sprint', amt: -88000, type: 'debit', mode: 'upi' },
    { narr: 'IMPS CR — Vertex Mobility — retainer Q2', amt: 275000, type: 'credit', mode: 'imps' },
    { narr: 'ATM WDL — petty cash top-up', amt: -25000, type: 'debit', mode: 'cash' },
    { narr: 'NEFT DR — Kotak — vendor Zenith Supplies', amt: -67320.75, type: 'debit', mode: 'neft' },
    { narr: 'ACH CR — interest credit', amt: 412.33, type: 'credit', mode: 'system' },
    { narr: 'UPI DR — cafeteria vendor', amt: -18450, type: 'debit', mode: 'upi' },
    { narr: 'NEFT DR — ClearTax subscription', amt: -28999, type: 'debit', mode: 'neft' },
    { narr: 'REVERSAL — duplicate IMPS 5544', amt: 275000, type: 'credit', mode: 'system' },
    { narr: 'IMPS DR — reversal settlement', amt: -275000, type: 'debit', mode: 'imps' },
    { narr: 'NEFT CR — Sterling Foods — NVF-APR26-021', amt: 129375, type: 'credit', mode: 'neft' },
    { narr: 'IFT DR — payroll advances clear', amt: -15000, type: 'debit', mode: 'neft' },
    { narr: 'UPI DR — travel reimburse batch', amt: -22340, type: 'debit', mode: 'upi' },
  ];

  for (let i = 0; i < movements.length; i++) {
    const m = movements[i];
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() + Math.min(i, days));
    if (m.amt !== 0) bal += m.amt;
    seq += 1;
    rows.push({
      txn_id: `demo-txn-${pad(seq)}`,
      company_id: company,
      date: d.toISOString().slice(0, 10),
      narration: m.narr,
      ref_number: m.mode === 'system' ? '' : `REF${800000 + seq}`,
      amount: m.amt.toFixed(2),
      balance: bal.toFixed(2),
      type: m.type,
      mode: m.mode,
      source: 'demo_seed',
      created_at: iso(d),
    });
  }

  for (let k = 0; k < 22; k++) {
    const d = new Date('2026-03-01T06:00:00.000Z');
    d.setUTCDate(d.getUTCDate() + k);
    const small =
      k % 3 === 0
        ? { narr: `UPI merchant — snacks wk${k}`, amt: -340 - k * 7, mode: 'upi' }
        : k % 3 === 1
          ? { narr: `NEFT vendor misc — line ${k}`, amt: -4200 - k * 110, mode: 'neft' }
          : { narr: `IMPS CR — misc receipt ${k}`, amt: 5000 + k * 25, mode: 'imps' };
    bal += small.amt;
    seq += 1;
    rows.push({
      txn_id: `demo-txn-${pad(seq)}`,
      company_id: company,
      date: d.toISOString().slice(0, 10),
      narration: small.narr,
      ref_number: `MISC${770000 + k}`,
      amount: small.amt.toFixed(2),
      balance: bal.toFixed(2),
      type: small.amt >= 0 ? 'credit' : 'debit',
      mode: small.mode,
      source: 'demo_seed',
      created_at: iso(d),
    });
  }

  return rows;
}

function main() {
  const employees = [
    ['demo-emp-001', 'Aditi Sharma', 'aditi.s@novaforge-labs.example', 'Head of Engineering', 'Engineering', '', '1992-05-18', 'F', 'demo-struct-senior', 2400000],
    ['demo-emp-002', 'Rohan Mehta', 'rohan.m@novaforge-labs.example', 'Product Lead', 'Product', 'demo-emp-001', '1994-11-02', 'M', 'demo-struct-mid', 1680000],
    ['demo-emp-003', 'Priya Nair', 'priya.n@novaforge-labs.example', 'Finance & Operations Manager', 'Finance', 'demo-emp-001', '1996-02-28', 'F', 'demo-struct-mid', 1320000],
    ['demo-emp-004', 'Vikram Joshi', 'vikram.j@novaforge-labs.example', 'Senior Backend Engineer', 'Engineering', 'demo-emp-001', '1995-07-14', 'M', 'demo-struct-mid', 1560000],
    ['demo-emp-005', 'Neha Kapoor', 'neha.k@novaforge-labs.example', 'People Partner', 'People', 'demo-emp-001', '1991-03-22', 'F', 'demo-struct-mid', 1450000],
    ['demo-emp-006', 'Arjun Desai', 'arjun.d@novaforge-labs.example', 'DevOps Engineer', 'Engineering', 'demo-emp-001', '1993-08-09', 'M', 'demo-struct-mid', 1380000],
    ['demo-emp-007', 'Kavya Iyer', 'kavya.i@novaforge-labs.example', 'Frontend Engineer', 'Engineering', 'demo-emp-001', '1997-01-30', 'F', 'demo-struct-junior', 980000],
    ['demo-emp-008', 'Siddharth Rao', 'siddharth.r@novaforge-labs.example', 'Sales Lead', 'Sales', 'demo-emp-001', '1990-12-05', 'M', 'demo-struct-mid', 1600000],
    ['demo-emp-009', 'Meera Pillai', 'meera.p@novaforge-labs.example', 'Customer Success Manager', 'Customer Success', 'demo-emp-008', '1995-04-17', 'F', 'demo-struct-mid', 1180000],
    ['demo-emp-010', 'Rahul Bhatt', 'rahul.b@novaforge-labs.example', 'Data Analyst', 'Finance', 'demo-emp-003', '1996-10-11', 'M', 'demo-struct-junior', 920000],
    ['demo-emp-011', 'Ananya Ghosh', 'ananya.g@novaforge-labs.example', 'Content Strategist', 'Marketing', 'demo-emp-002', '1994-06-25', 'F', 'demo-struct-mid', 1100000],
    ['demo-emp-012', 'Tarun Sen', 'tarun.s@novaforge-labs.example', 'QA Engineer', 'Engineering', 'demo-emp-001', '1998-02-14', 'M', 'demo-struct-junior', 860000],
    ['demo-emp-013', 'Ishita Malhotra', 'ishita.m@novaforge-labs.example', 'Office & IT Admin', 'Operations', 'demo-emp-003', '1988-09-01', 'F', 'demo-struct-mid', 720000],
    ['demo-emp-014', 'Kabir Anand', 'kabir.a@novaforge-labs.example', 'Intern — Engineering', 'Engineering', 'demo-emp-007', '2002-11-28', 'M', 'demo-struct-intern', 360000],
    ['demo-emp-015', 'Deepa Krishnan', 'deepa.k@novaforge-labs.example', 'Legal Counsel (retainer)', 'Legal', 'demo-emp-001', '1987-07-19', 'F', 'demo-struct-contractor', 2160000],
  ].map(
    ([id, name, email, designation, department, reports_to, dob, gender, struct, ctc], idx) => ({
      employee_id: id,
      full_name: name,
      email,
      personal_email: idx % 4 === 0 ? `${name.split(' ')[0].toLowerCase()}.personal@example.com` : '',
      phone: `+91 9${(8700 + idx).toString().slice(0, 4)} ${(55000 + idx * 127).toString().slice(0, 5)}`,
      dob,
      gender,
      pan: `DEMO${pad(idx + 1)}${String.fromCharCode(65 + (idx % 26))}`,
      aadhaar: idx % 3 === 0 ? `XXXX-XXXX-${pad(4000 + idx, 4)}` : '',
      address: ['Powai Mumbai', 'Whitefield Bengaluru', 'Indiranagar Bengaluru', 'Salt Lake Kolkata', 'Gurugram Haryana'][idx % 5],
      designation,
      department,
      reports_to,
      doj: `202${3 + (idx % 3)}-${pad((idx % 12) + 1, 2)}-${pad((idx % 26) + 1, 2)}`,
      doe: idx === 14 ? '2026-09-30' : '',
      status: idx === 14 ? 'contractor' : 'active',
      employment_type: idx === 14 ? 'contractor' : idx === 13 ? 'intern' : 'full_time',
      salary_structure_id: struct,
      ctc_annual_inr: String(ctc),
      pf_uan: idx === 13 ? '' : `${101234567890 + idx}`,
      esic_ip_number: idx % 7 === 0 ? `ESIC${pad(idx, 6)}` : '',
      pt_applicable: 'yes',
      tds_regime: idx % 5 === 0 ? 'old' : 'new',
      bank_account_number: `${501009870000 + idx * 11111}`,
      bank_ifsc: ['HDFC0001234', 'ICIC0004321', 'SBIN0009876', 'AXIS0002468', 'KKBK0000958'][idx % 5],
      bank_name: ['HDFC Bank', 'ICICI Bank', 'State Bank of India', 'Axis Bank', 'Kotak Mahindra Bank'][idx % 5],
      created_at: '2024-01-15T09:00:00.000Z',
      updated_at: '2026-04-05T10:00:00.000Z',
    })
  );

  const vendors = [
    ['demo-vnd-001', 'CloudScale Infra Solutions LLP', '29AABCUCS01Z2', 'AABCU0001A', 30],
    ['demo-vnd-002', 'MindCanvas Design Studio', '27MCDES9999Z1', 'MCDES0009B', 15],
    ['demo-vnd-003', 'Zenith Office Supplies Pvt Ltd', '27ZENITH8800Z1', 'ZENIT0003C', 15],
    ['demo-vnd-004', 'Metro Legal Partners', '07METRO5555Z2', 'METRO0004D', 7],
    ['demo-vnd-005', 'PixelForge Analytics LLC (India branch)', '29PIXEL7777Z1', 'PIXEL0005E', 30],
    ['demo-vnd-006', 'GreenRoute Fleet Services', '33GREEN2222Z1', 'GREEN0006F', 14],
    ['demo-vnd-007', 'ClearLedger SaaS India', '27CLEAR8888Z1', 'CLEAR0007G', 30],
    ['demo-vnd-008', 'South India Catering Co', '33SOUTH3333Z1', 'SOUTH0008H', 7],
    ['demo-vnd-009', 'SecureAuth ID Services', '29SECAU4444Z1', 'SECUA0009I', 45],
    ['demo-vnd-010', 'WorkWell Ergonomics', '27WORKW6666Z1', 'WORKW0010J', 21],
  ].map(([id, name, gstin, pan, terms], i) => ({
    vendor_id: id,
    vendor_name: name,
    gstin,
    pan,
    bank_account: `${775544330000 + i * 1001}`,
    ifsc: ['YESB0000444', 'KKBK0000958', 'HDFC0001234', 'BARB0CODE12', 'SBIN0001234'][i % 5],
    bank_name: ['Yes Bank', 'Kotak Mahindra Bank', 'HDFC Bank', 'Bank of Baroda', 'SBI'][i % 5],
    payment_terms_days: String(terms),
    is_payee_added: i % 6 === 0 ? 'pending' : 'yes',
    contact_email: `billing-${i}@vendor-demo.example`,
    contact_phone: `+91 80 ${4000 + i} 12${pad(i, 2)}`,
    created_at: '2025-06-01T00:00:00.000Z',
    updated_at: '2026-04-05T00:00:00.000Z',
  }));

  const clients = [
    ['demo-cli-001', 'Horizon Retail India Pvt Ltd', '27AABCHRI1234Z1', 'Maharashtra', 45],
    ['demo-cli-002', 'Vertex Mobility Technologies', '29AABCVX9012Z5', 'Karnataka', 30],
    ['demo-cli-003', 'Sterling Foods & Beverages Ltd', '27STERL4455Z1', 'Maharashtra', 30],
    ['demo-cli-004', 'Apex Logistics Network', '19APEX3311Z1', 'West Bengal', 60],
    ['demo-cli-005', 'Northstar Healthcare Systems', '07NORTH7788Z2', 'Delhi', 15],
    ['demo-cli-006', 'Coastal Finserve NBFC', '29COAST9900Z1', 'Karnataka', 21],
    ['demo-cli-007', 'Orbital EduTech Pvt Ltd', '36ORBTL1122Z1', 'Telangana', 30],
  ].map(([id, name, gstin, state, terms], i) => ({
    client_id: id,
    client_name: name,
    gstin,
    pan: `CLIEN${pad(i + 1)}Z`,
    billing_address: `${['BKC Mumbai', 'Electronic City Bengaluru', 'Pune Camp', 'Howrah', 'Connaught Place', 'Mysore Road', 'Hitech City'][i % 7]} — demo`,
    state,
    contact_email: `ap-${i}@client-demo.example`,
    contact_phone: `+91 22 ${6700 + i} ${1200 + i}`,
    payment_terms_days: String(terms),
    created_at: '2025-04-01T00:00:00.000Z',
    updated_at: '2026-04-05T00:00:00.000Z',
  }));

  const apInvoices = [];
  const gstInRows = [];

  for (let i = 0; i < 18; i++) {
    const v = vendors[i % vendors.length];
    const sub = 12000 + i * 7341;
    const gst = Math.round(sub * 0.18 * 100) / 100;
    const total = sub + gst;
    const statuses = ['pending', 'pending', 'paid', 'pending_approval', 'disputed', 'paid'];
    const st = statuses[i % statuses.length];
    const invId = `demo-ap-${pad(i + 1)}`;
    const invNo = `VND-${2026}-${pad(100 + i)}`;
    const invDate = `2026-0${1 + (i % 3)}-${pad((i % 27) + 1, 2)}`;
    const due = `2026-0${2 + (i % 3)}-${pad((i % 20) + 1, 2)}`;
    const cats = [
      ['technology', 'cloud_infra'],
      ['marketing', 'design'],
      ['operations', 'office_supplies'],
      ['legal', 'professional_fees'],
      ['technology', 'saas'],
      ['operations', 'transport'],
    ];
    const [cat, subcat] = cats[i % cats.length];

    apInvoices.push({
      invoice_id: invId,
      vendor_id: v.vendor_id,
      vendor_name: v.vendor_name,
      invoice_number: invNo,
      invoice_date: invDate,
      due_date: due,
      line_items_json: lineItems(`${subcat.replace(/_/g, ' ')} — period ${i + 1}`, 1, sub),
      subtotal: sub.toFixed(2),
      gst_amount: gst.toFixed(2),
      total_amount: total.toFixed(2),
      expense_category: cat,
      sub_category: subcat,
      itc_claimable: i % 9 === 0 ? 'blocked' : 'yes',
      itc_amount: i % 9 === 0 ? '0' : gst.toFixed(2),
      payment_status: st,
      payment_date: st === 'paid' ? `2026-0${3 + (i % 2)}-${pad(5 + i, 2)}` : '',
      bank_reference: st === 'paid' ? `NEFT${880000 + i}` : '',
      approver: 'priya.n@novaforge-labs.example',
      approved_at: i % 7 === 0 ? '' : '2026-03-18T11:00:00.000Z',
      source_file_url: '',
      notes: i === 0 ? 'Auto-matched to PO demo-po-004 (mock)' : `Batch ${i + 1} — demo`,
      created_at: '2026-03-16T10:00:00.000Z',
    });

    gstInRows.push({
      ledger_id: `demo-gstin-${pad(i + 1)}`,
      ap_invoice_id: invId,
      vendor_name: v.vendor_name,
      invoice_date: invDate,
      period_month: String(1 + (i % 3)),
      period_year: '2026',
      invoice_amount: sub.toFixed(2),
      gst_amount: gst.toFixed(2),
      gst_rate: '18',
      itc_claimable: i % 9 === 0 ? 'no' : 'yes',
      itc_claimed: i % 4 === 0 ? 'yes' : 'no',
      itc_amount: i % 9 === 0 ? '0' : gst.toFixed(2),
      category: subcat,
      created_at: '2026-03-18T00:00:00.000Z',
    });
  }

  const arInvoices = [];
  const gstOutRows = [];
  for (let i = 0; i < 16; i++) {
    const c = clients[i % clients.length];
    const isIgst = c.state !== 'Maharashtra';
    const sub = 88000 + i * 12100;
    const igst = isIgst ? Math.round(sub * 0.18 * 100) / 100 : 0;
    const half = Math.round(sub * 0.09 * 100) / 100;
    const cgst = isIgst ? 0 : half;
    const sgst = isIgst ? 0 : half;
    const total = sub + igst + cgst + sgst;
    const st = ['paid', 'sent', 'overdue', 'partially_paid', 'draft', 'sent'][i % 6];
    const invId = `demo-ar-${pad(i + 1)}`;
    const invNo = `NVF-${['FEB26', 'MAR26', 'APR26', 'MAY26'][i % 4]}-${pad(10 + i)}`;

    arInvoices.push({
      invoice_id: invId,
      client_id: c.client_id,
      client_name: c.client_name,
      invoice_number: invNo,
      invoice_date: `2026-0${1 + (i % 3)}-${pad(3 + i, 2)}`,
      due_date: `2026-0${3 + (i % 2)}-${pad(10 + i, 2)}`,
      service_description: `Professional services — tranche ${i + 1} (${c.client_name})`,
      subtotal: sub.toFixed(2),
      igst: igst.toFixed(2),
      cgst: cgst.toFixed(2),
      sgst: sgst.toFixed(2),
      total_amount: total.toFixed(2),
      status: st,
      payment_received_date: st === 'paid' ? `2026-03-${pad(20 + i, 2)}` : '',
      bank_reference: st === 'paid' ? `NEFT${770000 + i}` : '',
      followup_count: String(i % 3 + (st === 'overdue' ? 2 : 0)),
      last_followup_date: st === 'paid' ? '' : `2026-04-0${1 + (i % 4)}`,
      invoice_pdf_url: '',
      created_at: '2026-03-10T16:00:00.000Z',
    });

    gstOutRows.push({
      ledger_id: `demo-gstout-${pad(i + 1)}`,
      ar_invoice_id: invId,
      client_name: c.client_name,
      invoice_date: `2026-0${1 + (i % 3)}-${pad(3 + i, 2)}`,
      period_month: String(1 + (i % 3)),
      period_year: '2026',
      taxable_amount: sub.toFixed(2),
      igst: igst.toFixed(2),
      cgst: cgst.toFixed(2),
      sgst: sgst.toFixed(2),
      total_gst: (igst + cgst + sgst).toFixed(2),
      created_at: '2026-03-11T12:00:00.000Z',
    });
  }

  const payrollRuns = [
    {
      run_id: 'demo-run-2026-02',
      month: '2',
      year: '2026',
      employee_count: String(employees.length),
      total_gross: '612340.00',
      total_deductions: '138900.00',
      total_net: '473440.00',
      pf_employer_total: '68500.00',
      esic_employer_total: '3200.00',
      status: 'paid',
      approved_by: 'priya.n@novaforge-labs.example',
      approved_at: '2026-02-28T09:00:00.000Z',
      created_at: '2026-02-27T18:00:00.000Z',
    },
    {
      run_id: 'demo-run-2026-03',
      month: '3',
      year: '2026',
      employee_count: String(employees.length),
      total_gross: '598120.00',
      total_deductions: '134500.00',
      total_net: '463620.00',
      pf_employer_total: '66900.00',
      esic_employer_total: '2800.00',
      status: 'paid',
      approved_by: 'priya.n@novaforge-labs.example',
      approved_at: '2026-03-28T09:00:00.000Z',
      created_at: '2026-03-27T18:00:00.000Z',
    },
    {
      run_id: 'demo-run-2026-04',
      month: '4',
      year: '2026',
      employee_count: String(employees.length),
      total_gross: '604000.00',
      total_deductions: '136200.00',
      total_net: '467800.00',
      pf_employer_total: '67200.00',
      esic_employer_total: '2900.00',
      status: 'PENDING_APPROVAL',
      approved_by: 'priya.n@novaforge-labs.example',
      approved_at: '2026-04-05T08:00:00.000Z',
      created_at: '2026-04-04T18:00:00.000Z',
    },
  ];

  const salarySlips = [];
  let slipNum = 0;
  for (const run of payrollRuns) {
    for (let e = 0; e < employees.length; e++) {
      slipNum += 1;
      const emp = employees[e];
      const baseGross = Math.round(parseInt(emp.ctc_annual_inr, 10) / 12 / 100) * 100;
      const basic = Math.round(baseGross * 0.42);
      const hra = Math.round(basic * 0.45);
      const lta = Math.round(baseGross * 0.05);
      const spl = baseGross - basic - hra - lta;
      const pf = Math.min(Math.round(basic * 0.12), 1800 * 12 / 12);
      const pt = 200;
      const tds = Math.round(baseGross * 0.08);
      const ded = pf + pt + tds + (e === 7 ? 1200 : 0);
      const net = baseGross - ded;
      salarySlips.push({
        slip_id: `demo-slip-${pad(slipNum)}`,
        run_id: run.run_id,
        employee_id: emp.employee_id,
        employee_name: emp.full_name,
        month: run.month,
        year: run.year,
        basic: String(basic),
        hra: String(hra),
        lta: String(lta),
        special_allowance: String(spl),
        gross_salary: String(baseGross),
        pf_employee: String(pf),
        esic_employee: e % 7 === 0 ? '210' : '0',
        pt: String(pt),
        tds: String(tds),
        lop_deduction: e === 7 ? '1200' : '0',
        total_deductions: String(ded),
        net_salary: String(net),
        working_days: '26',
        lop_days: e === 7 ? '1' : '0',
        drive_url: '',
        created_at: `${run.year}-${pad(parseInt(run.month, 10), 2)}-28T09:05:00.000Z`,
      });
    }
  }

  const leaveRecords = [];
  const leaveTypes = ['annual', 'sick', 'casual', 'comp_off', 'unpaid'];
  for (let i = 0; i < 28; i++) {
    const emp = employees[i % employees.length];
    leaveRecords.push({
      record_id: `demo-leave-${pad(i + 1)}`,
      employee_id: emp.employee_id,
      employee_name: emp.full_name,
      leave_type: leaveTypes[i % leaveTypes.length],
      from_date: `2026-0${4 + (i % 2)}-${pad(1 + (i % 25), 2)}`,
      to_date: `2026-0${4 + (i % 2)}-${pad(1 + (i % 25) + (i % 3), 2)}`,
      days: String(1 + (i % 3)),
      reason: ['Family', 'Medical', 'Travel', 'Conference', 'Personal'][i % 5],
      status: ['approved', 'pending', 'rejected', 'approved'][i % 4],
      approver: i % 4 === 1 ? '' : 'aditi.s@novaforge-labs.example',
      approved_at: i % 4 === 1 ? '' : '2026-04-02T07:00:00.000Z',
      created_at: '2026-03-28T12:00:00.000Z',
    });
  }

  const leaveBalances = [];
  let lb = 0;
  for (const emp of employees) {
    for (const lt of ['annual', 'sick', 'casual']) {
      lb += 1;
      leaveBalances.push({
        balance_id: `demo-lb-${pad(lb)}`,
        employee_id: emp.employee_id,
        leave_type: lt,
        year: '2026',
        opening_balance: String(8 + (lb % 6)),
        accrued: String(2 + (lb % 3)),
        used: String(lb % 5),
        closing_balance: String(10 + (lb % 4)),
        last_updated: '2026-04-05',
      });
    }
  }

  const attendance = [];
  let attId = 0;
  for (const emp of employees) {
    for (const my of [
      ['3', '2026'],
      ['2', '2026'],
      ['1', '2026'],
    ]) {
      attId += 1;
      const wd = 26;
      const absent = attId % 9 === 0 ? 2 : attId % 11 === 0 ? 1 : 0;
      attendance.push({
        record_id: `demo-att-${pad(attId)}`,
        employee_id: emp.employee_id,
        month: my[0],
        year: my[1],
        working_days_in_month: String(wd),
        days_present: String(wd - absent),
        days_absent: String(absent),
        lop_days: String(absent > 0 ? 1 : 0),
        wfh_days: String((attId % 7) + 1),
        updated_at: '2026-04-01T00:00:00.000Z',
      });
    }
  }

  const approvals = [
    {
      approval_id: 'demo-appr-001',
      agent_id: 'payroll',
      action_type: 'PAYOUT_BATCH',
      action_payload_json: JSON.stringify({ run_id: 'demo-run-2026-04', employee_count: employees.length, total_inr: 467800 }),
      confidence_score: '0.88',
      evidence_json: JSON.stringify({ attendance_ok: true, prior_run: 'demo-run-2026-03' }),
      proposed_action_text: 'Approve April payroll batch for net ₹4.68L',
      created_at: '2026-04-04T10:00:00.000Z',
      expires_at: '2026-04-06T10:00:00.000Z',
      status: 'PENDING',
      approver_role: 'CFO',
      resolved_by: '',
      resolved_at: '',
      resolution_notes: '',
      attachment_drive_urls_json: '',
    },
    {
      approval_id: 'demo-appr-002',
      agent_id: 'ap-invoice',
      action_type: 'VENDOR_PAYMENT',
      action_payload_json: JSON.stringify({ vendor_id: 'demo-vnd-001', amount_inr: 175702, invoice_ids: ['demo-ap-001'] }),
      confidence_score: '0.91',
      evidence_json: JSON.stringify({ bank_balance_ok: true }),
      proposed_action_text: 'Schedule NEFF for CloudScale — demo-ap-001',
      created_at: '2026-04-03T11:00:00.000Z',
      expires_at: '2026-04-05T18:00:00.000Z',
      status: 'PENDING',
      approver_role: 'FINANCE',
      resolved_by: '',
      resolved_at: '',
      resolution_notes: '',
      attachment_drive_urls_json: '[]',
    },
    {
      approval_id: 'demo-appr-003',
      agent_id: 'ar-collections',
      action_type: 'ESCALATE_LEGAL',
      action_payload_json: JSON.stringify({ client_id: 'demo-cli-004', invoice_id: 'demo-ar-013', days_overdue: 62 }),
      confidence_score: '0.62',
      evidence_json: JSON.stringify({ followups: 4, last_reply: null }),
      proposed_action_text: 'Escalate Apex Logistics — invoice overdue 62d',
      created_at: '2026-04-02T09:30:00.000Z',
      expires_at: '2026-04-09T09:30:00.000Z',
      status: 'PENDING',
      approver_role: 'CEO',
      resolved_by: '',
      resolved_at: '',
      resolution_notes: '',
      attachment_drive_urls_json: '',
    },
    {
      approval_id: 'demo-appr-004',
      agent_id: 'compliance',
      action_type: 'FILE_REMINDER',
      action_payload_json: JSON.stringify({ calendar_id: 'demo-cal-020', type: 'gst_gstr3b' }),
      confidence_score: '0.95',
      evidence_json: JSON.stringify({ books_closed_mar: true }),
      proposed_action_text: 'Send GSTR-3B filing pack to CA',
      created_at: '2026-04-01T08:00:00.000Z',
      expires_at: '2026-04-15T08:00:00.000Z',
      status: 'APPROVED',
      approver_role: 'CFO',
      resolved_by: 'priya.n@novaforge-labs.example',
      resolved_at: '2026-04-01T09:00:00.000Z',
      resolution_notes: 'CA loop engaged',
      attachment_drive_urls_json: '',
    },
    {
      approval_id: 'demo-appr-005',
      agent_id: 'runway',
      action_type: 'BUFFER_ALERT',
      action_payload_json: JSON.stringify({ runway_months: 4.2, threshold: 6 }),
      confidence_score: '0.79',
      evidence_json: JSON.stringify({ burn_inr: 1850000, cash_inr: 7_800_000 }),
      proposed_action_text: 'Runway below policy — surface to founder',
      created_at: '2026-03-31T17:00:00.000Z',
      expires_at: '2026-04-07T17:00:00.000Z',
      status: 'REJECTED',
      approver_role: 'CEO',
      resolved_by: 'aditi.s@novaforge-labs.example',
      resolved_at: '2026-04-01T10:00:00.000Z',
      resolution_notes: 'Deferred — fundraising tranche expected',
      attachment_drive_urls_json: '',
    },
  ];

  const hrTasks = [];
  const taskTypes = ['onboarding_docs', 'compliance_training', 'asset_return', 'policy_ack', 'bgv', 'exit_interview'];
  for (let i = 0; i < 22; i++) {
    const emp = employees[i % employees.length];
    hrTasks.push({
      task_id: `demo-hrtask-${pad(i + 1)}`,
      employee_id: emp.employee_id,
      task_type: taskTypes[i % taskTypes.length],
      description: `${taskTypes[i % taskTypes.length].replace(/_/g, ' ')} — ${emp.full_name} (${i + 1})`,
      due_date: `2026-0${4 + (i % 2)}-${pad(5 + (i % 20), 2)}`,
      status: ['open', 'in_progress', 'completed', 'blocked'][i % 4],
      completed_at: i % 4 === 2 ? '2026-04-03T16:00:00.000Z' : '',
      notes: i % 5 === 0 ? 'Waiting on employee upload' : '',
      primary_drive_url: '',
      primary_drive_file_id: '',
    });
  }

  const expenseEntries = apInvoices.slice(0, 14).map((ap, i) => ({
    entry_id: `demo-exp-${pad(i + 1)}`,
    date: ap.invoice_date,
    source_ap_invoice_id: ap.invoice_id,
    vendor_name: ap.vendor_name,
    category: ap.expense_category,
    sub_category: ap.sub_category,
    amount: ap.subtotal,
    gst_amount: ap.gst_amount,
    gst_rate: '18',
    itc_claimable: ap.itc_claimable === 'yes' ? 'yes' : 'no',
    itc_amount: ap.itc_amount,
    notes: `GL bridge ${i + 1}`,
    created_at: ap.created_at,
  }));

  const complianceCal = [];
  const calTypes = ['gst_gstr1', 'gst_gstr3b', 'tds_24q', 'pf_ecr', 'esi', 'pt_mumbai', 'income_tax_advance'];
  for (let i = 0; i < 24; i++) {
    complianceCal.push({
      calendar_id: `demo-cal-${pad(i + 1)}`,
      type: calTypes[i % calTypes.length],
      label: `${calTypes[i % calTypes.length].toUpperCase()} — FY26 slot ${i + 1}`,
      period_month: String(1 + (i % 12)),
      period_year: i > 14 ? '2026' : '2025',
      due_date: `2026-0${(i % 9) + 1}-${pad(10 + (i % 18), 2)}`,
      status: ['pending', 'in_progress', 'filed', 'waived'][i % 4],
      alert_sent_7d: i % 3 === 0 ? 'yes' : 'no',
      alert_sent_2d: i % 5 === 0 ? 'yes' : 'no',
      completed_date: i % 4 === 2 ? `2026-03-${pad(15 + i, 2)}` : '',
      filing_reference: i % 4 === 2 ? `ACK${77000 + i}` : '',
      notes: `Synthetic compliance row ${i + 1}`,
    });
  }

  const taxObligations = [];
  for (let i = 0; i < 14; i++) {
    taxObligations.push({
      obligation_id: `demo-taxobl-${pad(i + 1)}`,
      type: ['gst', 'tds', 'pt', 'advance_tax', 'pf'][i % 5],
      period_month: String(1 + (i % 12)),
      period_year: '2026',
      due_date: `2026-0${(i % 11) + 1}-20`,
      amount_inr: String(15000 + i * 18300),
      status: ['pending', 'paid', 'partial'][i % 3],
      paid_date: i % 3 === 1 ? `2026-0${(i % 11) + 1}-19` : '',
      payment_reference: i % 3 === 1 ? `CHQ${8800 + i}` : '',
      payroll_run_id: i % 4 === 0 ? 'demo-run-2026-03' : '',
      created_at: '2026-01-10T08:00:00.000Z',
    });
  }

  const tdsRecords = [];
  for (let e = 0; e < employees.length; e++) {
    const emp = employees[e];
    for (let q = 0; q < 2; q++) {
      tdsRecords.push({
        record_id: `demo-tds-${pad(tdsRecords.length + 1)}`,
        employee_id: emp.employee_id,
        employee_name: emp.full_name,
        period_month: String(12 - q),
        period_year: '2025',
        taxable_income_ytd: String(420000 + e * 12000 + q * 4000),
        tds_deducted: String(28000 + e * 900 + q * 500),
        tds_deposited: String(27000 + e * 900 + q * 500),
        quarter: `Q${4 - q}`,
        challan_reference: q === 0 ? `CHLN${9900 + e}` : '',
        created_at: '2026-01-05T10:00:00.000Z',
      });
    }
  }

  const filingHistory = [];
  for (let i = 0; i < 20; i++) {
    filingHistory.push({
      filing_id: `demo-filing-${pad(i + 1)}`,
      type: ['gstr1', 'gstr3b', '24q', 'itr_ack'][i % 4],
      period: `2025-${pad((i % 12) + 1, 2)}`,
      filed_date: `2026-0${(i % 6) + 1}-${pad(5 + i, 2)}`,
      acknowledgement_number: `ACK${100000 + i * 173}`,
      filed_by: i % 2 === 0 ? 'ca@partner-firm.example' : 'priya.n@novaforge-labs.example',
      status: ['accepted', 'pending', 'revised'][i % 3],
      notes: i % 3 === 2 ? 'Revised after client data fix' : '',
    });
  }

  const bankPayees = vendors.slice(0, 8).map((v, i) => ({
    payee_id: `demo-payee-${pad(i + 1)}`,
    vendor_id: v.vendor_id,
    vendor_name: v.vendor_name,
    bank_account: v.bank_account,
    ifsc: v.ifsc,
    bank_name: v.bank_name,
    added_date: `2025-${pad(8 + (i % 4), 2)}-10`,
    status: v.is_payee_added === 'yes' ? 'active' : 'pending_verification',
    notes: i % 2 === 0 ? 'Verified via penny drop' : 'Awaiting bank stmt match',
  }));

  const taxRates = [
    { type: 'gst', subtype: 'igst', rate_pct: '18', state_code: '', salary_min: '', salary_max: '', notes: 'Default B2B' },
    { type: 'gst', subtype: 'cgst+sgst', rate_pct: '9+9', state_code: 'MH', salary_min: '', salary_max: '', notes: 'Intra-state' },
    { type: 'tds', subtype: 'salary', rate_pct: 'slab', state_code: '', salary_min: '0', salary_max: '5000000', notes: 'Old/new regime' },
    { type: 'tds', subtype: 'contractor_194j', rate_pct: '10', state_code: '', salary_min: '', salary_max: '', notes: 'Professional' },
    { type: 'pt', subtype: 'mumbai', rate_pct: '200', state_code: 'MH', salary_min: '', salary_max: '', notes: 'Monthly cap' },
    { type: 'pf', subtype: 'employee', rate_pct: '12', state_code: '', salary_min: '', salary_max: '', notes: 'On PF wage base' },
  ].map((r, i) => ({
    ...r,
  }));

  const expenseCategories = [
    ['cat_tech', 'Technology & cloud', '18', 'yes', '', ''],
    ['cat_mkt', 'Marketing & brand', '18', 'yes', '', ''],
    ['cat_ops', 'Operations', '18', 'partial', 'Mixed personal use', ''],
    ['cat_travel', 'Travel', '5', 'no', 'ITC blocked for employee travel', 'cat_ops'],
    ['cat_legal', 'Legal & compliance', '18', 'yes', '', ''],
  ].map(([category_id, label, gst_rate, itc_claimable, itc_block_reason, parent_category]) => ({
    category_id,
    label,
    gst_rate,
    itc_claimable,
    itc_block_reason,
    parent_category,
  }));

  const payrollComponents = [
    ['cmp_basic', 'Basic', 'earning', '40', '0', 'yes', 'yes', ''],
    ['cmp_hra', 'HRA', 'earning', '0', '45', 'yes', 'no', '% of basic'],
    ['cmp_lta', 'LTA', 'earning', '5', '0', 'conditional', 'no', ''],
    ['cmp_pf_er', 'PF employer', 'contribution', '0', '0', 'no', 'yes', 'statutory'],
    ['cmp_bonus', 'Performance bonus', 'earning', '0', '0', 'yes', 'yes', 'ad hoc'],
  ].map(([component_id, label, type, pct_of_ctc, pct_of_basic, taxable, pf_applicable, notes]) => ({
    component_id,
    label,
    type,
    pct_of_ctc,
    pct_of_basic,
    taxable,
    pf_applicable,
    notes,
  }));

  const leaveTypesConfig = [
    ['annual', 'Annual leave', '18', '5', 'yes', 'yes', 'monthly', ''],
    ['sick', 'Sick', '12', '0', 'no', 'yes', 'monthly', ''],
    ['casual', 'Casual', '6', '0', 'no', 'yes', 'fixed', ''],
    ['comp_off', 'Comp off', '0', '3', 'yes', 'yes', 'none', ''],
  ].map(([leave_type_id, label, annual_entitlement_days, carry_forward_max, encashable, paid, accrual, notes]) => ({
    leave_type_id,
    label,
    annual_entitlement_days,
    carry_forward_max,
    encashable,
    paid,
    accrual,
    notes,
  }));

  const complianceRules = [
    ['rule_gstr1', 'GSTR-1', 'monthly', '11', '1,2,3,4,5,6,7,8,9,10,11,12', 'All', 'gst', 'Late fee + interest'],
    ['rule_gstr3b', 'GSTR-3B', 'monthly', '20', '1,2,3,4,5,6,7,8,9,10,11,12', 'All', 'gst', 'Late fee'],
    ['rule_24q', '24Q TDS', 'quarterly', '31', '6,9,12,3', 'All', 'tds', 'Section 276B penalties (illustrative)'],
    ['rule_pf', 'PF ECR', 'monthly', '15', '1,2,3,4,5,6,7,8,9,10,11,12', 'All', 'epfo', 'Damages'],
  ].map(([rule_id, label, frequency, due_day_of_month, applicable_months, applicable_states, portal, penalty_notes]) => ({
    rule_id,
    label,
    frequency,
    due_day_of_month,
    applicable_months,
    applicable_states,
    portal,
    penalty_notes,
  }));

  const companySettingsExtra = [
    { key: 'company_name', value: 'Novaforge Labs Pvt Ltd', description: 'Legal entity for demo', last_updated: '2026-04-01T10:00:00.000Z' },
    { key: 'company_gstin', value: '27AABCNova1Z5', description: 'Demo GSTIN (format only)', last_updated: '2026-04-01T10:00:00.000Z' },
    { key: 'default_currency', value: 'INR', description: 'Reporting currency', last_updated: '2026-04-01T10:00:00.000Z' },
    { key: 'chatbot_escalation_email', value: 'ops@novaforge-labs.example', description: 'Where urgent chats escalate', last_updated: '2026-04-01T10:00:00.000Z' },
    { key: 'runway_cash_buffer_months', value: '6', description: 'Target cash runway (months)', last_updated: '2026-04-01T10:00:00.000Z' },
    { key: 'ap_auto_approve_below_inr', value: '25000', description: 'Policy demo — auto below threshold', last_updated: '2026-04-05T10:00:00.000Z' },
    { key: 'ar_followup_schedule_days', value: '7,14,30', description: 'Dunning cadence', last_updated: '2026-04-05T10:00:00.000Z' },
    { key: 'fiscal_year_start_month', value: '4', description: 'India FY', last_updated: '2026-04-05T10:00:00.000Z' },
    { key: 'demo_feature_flags', value: 'payroll,ap,ar,compliance,helpdesk', description: 'Synthetic', last_updated: '2026-04-05T10:00:00.000Z' },
  ];

  const salaryStructures = [
    ['demo-struct-senior', 'Senior IC / Lead', '40/50 HRA on basic, balance special', '40', '50', '5', 'yes', '2024-04-01', '2024-03-20T00:00:00.000Z'],
    ['demo-struct-mid', 'Mid individual contributor', 'Standard mid-level slab', '45', '40', '5', 'yes', '2024-04-01', '2024-03-20T00:00:00.000Z'],
    ['demo-struct-junior', 'Junior IC', 'Higher basic % for PF', '48', '35', '5', 'yes', '2024-04-01', '2024-03-20T00:00:00.000Z'],
    ['demo-struct-intern', 'Intern stipend', 'Simplified', '80', '0', '0', 'no', '2025-06-01', '2025-05-15T00:00:00.000Z'],
    ['demo-struct-contractor', 'Retainer counsel', 'Professional fees', '100', '0', '0', 'no', '2024-04-01', '2024-03-20T00:00:00.000Z'],
  ].map(([structure_id, label, description, basic_pct_of_ctc, hra_pct_of_basic, lta_pct_of_ctc, special_allowance_residual, effective_from, created_at]) => ({
    structure_id,
    label,
    description,
    basic_pct_of_ctc,
    hra_pct_of_basic,
    lta_pct_of_ctc,
    special_allowance_residual,
    effective_from,
    created_at,
  }));

  const auditTrail = [];
  for (let i = 0; i < 30; i++) {
    auditTrail.push({
      entry_id: `demo-audit-${pad(i + 1)}`,
      timestamp: `2026-04-0${1 + (i % 5)}T${pad(8 + (i % 10))}:${pad((i * 7) % 60, 2)}:00.000Z`,
      actor_id: ['priya.n@novaforge-labs.example', 'aditi.s@novaforge-labs.example', 'system'][i % 3],
      actor_role: ['FINANCE', 'CEO', 'AGENT'][i % 3],
      agent_id: ['payroll', 'ap-invoice', 'compliance', ''][i % 4],
      action_type: ['UPDATE', 'CREATE', 'APPROVE', 'REJECT'][i % 4],
      module: ['transactions', 'master', 'compliance'][i % 3],
      record_id: `demo-rec-${pad(i + 1)}`,
      old_value_json: JSON.stringify({ before: i }),
      new_value_json: JSON.stringify({ after: i + 1 }),
      status: 'ok',
      session_id: `sess-${pad(100 + i)}`,
    });
  }

  const chatLog = [];
  for (let i = 0; i < 20; i++) {
    chatLog.push({
      log_id: `demo-chat-${pad(i + 1)}`,
      timestamp: `2026-04-04T10:${pad((i * 3) % 59, 2)}:00.000Z`,
      session_id: `chat-sess-${(i % 5) + 1}`,
      actor_id: i % 2 === 0 ? 'aditi.s@novaforge-labs.example' : 'priya.n@novaforge-labs.example',
      actor_role: i % 2 === 0 ? 'CEO' : 'FINANCE',
      user_message: ['What is our runway?', 'Show overdue AR', 'Approve payroll', 'Draft vendor email', 'Summarize GST ITC'][i % 5],
      ai_response: ['Draft response with cash + burn...', 'Ageing attached...', 'Approval card prepared...', 'Here is a polite nudge...', 'ITC summary...'][i % 5],
      agent_routed_to: ['runway', 'ar-collections', 'payroll', 'ap-invoice', 'compliance'][i % 5],
      action_taken: i % 3 === 0 ? 'approval_created' : 'answer_only',
      action_status: i % 4 === 0 ? 'error' : 'ok',
    });
  }

  const agentRunLog = [];
  for (let i = 0; i < 18; i++) {
    agentRunLog.push({
      run_id: `demo-agentrun-${pad(i + 1)}`,
      timestamp: `2026-04-05T0${(i % 9) + 1}:15:00.000Z`,
      agent_id: ['ap-invoice', 'ar-collections', 'payroll', 'compliance', 'helpdesk'][i % 5],
      session_id: `sess-run-${(i % 4) + 1}`,
      input_json: JSON.stringify({ prompt_index: i }),
      output_json: JSON.stringify({ steps: 3 + (i % 4), ok: true }),
      iterations: String(2 + (i % 5)),
      status: i % 7 === 0 ? 'failed' : 'success',
      confidence_score: String(0.55 + (i % 40) / 100),
      policy_result: i % 6 === 0 ? 'blocked' : 'allowed',
      duration_ms: String(900 + i * 173),
    });
  }

  const policyDecisions = [];
  for (let i = 0; i < 16; i++) {
    policyDecisions.push({
      decision_id: `demo-poldec-${pad(i + 1)}`,
      timestamp: `2026-04-0${(i % 8) + 1}T11:20:00.000Z`,
      agent_id: ['payroll', 'ap-invoice', 'ar-collections'][i % 3],
      action_type: ['PAYOUT', 'PAY_VENDOR', 'WRITE_OFF'][i % 3],
      confidence_score: String(0.6 + (i % 35) / 100),
      actor_role: 'CFO',
      policy_result: ['auto', 'approval_required', 'denied'][i % 3],
      override_applied: i % 5 === 0 ? 'yes' : 'no',
      notes: i % 5 === 0 ? 'Founder override logged' : '',
    });
  }

  const policyDocuments = [
    {
      doc_id: 'demo-policy-001',
      doc_type: 'posh_policy',
      version: '2026.1',
      generated_at: '2026-04-01T12:00:00.000Z',
      generated_by: 'hr-agent',
      content_markdown: '# POSH Policy (Demo)\n\nNovaforge Labs is committed to a safe workplace.\n\n1. Scope\n2. Complaints\n3. Timeline\n\n_Content shortened for seed._',
      gdrive_url: '',
    },
    {
      doc_id: 'demo-policy-002',
      doc_type: 'remote_work',
      version: '2025.3',
      generated_at: '2026-01-15T09:00:00.000Z',
      generated_by: 'hr-agent',
      content_markdown: '# Remote work guidelines\n\n- Core hours 12–5 IST\n- VPN required\n- Expense rules per finance handbook',
      gdrive_url: '',
    },
  ];

  const notificationLog = [];
  for (let i = 0; i < 25; i++) {
    notificationLog.push({
      notification_id: `demo-notif-${pad(i + 1)}`,
      timestamp: `2026-04-0${(i % 9) + 1}T08:${pad((i * 5) % 59, 2)}:00.000Z`,
      type: ['email', 'slack', 'sms'][i % 3],
      channel: ['ops@novaforge-labs.example', '#finance', '+9198XXXX'][i % 3],
      recipient: ['aditi.s@novaforge-labs.example', 'priya.n@novaforge-labs.example', 'all-managers'][i % 3],
      subject: ['Compliance due', 'Payroll approved', 'AR reminder', 'New vendor bill'][i % 4],
      status: ['sent', 'queued', 'failed'][i % 3],
      related_record_id: `demo-rel-${pad(i + 1)}`,
    });
  }

  const fileLinks = [];
  for (let i = 0; i < 22; i++) {
    fileLinks.push({
      link_id: `demo-fl-${pad(i + 1)}`,
      scope_table: ['approval_request', 'ap_invoices', 'hr_tasks', 'ar_invoices'][i % 4],
      scope_record_id: ['demo-appr-001', 'demo-ap-003', 'demo-hrtask-005', 'demo-ar-008'][i % 4],
      role: ['evidence', 'source_invoice', 'signed_offer', 'client_po'][i % 4],
      drive_file_id: `demo-file-${pad(i + 1)}`,
      drive_web_view_url: `https://drive.google.com/file/d/demo-file-${pad(i + 1)}/view`,
      mime: i % 3 === 0 ? 'text/plain' : 'application/pdf',
      filename: i % 3 === 0 ? `upload_test_${i + 1}.txt` : `evidence_${i + 1}.pdf`,
      local_upload_id: '',
      source: 'demo_seed',
      meta_json: JSON.stringify({ index: i, note: 'illustrative' }),
      created_at: '2026-04-04T10:01:00.000Z',
    });
  }

  const payload = {
    _meta: {
      company: 'Fictitious data for Velo demos — Novaforge Labs theme',
      prefix: 'demo_',
      note: 'Generated by scripts/gen-velo-demo-seed.js. Re-run seed script appends again; delete demo_* rows in Sheets to reset.',
    },
    tables: [
      { envKey: 'SHEETS_CONFIG_ID', sheet: 'company_settings', headers: ['key', 'value', 'description', 'last_updated'], rows: companySettingsExtra },
      { envKey: 'SHEETS_CONFIG_ID', sheet: 'tax_rates', headers: ['type', 'subtype', 'rate_pct', 'state_code', 'salary_min', 'salary_max', 'notes'], rows: taxRates },
      { envKey: 'SHEETS_CONFIG_ID', sheet: 'expense_categories', headers: ['category_id', 'label', 'gst_rate', 'itc_claimable', 'itc_block_reason', 'parent_category'], rows: expenseCategories },
      { envKey: 'SHEETS_CONFIG_ID', sheet: 'payroll_components', headers: ['component_id', 'label', 'type', 'pct_of_ctc', 'pct_of_basic', 'taxable', 'pf_applicable', 'notes'], rows: payrollComponents },
      { envKey: 'SHEETS_CONFIG_ID', sheet: 'leave_types', headers: ['leave_type_id', 'label', 'annual_entitlement_days', 'carry_forward_max', 'encashable', 'paid', 'accrual', 'notes'], rows: leaveTypesConfig },
      { envKey: 'SHEETS_CONFIG_ID', sheet: 'compliance_rules', headers: ['rule_id', 'label', 'frequency', 'due_day_of_month', 'applicable_months', 'applicable_states', 'portal', 'penalty_notes'], rows: complianceRules },
      { envKey: 'SHEETS_MASTER_ID', sheet: 'employees', headers: ['employee_id', 'full_name', 'email', 'personal_email', 'phone', 'dob', 'gender', 'pan', 'aadhaar', 'address', 'designation', 'department', 'reports_to', 'doj', 'doe', 'status', 'employment_type', 'salary_structure_id', 'ctc_annual_inr', 'pf_uan', 'esic_ip_number', 'pt_applicable', 'tds_regime', 'bank_account_number', 'bank_ifsc', 'bank_name', 'created_at', 'updated_at'], rows: employees },
      { envKey: 'SHEETS_MASTER_ID', sheet: 'salary_structures', headers: ['structure_id', 'label', 'description', 'basic_pct_of_ctc', 'hra_pct_of_basic', 'lta_pct_of_ctc', 'special_allowance_residual', 'effective_from', 'created_at'], rows: salaryStructures },
      { envKey: 'SHEETS_MASTER_ID', sheet: 'vendor_master', headers: ['vendor_id', 'vendor_name', 'gstin', 'pan', 'bank_account', 'ifsc', 'bank_name', 'payment_terms_days', 'is_payee_added', 'contact_email', 'contact_phone', 'created_at', 'updated_at'], rows: vendors },
      { envKey: 'SHEETS_MASTER_ID', sheet: 'client_master', headers: ['client_id', 'client_name', 'gstin', 'pan', 'billing_address', 'state', 'contact_email', 'contact_phone', 'payment_terms_days', 'created_at', 'updated_at'], rows: clients },
      { envKey: 'SHEETS_MASTER_ID', sheet: 'bank_payees', headers: ['payee_id', 'vendor_id', 'vendor_name', 'bank_account', 'ifsc', 'bank_name', 'added_date', 'status', 'notes'], rows: bankPayees },
      { envKey: 'SHEETS_TRANSACTIONS_ID', sheet: 'bank_transactions', headers: ['txn_id', 'company_id', 'date', 'narration', 'ref_number', 'amount', 'balance', 'type', 'mode', 'source', 'created_at'], rows: buildBankTxns(1640000) },
      { envKey: 'SHEETS_TRANSACTIONS_ID', sheet: 'ap_invoices', headers: ['invoice_id', 'vendor_id', 'vendor_name', 'invoice_number', 'invoice_date', 'due_date', 'line_items_json', 'subtotal', 'gst_amount', 'total_amount', 'expense_category', 'sub_category', 'itc_claimable', 'itc_amount', 'payment_status', 'payment_date', 'bank_reference', 'approver', 'approved_at', 'source_file_url', 'notes', 'created_at'], rows: apInvoices },
      { envKey: 'SHEETS_TRANSACTIONS_ID', sheet: 'ar_invoices', headers: ['invoice_id', 'client_id', 'client_name', 'invoice_number', 'invoice_date', 'due_date', 'service_description', 'subtotal', 'igst', 'cgst', 'sgst', 'total_amount', 'status', 'payment_received_date', 'bank_reference', 'followup_count', 'last_followup_date', 'invoice_pdf_url', 'created_at'], rows: arInvoices },
      { envKey: 'SHEETS_TRANSACTIONS_ID', sheet: 'payroll_runs', headers: ['run_id', 'month', 'year', 'employee_count', 'total_gross', 'total_deductions', 'total_net', 'pf_employer_total', 'esic_employer_total', 'status', 'approved_by', 'approved_at', 'created_at'], rows: payrollRuns },
      { envKey: 'SHEETS_TRANSACTIONS_ID', sheet: 'salary_slips', headers: ['slip_id', 'run_id', 'employee_id', 'employee_name', 'month', 'year', 'basic', 'hra', 'lta', 'special_allowance', 'gross_salary', 'pf_employee', 'esic_employee', 'pt', 'tds', 'lop_deduction', 'total_deductions', 'net_salary', 'working_days', 'lop_days', 'drive_url', 'created_at'], rows: salarySlips },
      { envKey: 'SHEETS_TRANSACTIONS_ID', sheet: 'leave_records', headers: ['record_id', 'employee_id', 'employee_name', 'leave_type', 'from_date', 'to_date', 'days', 'reason', 'status', 'approver', 'approved_at', 'created_at'], rows: leaveRecords },
      { envKey: 'SHEETS_TRANSACTIONS_ID', sheet: 'leave_balances', headers: ['balance_id', 'employee_id', 'leave_type', 'year', 'opening_balance', 'accrued', 'used', 'closing_balance', 'last_updated'], rows: leaveBalances },
      { envKey: 'SHEETS_TRANSACTIONS_ID', sheet: 'attendance', headers: ['record_id', 'employee_id', 'month', 'year', 'working_days_in_month', 'days_present', 'days_absent', 'lop_days', 'wfh_days', 'updated_at'], rows: attendance },
      { envKey: 'SHEETS_TRANSACTIONS_ID', sheet: 'approval_requests', headers: ['approval_id', 'agent_id', 'action_type', 'action_payload_json', 'confidence_score', 'evidence_json', 'proposed_action_text', 'created_at', 'expires_at', 'status', 'approver_role', 'resolved_by', 'resolved_at', 'resolution_notes', 'attachment_drive_urls_json'], rows: approvals },
      { envKey: 'SHEETS_TRANSACTIONS_ID', sheet: 'hr_tasks', headers: ['task_id', 'employee_id', 'task_type', 'description', 'due_date', 'status', 'completed_at', 'notes', 'primary_drive_url', 'primary_drive_file_id'], rows: hrTasks },
      { envKey: 'SHEETS_TRANSACTIONS_ID', sheet: 'expense_entries', headers: ['entry_id', 'date', 'source_ap_invoice_id', 'vendor_name', 'category', 'sub_category', 'amount', 'gst_amount', 'gst_rate', 'itc_claimable', 'itc_amount', 'notes', 'created_at'], rows: expenseEntries },
      { envKey: 'SHEETS_COMPLIANCE_ID', sheet: 'gst_input_ledger', headers: ['ledger_id', 'ap_invoice_id', 'vendor_name', 'invoice_date', 'period_month', 'period_year', 'invoice_amount', 'gst_amount', 'gst_rate', 'itc_claimable', 'itc_claimed', 'itc_amount', 'category', 'created_at'], rows: gstInRows },
      { envKey: 'SHEETS_COMPLIANCE_ID', sheet: 'gst_output_ledger', headers: ['ledger_id', 'ar_invoice_id', 'client_name', 'invoice_date', 'period_month', 'period_year', 'taxable_amount', 'igst', 'cgst', 'sgst', 'total_gst', 'created_at'], rows: gstOutRows },
      { envKey: 'SHEETS_COMPLIANCE_ID', sheet: 'compliance_calendar', headers: ['calendar_id', 'type', 'label', 'period_month', 'period_year', 'due_date', 'status', 'alert_sent_7d', 'alert_sent_2d', 'completed_date', 'filing_reference', 'notes'], rows: complianceCal },
      { envKey: 'SHEETS_COMPLIANCE_ID', sheet: 'tax_obligations', headers: ['obligation_id', 'type', 'period_month', 'period_year', 'due_date', 'amount_inr', 'status', 'paid_date', 'payment_reference', 'payroll_run_id', 'created_at'], rows: taxObligations },
      { envKey: 'SHEETS_COMPLIANCE_ID', sheet: 'tds_records', headers: ['record_id', 'employee_id', 'employee_name', 'period_month', 'period_year', 'taxable_income_ytd', 'tds_deducted', 'tds_deposited', 'quarter', 'challan_reference', 'created_at'], rows: tdsRecords },
      { envKey: 'SHEETS_COMPLIANCE_ID', sheet: 'filing_history', headers: ['filing_id', 'type', 'period', 'filed_date', 'acknowledgement_number', 'filed_by', 'status', 'notes'], rows: filingHistory },
      { envKey: 'SHEETS_LOGS_ID', sheet: 'audit_trail', headers: ['entry_id', 'timestamp', 'actor_id', 'actor_role', 'agent_id', 'action_type', 'module', 'record_id', 'old_value_json', 'new_value_json', 'status', 'session_id'], rows: auditTrail },
      { envKey: 'SHEETS_LOGS_ID', sheet: 'chat_log', headers: ['log_id', 'timestamp', 'session_id', 'actor_id', 'actor_role', 'user_message', 'ai_response', 'agent_routed_to', 'action_taken', 'action_status'], rows: chatLog },
      { envKey: 'SHEETS_LOGS_ID', sheet: 'agent_run_log', headers: ['run_id', 'timestamp', 'agent_id', 'session_id', 'input_json', 'output_json', 'iterations', 'status', 'confidence_score', 'policy_result', 'duration_ms'], rows: agentRunLog },
      { envKey: 'SHEETS_LOGS_ID', sheet: 'policy_decisions', headers: ['decision_id', 'timestamp', 'agent_id', 'action_type', 'confidence_score', 'actor_role', 'policy_result', 'override_applied', 'notes'], rows: policyDecisions },
      { envKey: 'SHEETS_LOGS_ID', sheet: 'policy_documents', headers: ['doc_id', 'doc_type', 'version', 'generated_at', 'generated_by', 'content_markdown', 'gdrive_url'], rows: policyDocuments },
      { envKey: 'SHEETS_LOGS_ID', sheet: 'notification_log', headers: ['notification_id', 'timestamp', 'type', 'channel', 'recipient', 'subject', 'status', 'related_record_id'], rows: notificationLog },
      { envKey: 'SHEETS_LOGS_ID', sheet: 'file_links', headers: ['link_id', 'scope_table', 'scope_record_id', 'role', 'drive_file_id', 'drive_web_view_url', 'mime', 'filename', 'local_upload_id', 'source', 'meta_json', 'created_at'], rows: fileLinks },
    ],
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  console.log('Wrote', OUT);
  let total = 0;
  for (const t of payload.tables) total += t.rows.length;
  console.log('Tables:', payload.tables.length, 'Total rows:', total);
}

main();
