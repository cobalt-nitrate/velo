/**
 * Bulk demo seed for PostgreSQL — every Prisma model gets realistic rows,
 * including founder-relevant edge cases (cash crunch, compliance slips, payroll drama).
 *
 * Lives under scripts/ (not packages). Loads Prisma + bcrypt from packages/web.
 *
 * Usage (from repo root):
 *   pnpm db:seed
 *   pnpm db:seed -- --force   # wipe all rows first
 *
 * Demo login (after seed): founder@demo.velo.local / VeloDemo2026!
 */

import { existsSync } from 'fs';
import { createRequire } from 'module';
import { join, resolve } from 'path';

/** Works when cwd is repo root or packages/web (how `pnpm db:seed` runs). */
function resolveWebRoot(): string {
  const candidates = [join(process.cwd(), 'packages', 'web'), process.cwd()];
  for (const c of candidates) {
    if (existsSync(join(c, 'node_modules', '@prisma', 'client'))) {
      return c;
    }
  }
  throw new Error(
    'Cannot find packages/web/node_modules/@prisma/client. Run `pnpm db:seed` from the repo root.'
  );
}

const webRoot = resolveWebRoot();
const require = createRequire(resolve(join(webRoot, 'package.json')));
const { PrismaClient } = require(join(webRoot, 'node_modules/@prisma/client'));
const bcryptPkg = require(join(webRoot, 'node_modules/bcryptjs'));

/** bcryptjs may export `hash` at root or under `default` (ESM/CJS interop). */
async function bcryptHash(password: string, rounds = 10): Promise<string> {
  const bc = bcryptPkg?.default ?? bcryptPkg;
  const hash = bc.hash ?? bcryptPkg.hash;
  if (typeof hash !== 'function') {
    throw new Error('bcryptjs: no hash() export — check packages/web dependency');
  }
  return hash.call(bc, password, rounds);
}

const prisma = new PrismaClient();

const COMPANY_ID = 'demo-company';
const FORCE =
  process.argv.includes('--force') ||
  process.argv.some((arg: string) => /^--?force$/i.test(arg.trim()));

const day = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
/** ISO timestamp for string-backed log fields */
const dt = (y: number, m: number, d: number, hh = 0, mm = 0, ss = 0, ms = 0) =>
  new Date(y, m - 1, d, hh, mm, ss, ms).toISOString();

const NAMES = [
  ['Aarav', 'Mehta'],
  ['Diya', 'Reddy'],
  ['Kabir', 'Sharma'],
  ['Isha', 'Patel'],
  ['Vihaan', 'Kulkarni'],
  ['Ananya', 'Iyer'],
  ['Reyansh', 'Singh'],
  ['Myra', 'Desai'],
  ['Arjun', 'Nair'],
  ['Kiara', 'Joshi'],
  ['Shaurya', 'Kapoor'],
  ['Pari', 'Malhotra'],
  ['Dev', 'Bhatt'],
  ['Sara', 'Choudhary'],
  ['Om', 'Verma'],
  ['Zara', 'Sen'],
  ['Neil', 'Banerjee'],
  ['Tara', 'Ghosh'],
  ['Vivaan', 'Rao'],
  ['Mira', 'Pillai'],
  ['Yash', 'Menon'],
  ['Rhea', 'Shetty'],
  ['Advik', 'Kaur'],
  ['Navya', 'Thakur'],
];

const DEPTS = ['Engineering', 'Product', 'Design', 'Sales', 'Finance', 'People Ops', 'Customer Success'];
const DESIGNATIONS = [
  'Founder & CEO',
  'Co-founder & CTO',
  'Senior Engineer',
  'Product Manager',
  'Designer',
  'SDR',
  'Finance Lead',
  'People Partner',
  'Support Lead',
  'Intern',
];

async function wipeAll() {
  const del = [
    prisma.chatMessage,
    prisma.chatSession,
    prisma.invite,
    prisma.user,
    prisma.auditEvent,
    prisma.upload,
    prisma.fileLink,
    prisma.notificationLog,
    prisma.policyDocument,
    prisma.policyDecision,
    prisma.agentRunLog,
    prisma.chatLog,
    prisma.auditTrailEntry,
    prisma.filingHistory,
    prisma.tdsRecord,
    prisma.taxObligation,
    prisma.complianceCalendar,
    prisma.gstOutputLedger,
    prisma.gstInputLedger,
    prisma.expenseEntry,
    prisma.hrTask,
    prisma.approvalRequest,
    prisma.attendance,
    prisma.leaveBalance,
    prisma.leaveRecord,
    prisma.salarySlip,
    prisma.payrollRun,
    prisma.arInvoice,
    prisma.apInvoice,
    prisma.bankTransaction,
    prisma.bankPayee,
    prisma.client,
    prisma.vendor,
    prisma.employee,
    prisma.salaryStructure,
    prisma.complianceRule,
    prisma.leaveType,
    prisma.payrollComponent,
    prisma.expenseCategory,
    prisma.taxRate,
    prisma.companySetting,
    prisma.onboardingState,
    prisma.appSettings,
  ] as const;

  await prisma.$transaction(del.map((m) => m.deleteMany()));
}

function money(n: number) {
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

/** Row shapes for arrays Prisma inferred as never[] without annotation */
type BankTxnSeed = {
  txnId: string;
  companyId: string;
  date: string;
  narration: string;
  refNumber: string;
  amount: string;
  balance: string;
  type: string;
  mode: string;
  source: string;
  createdAt: string;
};

type LeaveBalSeed = {
  balanceId: string;
  employeeId: string;
  leaveType: string;
  year: string;
  openingBalance: string;
  accrued: string;
  used: string;
  closingBalance: string;
  lastUpdated: string;
};

type SalarySlipSeed = {
  slipId: string;
  runId: string;
  employeeId: string;
  employeeName: string;
  month: string;
  year: string;
  basic: string;
  hra: string;
  lta: string;
  specialAllowance: string;
  grossSalary: string;
  pfEmployee: string;
  esicEmployee: string;
  pt: string;
  tds: string;
  lopDeduction: string;
  totalDeductions: string;
  netSalary: string;
  workingDays: string;
  lopDays: string;
  driveUrl: string;
  createdAt: string;
};

async function main() {
  if (!FORCE) {
    const [uc, ec] = await Promise.all([prisma.user.count(), prisma.employee.count()]);
    if (uc > 0 || ec > 0) {
      console.error(
        'Database already has users or employees. Re-run with --force to wipe all tables and re-seed:\n' +
          '  pnpm --filter @velo/web db:seed -- --force'
      );
      process.exit(1);
    }
  } else {
    console.log('Wiping all tables…');
    await wipeAll();
  }

  const passwordHash = await bcryptHash('VeloDemo2026!', 10);

  const founder = await prisma.user.create({
    data: {
      email: 'founder@demo.velo.local',
      name: 'Rohan Verma',
      passwordHash,
      role: 'founder',
      sessionVersion: 1,
    },
  });

  await prisma.user.createMany({
    data: [
      {
        email: 'finance@demo.velo.local',
        name: 'Neha Kapoor',
        passwordHash,
        role: 'finance',
      },
      {
        email: 'revoked@demo.velo.local',
        name: 'Former Ops',
        passwordHash,
        role: 'employee',
        revokedAt: new Date('2025-11-01T00:00:00.000Z'),
        revokedBy: founder.id,
      },
      {
        email: 'intern@demo.velo.local',
        name: 'Ayaan Malik',
        passwordHash,
        role: 'employee',
      },
    ],
  });

  const financeUser = await prisma.user.findUniqueOrThrow({
    where: { email: 'finance@demo.velo.local' },
  });

  const inviteTs = Date.now();
  await prisma.invite.createMany({
    data: [
      {
        token: `demo-invite-open-${inviteTs}`,
        role: 'employee',
        email: 'pending-hire@example.com',
        note: 'Offer accepted — waiting on laptop shipment',
        expiresAt: new Date(inviteTs + 14 * 24 * 3600 * 1000),
        createdById: founder.id,
      },
      {
        token: `demo-invite-used-${inviteTs + 1}`,
        role: 'finance',
        email: 'past-hire@example.com',
        expiresAt: new Date(inviteTs - 24 * 3600 * 1000),
        createdById: founder.id,
        consumedAt: new Date('2025-09-15T10:00:00.000Z'),
        consumedBy: financeUser.id,
      },
      {
        token: `demo-invite-expired-${inviteTs + 2}`,
        role: 'employee',
        email: null,
        expiresAt: new Date(inviteTs - 7 * 24 * 3600 * 1000),
        createdById: founder.id,
      },
    ],
  });

  await prisma.onboardingState.upsert({
    where: { id: 'singleton' },
    create: {
      id: 'singleton',
      completed: true,
      completedAt: new Date(),
      currentStep: 4,
      bootstrapInProgress: false,
      sheetsBootstrapped: true,
      seedDataLoaded: true,
      steps: {
        llm: { done: true },
        google: { done: true },
        slack: { done: true, skipped: false },
        roles: { done: true },
        seed: { done: true, skipped: false },
      },
    },
    update: {
      completed: true,
      completedAt: new Date(),
      currentStep: 4,
      sheetsBootstrapped: true,
      seedDataLoaded: true,
      steps: {
        llm: { done: true },
        google: { done: true },
        slack: { done: true, skipped: false },
        roles: { done: true },
        seed: { done: true, skipped: false },
      },
    },
  });

  await prisma.appSettings.upsert({
    where: { id: 'singleton' },
    create: {
      id: 'singleton',
      companyName: 'Novaforge Labs Pvt Ltd',
      defaultAgentId: 'orchestrator',
      defaultCurrency: 'INR',
      defaultActorRole: 'founder',
    },
    update: {
      companyName: 'Novaforge Labs Pvt Ltd',
    },
  });

  await prisma.companySetting.createMany({
    data: [
      {
        key: 'payroll_cycle_day',
        value: '28',
        description: 'Salary credit target day',
        lastUpdated: day(2026, 1, 5),
      },
      {
        key: 'default_state_for_pt',
        value: 'KA',
        description: 'Professional tax state',
        lastUpdated: day(2026, 1, 5),
      },
      {
        key: 'invoice_prefix_ar',
        value: 'NFL-INV',
        description: 'AR invoice numbering',
        lastUpdated: day(2025, 12, 1),
      },
      {
        key: 'cash_runway_weeks_warning',
        value: '10',
        description: 'Alert when runway drops below weeks',
        lastUpdated: day(2026, 3, 1),
      },
    ],
  });

  await prisma.taxRate.createMany({
    data: [
      {
        type: 'GST',
        subtype: 'IGST',
        ratePct: '18',
        stateCode: '',
        salaryMin: '',
        salaryMax: '',
        notes: 'Default B2B services',
      },
      {
        type: 'GST',
        subtype: 'CGST+SGST',
        ratePct: '9+9',
        stateCode: 'KA',
        salaryMin: '',
        salaryMax: '',
        notes: 'Intra-state',
      },
      {
        type: 'TDS',
        subtype: '194J',
        ratePct: '10',
        stateCode: '',
        salaryMin: '',
        salaryMax: '',
        notes: 'Professional fees',
      },
      {
        type: 'TDS',
        subtype: '192',
        ratePct: 'slab',
        stateCode: '',
        salaryMin: '0',
        salaryMax: '500000',
        notes: 'Salary — old regime illustration',
      },
    ],
  });

  await prisma.expenseCategory.createMany({
    data: [
      {
        categoryId: 'CAT-SW',
        label: 'Software & SaaS',
        gstRate: '18',
        itcClaimable: 'yes',
        itcBlockReason: '',
        parentCategory: 'Opex',
      },
      {
        categoryId: 'CAT-TRV',
        label: 'Travel',
        gstRate: '5',
        itcClaimable: 'partial',
        itcBlockReason: 'Missing GST invoice for cab receipts',
        parentCategory: 'Opex',
      },
      {
        categoryId: 'CAT-ENT',
        label: 'Team meals / Events',
        gstRate: '5',
        itcClaimable: 'no',
        itcBlockReason: 'Blocked ITC per policy for entertainment',
        parentCategory: 'People',
      },
      {
        categoryId: 'CAT-CLOUD',
        label: 'Cloud Infra',
        gstRate: '18',
        itcClaimable: 'yes',
        itcBlockReason: '',
        parentCategory: 'COGS',
      },
    ],
  });

  await prisma.payrollComponent.createMany({
    data: [
      {
        componentId: 'BASIC',
        label: 'Basic',
        type: 'earning',
        pctOfCtc: '40',
        pctOfBasic: '100',
        taxable: 'yes',
        pfApplicable: 'yes',
        notes: 'PF base',
      },
      {
        componentId: 'HRA',
        label: 'House Rent Allowance',
        type: 'earning',
        pctOfCtc: '20',
        pctOfBasic: '50',
        taxable: 'partial',
        pfApplicable: 'no',
        notes: 'Metro allowance pattern',
      },
      {
        componentId: 'PF_EE',
        label: 'PF Employee',
        type: 'deduction',
        pctOfCtc: '',
        pctOfBasic: '12',
        taxable: 'no',
        pfApplicable: 'yes',
        notes: 'Statutory',
      },
      {
        componentId: 'TDS',
        label: 'TDS on salary',
        type: 'deduction',
        pctOfCtc: '',
        pctOfBasic: '',
        taxable: 'no',
        pfApplicable: 'no',
        notes: 'Per regime',
      },
    ],
  });

  await prisma.leaveType.createMany({
    data: [
      {
        leaveTypeId: 'LV-PL',
        label: 'Privilege Leave',
        annualEntitlementDays: '18',
        carryForwardMax: '5',
        encashable: 'yes',
        paid: 'yes',
        accrual: 'monthly',
        notes: 'Standard',
      },
      {
        leaveTypeId: 'LV-SL',
        label: 'Sick Leave',
        annualEntitlementDays: '12',
        carryForwardMax: '0',
        encashable: 'no',
        paid: 'yes',
        accrual: 'monthly',
        notes: 'Medical certificate if >2 days',
      },
      {
        leaveTypeId: 'LV-WO',
        label: 'Work off / Comp-off',
        annualEntitlementDays: '0',
        carryForwardMax: '3',
        encashable: 'no',
        paid: 'yes',
        accrual: 'on-demand',
        notes: 'Weekend release crunch',
      },
      {
        leaveTypeId: 'LV-ML',
        label: 'Maternity',
        annualEntitlementDays: '182',
        carryForwardMax: '0',
        encashable: 'no',
        paid: 'yes',
        accrual: 'statutory',
        notes: 'Placeholder row for policy UI',
      },
    ],
  });

  await prisma.complianceRule.createMany({
    data: [
      {
        ruleId: 'RULE-GSTR1',
        label: 'GSTR-1 outward supplies',
        frequency: 'monthly',
        dueDayOfMonth: '11',
        applicableMonths: 'all',
        applicableStates: 'KA',
        portal: 'GST',
        penaltyNotes: 'Late fee + interest',
      },
      {
        ruleId: 'RULE-GSTR3B',
        label: 'GSTR-3B summary',
        frequency: 'monthly',
        dueDayOfMonth: '20',
        applicableMonths: 'all',
        applicableStates: 'KA',
        portal: 'GST',
        penaltyNotes: 'Interest 18% p.a. typical',
      },
      {
        ruleId: 'RULE-TDS24Q',
        label: '24Q salary TDS',
        frequency: 'quarterly',
        dueDayOfMonth: '31',
        applicableMonths: 'Jul,Oct,Jan,Apr',
        applicableStates: 'ALL',
        portal: 'TRACES',
        penaltyNotes: 'Late deposit — section 201',
      },
      {
        ruleId: 'RULE-PF-ECR',
        label: 'PF ECR payment',
        frequency: 'monthly',
        dueDayOfMonth: '15',
        applicableMonths: 'all',
        applicableStates: 'ALL',
        portal: 'EPFO',
        penaltyNotes: 'Damages for delay',
      },
    ],
  });

  await prisma.salaryStructure.createMany({
    data: [
      {
        structureId: 'SS-DEFAULT',
        label: 'Default IC structure',
        description: 'Basic-heavy for PF optimization',
        basicPctOfCtc: '40',
        hraPctOfBasic: '45',
        ltaPctOfCtc: '5',
        specialAllowanceResidual: 'remaining',
        effectiveFrom: day(2025, 4, 1),
        createdAt: day(2025, 4, 1),
      },
      {
        structureId: 'SS-INTERN',
        label: 'Intern / stipend',
        description: 'Minimum wage band — founder asked to keep burn visible',
        basicPctOfCtc: '100',
        hraPctOfBasic: '0',
        ltaPctOfCtc: '0',
        specialAllowanceResidual: '0',
        effectiveFrom: day(2025, 6, 1),
        createdAt: day(2025, 6, 1),
      },
    ],
  });

  const empRows: {
    employeeId: string;
    fullName: string;
    email: string;
    status: string;
    department: string;
    designation: string;
    ctc: string;
    edge?: string;
  }[] = [];

  for (let i = 0; i < NAMES.length; i++) {
    const [first, last] = NAMES[i]!;
    const id = `E${String(i + 1).padStart(3, '0')}`;
    const dept = DEPTS[i % DEPTS.length]!;
    const desig = i === 0 ? 'Founder & CEO' : i === 1 ? 'Co-founder & CTO' : DESIGNATIONS[(i + 3) % DESIGNATIONS.length]!;
    let status = 'active';
    let edge = '';
    if (i === 14) {
      status = 'on_notice';
      edge = 'Retention conversation — competing offer';
    }
    if (i === 18) {
      status = 'inactive';
      edge = 'Exit formalities pending — F&F calculation';
    }
    if (i === 20) {
      status = 'probation';
      edge = 'Mid-term review overdue';
    }
    const ctcBase = 900000 + i * 120000 + (i % 7) * 50000;
    empRows.push({
      employeeId: id,
      fullName: `${first} ${last}`,
      email: `${first.toLowerCase()}.${last.toLowerCase()}@novaforge.demo`,
      status,
      department: dept,
      designation: desig,
      ctc: String(ctcBase),
      edge,
    });
  }

  await prisma.employee.createMany({
    data: empRows.map((e, idx) => ({
      employeeId: e.employeeId,
      fullName: e.fullName,
      email: e.email,
      personalEmail: idx % 5 === 0 ? `${e.fullName.split(' ')[0]!.toLowerCase()}@gmail.com` : '',
      phone: `98${String(70000000 + idx * 137).slice(0, 8)}`,
      dob: day(1992 + (idx % 10), 1 + (idx % 11), 5 + (idx % 20)),
      gender: idx % 3 === 0 ? 'F' : idx % 3 === 1 ? 'M' : 'NB',
      pan: `ABCDE${1234 + idx}${String.fromCharCode(65 + (idx % 26))}`,
      aadhaar: idx === 7 ? '' : `${String(1234 + idx).padStart(4, '0')}${String(5678 + idx).padStart(4, '0')}${String(9012 + idx).padStart(4, '0')}`,
      address: `${100 + idx} MG Road, Bengaluru, KA 560001`,
      designation: e.designation,
      department: e.department,
      reportsTo: idx > 2 ? `E${String(idx < 10 ? 1 : 2).padStart(3, '0')}` : '',
      doj: day(2024, 3 + (idx % 10), 1 + (idx % 25)),
      doe: e.status === 'inactive' ? day(2026, 2, 15) : '',
      status: e.status,
      employmentType: idx % 11 === 0 ? 'contractor' : 'full_time',
      salaryStructureId: idx > 20 ? 'SS-INTERN' : 'SS-DEFAULT',
      ctcAnnualInr: e.ctc,
      pfUan: idx === 3 ? '' : `10${String(123456789012 + idx).slice(0, 12)}`,
      esicIpNumber: idx % 6 === 0 ? `ESIC-${idx}` : '',
      ptApplicable: 'yes',
      tdsRegime: idx % 4 === 0 ? 'new' : 'old',
      bankAccountNumber: idx === 12 ? '' : `${String(402000000000 + idx)}`,
      bankIfsc: idx === 12 ? '' : 'HDFC0001234',
      bankName: idx === 12 ? '' : 'HDFC Bank',
      createdAt: day(2024, 4, 1),
      updatedAt: day(2026, 4, 1),
    })),
  });

  await prisma.vendor.createMany({
    data: [
      {
        vendorId: 'V-AWS',
        vendorName: 'Amazon Web Services India',
        gstin: '29AABCU9603R1ZK',
        pan: 'AABCU9603R',
        bankAccount: '50200011223344',
        ifsc: 'HDFC0000240',
        bankName: 'HDFC',
        paymentTermsDays: '15',
        isPayeeAdded: 'yes',
        contactEmail: 'ap@awsindia.demo',
        contactPhone: '+91-80-0000-0000',
        createdAt: day(2025, 1, 10),
        updatedAt: day(2026, 3, 1),
      },
      {
        vendorId: 'V-ZOOM',
        vendorName: 'Zoom Communications India Pvt Ltd',
        gstin: '27AAACZ1234F1Z5',
        pan: 'AAACZ1234F',
        bankAccount: '',
        ifsc: '',
        bankName: '',
        paymentTermsDays: '0',
        isPayeeAdded: 'no',
        contactEmail: 'billing@zoom.demo',
        contactPhone: '',
        createdAt: day(2025, 6, 1),
        updatedAt: day(2026, 3, 15),
      },
      {
        vendorId: 'V-FREEL',
        vendorName: 'Rahul Dubey — Freelance Designer',
        gstin: '',
        pan: 'AFZPD1234K',
        bankAccount: '39102000005678',
        ifsc: 'SBIN0001234',
        bankName: 'SBI',
        paymentTermsDays: '7',
        isPayeeAdded: 'yes',
        contactEmail: 'rahul.design@demo',
        contactPhone: '9810011223',
        createdAt: day(2025, 8, 20),
        updatedAt: day(2026, 2, 10),
      },
      {
        vendorId: 'V-CATER',
        vendorName: 'FreshBox Catering LLP',
        gstin: '29AABCF1234M1ZV',
        pan: 'AABCF1234M',
        bankAccount: '77770123456789',
        ifsc: 'ICIC000001',
        bankName: 'ICICI',
        paymentTermsDays: '15',
        isPayeeAdded: 'yes',
        contactEmail: 'accounts@freshbox.demo',
        contactPhone: '8044445555',
        createdAt: day(2025, 2, 5),
        updatedAt: day(2026, 1, 20),
      },
    ],
  });

  await prisma.client.createMany({
    data: [
      {
        clientId: 'C-ORBIT',
        clientName: 'OrbitPay Fintech Pvt Ltd',
        gstin: '27AABCO5678N1ZQ',
        pan: 'AABCO5678N',
        billingAddress: 'Tower B, RMZ Ecoworld, Bengaluru',
        state: 'KA',
        contactEmail: 'ap@orbitpay.demo',
        contactPhone: '+91-9876500011',
        paymentTermsDays: '30',
        createdAt: day(2025, 5, 1),
        updatedAt: day(2026, 3, 10),
      },
      {
        clientId: 'C-NORTH',
        clientName: 'Northwind Retail LLC (Import)',
        gstin: '',
        pan: '',
        billingAddress: 'Remote — wire instructions only',
        state: '',
        contactEmail: 'finance@northwind.demo',
        contactPhone: '',
        paymentTermsDays: '45',
        createdAt: day(2025, 9, 12),
        updatedAt: day(2026, 2, 28),
      },
      {
        clientId: 'C-SUJA',
        clientName: 'Suja Enterprises',
        gstin: '33AABCS8899K1ZL',
        pan: 'AABCS8899K',
        billingAddress: 'Chennai, TN',
        state: 'TN',
        contactEmail: 'ceo@suja.demo',
        contactPhone: '9840012345',
        paymentTermsDays: '15',
        createdAt: day(2025, 11, 3),
        updatedAt: day(2026, 3, 5),
      },
    ],
  });

  await prisma.bankPayee.createMany({
    data: [
      {
        payeeId: 'BP-AWS',
        vendorId: 'V-AWS',
        vendorName: 'Amazon Web Services India',
        bankAccount: '50200011223344',
        ifsc: 'HDFC0000240',
        bankName: 'HDFC',
        addedDate: day(2025, 1, 12),
        status: 'active',
        notes: 'Verified via penny drop',
      },
      {
        payeeId: 'BP-FREEL',
        vendorId: 'V-FREEL',
        vendorName: 'Rahul Dubey — Freelance Designer',
        bankAccount: '39102000005678',
        ifsc: 'SBIN0001234',
        bankName: 'SBI',
        addedDate: day(2025, 8, 22),
        status: 'active',
        notes: '',
      },
      {
        payeeId: 'BP-ZOOM-PEND',
        vendorId: 'V-ZOOM',
        vendorName: 'Zoom Communications India Pvt Ltd',
        bankAccount: '',
        ifsc: '',
        bankName: '',
        addedDate: '',
        status: 'pending_verification',
        notes: 'Card on file — migrating to bank transfer',
      },
    ],
  });

  const bankRows: BankTxnSeed[] = [];
  let bal = 4_850_230.55;
  const narrations = [
    ['UPI/salary batch March', 'debit'],
    ['NEFT INFOSYS CLIENT NFL-INV-2403', 'credit'],
    ['AWS EBU BILL', 'debit'],
    ['PG charges Razorpay settlement', 'credit'],
    ['ATM cash withdrawal founder emergency', 'debit'],
    ['Duplicate UPI attempt reversed', 'credit'],
    ['Vendor NEFT V-FREEL', 'debit'],
    ['Interest credit Q4', 'credit'],
  ];
  /** Walk calendar day-by-day so we never emit invalid dates (e.g. Feb 30). */
  const bankDay0 = new Date(2026, 0, 6);
  for (let i = 0; i < 48; i++) {
    const [text, kind] = narrations[i % narrations.length]!;
    const amt =
      kind === 'credit'
        ? 85000 + (i % 9) * 12345 + i * 100
        : -(12000 + (i % 11) * 4500 + i * 77);
    bal += amt;
    const d = new Date(bankDay0);
    d.setDate(d.getDate() + i);
    bankRows.push({
      txnId: `BTX-2026-${String(i + 1).padStart(5, '0')}`,
      companyId: COMPANY_ID,
      date: day(d.getFullYear(), d.getMonth() + 1, d.getDate()),
      narration: `${text} — ref batch ${i}`,
      refNumber: `UTR${String(330001100 + i)}`,
      amount: money(Math.abs(amt)),
      balance: money(Math.round(bal * 100) / 100),
      type: kind === 'credit' ? 'credit' : 'debit',
      mode: i % 5 === 0 ? 'UPI' : i % 5 === 1 ? 'NEFT' : 'ACH',
      source: i % 7 === 0 ? 'manual_csv' : 'bank_feed',
      createdAt: day(2026, 3, 15),
    });
  }
  await prisma.bankTransaction.createMany({ data: bankRows });

  const apLine = (desc: string, qty: string, rate: string, gst: string) =>
    JSON.stringify([{ description: desc, qty, rate, gst_pct: gst }]);

  await prisma.apInvoice.createMany({
    data: [
      {
        invoiceId: 'AP-240315-AWS',
        vendorId: 'V-AWS',
        vendorName: 'Amazon Web Services India',
        invoiceNumber: 'INV-AWS-8839201',
        invoiceDate: day(2026, 3, 5),
        dueDate: day(2026, 3, 20),
        lineItemsJson: apLine('EC2 + RDS Mumbai region', '1', '420000', '18'),
        subtotal: '420000',
        gstAmount: '75600',
        totalAmount: '495600',
        expenseCategory: 'Software & SaaS',
        subCategory: 'Cloud Infra',
        itcClaimable: 'yes',
        itcAmount: '75600',
        paymentStatus: 'paid',
        paymentDate: day(2026, 3, 18),
        bankReference: 'UTR330009991',
        approver: financeUser.email,
        approvedAt: day(2026, 3, 12),
        sourceFileUrl: 'drive://demo/ap/aws-mar.pdf',
        notes: '',
        createdAt: day(2026, 3, 10),
      },
      {
        invoiceId: 'AP-240301-ZOOM',
        vendorId: 'V-ZOOM',
        vendorName: 'Zoom Communications India Pvt Ltd',
        invoiceNumber: 'Z9-22881',
        invoiceDate: day(2026, 3, 1),
        dueDate: day(2026, 3, 10),
        lineItemsJson: apLine('Enterprise plan — 40 hosts', '1', '98000', '18'),
        subtotal: '98000',
        gstAmount: '17640',
        totalAmount: '115640',
        expenseCategory: 'Software & SaaS',
        subCategory: 'Collaboration',
        itcClaimable: 'yes',
        itcAmount: '17640',
        paymentStatus: 'pending_approval',
        paymentDate: '',
        bankReference: '',
        approver: '',
        approvedAt: '',
        sourceFileUrl: '',
        notes: 'Founder wants to downgrade plan — dispute with CS',
        createdAt: day(2026, 3, 2),
      },
      {
        invoiceId: 'AP-240220-CATER',
        vendorId: 'V-CATER',
        vendorName: 'FreshBox Catering LLP',
        invoiceNumber: 'FB-7712',
        invoiceDate: day(2026, 2, 28),
        dueDate: day(2026, 3, 15),
        lineItemsJson: apLine('Offsite lunch — 42 pax', '1', '65000', '5'),
        subtotal: '65000',
        gstAmount: '3250',
        totalAmount: '68250',
        expenseCategory: 'Team meals / Events',
        subCategory: 'Offsite',
        itcClaimable: 'no',
        itcAmount: '0',
        paymentStatus: 'scheduled',
        paymentDate: day(2026, 3, 14),
        bankReference: '',
        approver: founder.email,
        approvedAt: day(2026, 3, 1),
        sourceFileUrl: 'drive://demo/ap/offsite.pdf',
        notes: 'GST line matches policy block for entertainment ITC',
        createdAt: day(2026, 3, 1),
      },
      {
        invoiceId: 'AP-240105-FREEL',
        vendorId: 'V-FREEL',
        vendorName: 'Rahul Dubey — Freelance Designer',
        invoiceNumber: 'RD-2026-014',
        invoiceDate: day(2026, 1, 28),
        dueDate: day(2026, 2, 7),
        lineItemsJson: apLine('Brand refresh — milestone 2', '1', '175000', '18'),
        subtotal: '175000',
        gstAmount: '31500',
        totalAmount: '206500',
        expenseCategory: 'Professional fees',
        subCategory: 'Design',
        itcClaimable: 'yes',
        itcAmount: '31500',
        paymentStatus: 'paid',
        paymentDate: day(2026, 2, 5),
        bankReference: 'UTR330008812',
        approver: financeUser.email,
        approvedAt: day(2026, 2, 1),
        sourceFileUrl: '',
        notes: '194J certificate collected',
        createdAt: day(2026, 1, 29),
      },
    ],
  });

  await prisma.arInvoice.createMany({
    data: [
      {
        invoiceId: 'AR-240301-ORBIT',
        clientId: 'C-ORBIT',
        clientName: 'OrbitPay Fintech Pvt Ltd',
        invoiceNumber: 'NFL-INV-2403',
        invoiceDate: day(2026, 3, 1),
        dueDate: day(2026, 3, 31),
        serviceDescription: 'Managed platform SRE — March',
        subtotal: '850000',
        igst: '153000',
        cgst: '0',
        sgst: '0',
        totalAmount: '1003000',
        status: 'overdue',
        paymentReceivedDate: '',
        bankReference: '',
        followupCount: '4',
        lastFollowupDate: day(2026, 4, 10),
        invoicePdfUrl: 'drive://demo/ar/orbit-mar.pdf',
        createdAt: day(2026, 3, 2),
      },
      {
        invoiceId: 'AR-240215-SUJA',
        clientId: 'C-SUJA',
        clientName: 'Suja Enterprises',
        invoiceNumber: 'NFL-INV-2402b',
        invoiceDate: day(2026, 2, 15),
        dueDate: day(2026, 3, 2),
        serviceDescription: 'Custom integration sprint',
        subtotal: '200000',
        igst: '0',
        cgst: '18000',
        sgst: '18000',
        totalAmount: '236000',
        status: 'paid',
        paymentReceivedDate: day(2026, 3, 5),
        bankReference: 'UTR9988776655',
        followupCount: '1',
        lastFollowupDate: day(2026, 3, 4),
        invoicePdfUrl: '',
        createdAt: day(2026, 2, 16),
      },
      {
        invoiceId: 'AR-240410-NORTH',
        clientId: 'C-NORTH',
        clientName: 'Northwind Retail LLC (Import)',
        invoiceNumber: 'NFL-INV-2404-USD',
        invoiceDate: day(2026, 4, 10),
        dueDate: day(2026, 5, 25),
        serviceDescription: 'USD milestone — exchange gain/loss TBD',
        subtotal: '480000',
        igst: '0',
        cgst: '0',
        sgst: '0',
        totalAmount: '480000',
        status: 'sent',
        paymentReceivedDate: '',
        bankReference: '',
        followupCount: '0',
        lastFollowupDate: '',
        invoicePdfUrl: 'drive://demo/ar/northwind.pdf',
        createdAt: day(2026, 4, 11),
      },
    ],
  });

  await prisma.payrollRun.createMany({
    data: [
      {
        runId: 'PR-2026-02',
        month: '2',
        year: '2026',
        employeeCount: '22',
        totalGross: money(3850000),
        totalDeductions: money(620000),
        totalNet: money(3230000),
        pfEmployerTotal: money(462000),
        esicEmployerTotal: money(48000),
        status: 'approved',
        approvedBy: founder.email,
        approvedAt: day(2026, 2, 28),
        createdAt: day(2026, 2, 25),
      },
      {
        runId: 'PR-2026-03',
        month: '3',
        year: '2026',
        employeeCount: '21',
        totalGross: money(3720000),
        totalDeductions: money(598000),
        totalNet: money(3122000),
        pfEmployerTotal: money(446400),
        esicEmployerTotal: money(41000),
        status: 'processing',
        approvedBy: '',
        approvedAt: '',
        createdAt: day(2026, 3, 28),
      },
      {
        runId: 'PR-2025-12',
        month: '12',
        year: '2025',
        employeeCount: '20',
        totalGross: money(3400000),
        totalDeductions: money(540000),
        totalNet: money(2860000),
        pfEmployerTotal: money(408000),
        esicEmployerTotal: money(39000),
        status: 'locked',
        approvedBy: founder.email,
        approvedAt: day(2025, 12, 28),
        createdAt: day(2025, 12, 22),
      },
    ],
  });

  const slipBase: SalarySlipSeed[] = empRows.slice(0, 12).map((e, i) => {
    const gross = 180000 + i * 9000;
    const ded = 38000 + i * 600;
    return {
      slipId: `SL-${e.employeeId}-202602`,
      runId: 'PR-2026-02',
      employeeId: e.employeeId,
      employeeName: e.fullName,
      month: '2',
      year: '2026',
      basic: money(Math.round(gross * 0.42)),
      hra: money(Math.round(gross * 0.18)),
      lta: money(12000),
      specialAllowance: money(Math.round(gross * 0.25)),
      grossSalary: money(gross),
      pfEmployee: money(1800 + i * 100),
      esicEmployee: i % 6 === 0 ? money(175) : '0',
      pt: money(200),
      tds: money(12000 + i * 400),
      lopDeduction: i === 5 ? money(8500) : '0',
      totalDeductions: money(ded),
      netSalary: money(gross - ded),
      workingDays: '20',
      lopDays: i === 5 ? '1' : '0',
      driveUrl: `drive://demo/payslips/${e.employeeId}-2026-02.pdf`,
      createdAt: day(2026, 3, 1),
    };
  });

  slipBase.push({
    slipId: 'SL-E019-202603-LOP',
    runId: 'PR-2026-03',
    employeeId: 'E019',
    employeeName: 'Vivaan Rao',
    month: '3',
    year: '2026',
    basic: money(98000),
    hra: money(42000),
    lta: money(8000),
    specialAllowance: money(55000),
    grossSalary: money(203000),
    pfEmployee: money(11760),
    esicEmployee: '0',
    pt: money(200),
    tds: money(14500),
    lopDeduction: money(12000),
    totalDeductions: money(38460),
    netSalary: money(164540),
    workingDays: '19',
    lopDays: '1',
    driveUrl: '',
    createdAt: day(2026, 3, 29),
  });

  await prisma.salarySlip.createMany({ data: slipBase });

  await prisma.leaveRecord.createMany({
    data: [
      {
        recordId: 'LR-001',
        employeeId: 'E005',
        employeeName: 'Vihaan Kulkarni',
        leaveType: 'Privilege Leave',
        fromDate: day(2026, 4, 22),
        toDate: day(2026, 4, 24),
        days: '3',
        reason: 'Wedding in family',
        status: 'approved',
        approver: founder.email,
        approvedAt: day(2026, 4, 1),
        createdAt: day(2026, 3, 28),
      },
      {
        recordId: 'LR-002',
        employeeId: 'E011',
        employeeName: 'Shaurya Kapoor',
        leaveType: 'Sick Leave',
        fromDate: day(2026, 4, 8),
        toDate: day(2026, 4, 9),
        days: '2',
        reason: 'Fever',
        status: 'pending',
        approver: '',
        approvedAt: '',
        createdAt: day(2026, 4, 8),
      },
      {
        recordId: 'LR-003',
        employeeId: 'E003',
        employeeName: 'Kabir Sharma',
        leaveType: 'Work off / Comp-off',
        fromDate: day(2026, 3, 30),
        toDate: day(2026, 3, 30),
        days: '1',
        reason: 'Release weekend',
        status: 'rejected',
        approver: founder.email,
        approvedAt: day(2026, 3, 31),
        createdAt: day(2026, 3, 29),
      },
    ],
  });

  const lb: LeaveBalSeed[] = [];
  for (const e of empRows.slice(0, 18)) {
    for (const lt of ['Privilege Leave', 'Sick Leave']) {
      const open = lt === 'Privilege Leave' ? 8 + (parseInt(e.employeeId.slice(1), 10) % 5) : 5;
      const used = lt === 'Privilege Leave' ? 4 : 2;
      lb.push({
        balanceId: `LB-${e.employeeId}-${lt === 'Privilege Leave' ? 'PL' : 'SL'}-2026`,
        employeeId: e.employeeId,
        leaveType: lt,
        year: '2026',
        openingBalance: String(open + used),
        accrued: '1.5',
        used: String(used),
        closingBalance: String(open),
        lastUpdated: day(2026, 4, 1),
      });
    }
  }
  await prisma.leaveBalance.createMany({ data: lb });

  await prisma.attendance.createMany({
    data: empRows.slice(0, 15).map((e, i) => ({
      recordId: `ATT-${e.employeeId}-202603`,
      employeeId: e.employeeId,
      month: '3',
      year: '2026',
      workingDaysInMonth: '22',
      daysPresent: i === 8 ? '19' : '21',
      daysAbsent: i === 8 ? '3' : '1',
      lopDays: i === 8 ? '2' : i === 5 ? '1' : '0',
      wfhDays: i % 4 === 0 ? '6' : '3',
      updatedAt: day(2026, 4, 2),
    })),
  });

  await prisma.approvalRequest.createMany({
    data: [
      {
        approvalId: 'APR-240401-001',
        agentId: 'payroll_agent',
        actionType: 'ISSUE_PAYMENT',
        actionPayloadJson: JSON.stringify({
          vendorId: 'V-ZOOM',
          amount_inr: 115640,
          reason: 'Pay Zoom before service suspension',
        }),
        confidenceScore: '0.72',
        evidenceJson: JSON.stringify([
          { type: 'invoice_match', ref: 'AP-240301-ZOOM' },
          { type: 'budget_head', ref: 'SaaS burn 18% MoM' },
        ]),
        proposedActionText: 'Schedule NEFT to Zoom for INR 1,15,640 on next working day.',
        createdAt: dt(2026, 4, 1, 10, 30),
        expiresAt: dt(2026, 4, 3, 18, 0),
        status: 'PENDING',
        approverRole: 'founder',
        resolvedBy: '',
        resolvedAt: '',
        resolutionNotes: '',
        attachmentDriveUrlsJson: '[]',
      },
      {
        approvalId: 'APR-240315-882',
        agentId: 'collections_agent',
        actionType: 'SEND_DUNNING_EMAIL',
        actionPayloadJson: JSON.stringify({ invoiceId: 'AR-240301-ORBIT', template: 'firm' }),
        confidenceScore: '0.91',
        evidenceJson: '[]',
        proposedActionText: 'Send overdue reminder to OrbitPay AP desk.',
        createdAt: dt(2026, 3, 15, 9, 0),
        expiresAt: dt(2026, 3, 16, 9, 0),
        status: 'APPROVED',
        approverRole: 'founder',
        resolvedBy: founder.email,
        resolvedAt: dt(2026, 3, 15, 11, 12),
        resolutionNotes: 'Approved — tone professional',
        attachmentDriveUrlsJson: '[]',
      },
      {
        approvalId: 'APR-240101-X',
        agentId: 'orchestrator',
        actionType: 'BULK_DELETE_ROWS',
        actionPayloadJson: '{}',
        confidenceScore: '0.41',
        evidenceJson: '[]',
        proposedActionText: 'Blocked destructive action — needs human',
        createdAt: dt(2026, 1, 10, 14, 0),
        expiresAt: dt(2026, 1, 11, 14, 0),
        status: 'REJECTED',
        approverRole: 'founder',
        resolvedBy: founder.email,
        resolvedAt: dt(2026, 1, 10, 15, 5),
        resolutionNotes: 'Reject — too risky',
        attachmentDriveUrlsJson: '[]',
      },
    ],
  });

  await prisma.hrTask.createMany({
    data: [
      {
        taskId: 'HR-E014-EXIT',
        employeeId: 'E018',
        taskType: 'full_and_final',
        description: 'Calculate FnF — notice buyout clause triggered',
        dueDate: day(2026, 4, 20),
        status: 'open',
        completedAt: '',
        notes: 'Waiting asset return — laptop shipped back',
        primaryDriveUrl: 'drive://demo/hr/fnf-e018.xlsx',
        primaryDriveFileId: 'demo-file-fnf',
      },
      {
        taskId: 'HR-E021-PROB',
        employeeId: 'E021',
        taskType: 'probation_review',
        description: 'Schedule 60-day review with manager',
        dueDate: day(2026, 4, 25),
        status: 'in_progress',
        completedAt: '',
        notes: 'Calendar invite pending',
        primaryDriveUrl: '',
        primaryDriveFileId: '',
      },
      {
        taskId: 'HR-ONBOARD-NEW',
        employeeId: 'E004',
        taskType: 'document_collection',
        description: 'Collect Form 11 & previous PF passbook',
        dueDate: day(2026, 4, 18),
        status: 'blocked',
        completedAt: '',
        notes: 'Employee travelling — delayed scan',
        primaryDriveUrl: '',
        primaryDriveFileId: '',
      },
    ],
  });

  await prisma.expenseEntry.createMany({
    data: [
      {
        entryId: 'EXP-001',
        date: day(2026, 3, 5),
        sourceApInvoiceId: 'AP-240315-AWS',
        vendorName: 'Amazon Web Services India',
        category: 'Software & SaaS',
        subCategory: 'Cloud Infra',
        amount: '420000',
        gstAmount: '75600',
        gstRate: '18',
        itcClaimable: 'yes',
        itcAmount: '75600',
        notes: 'Mapped from AP feed',
        createdAt: day(2026, 3, 10),
      },
      {
        entryId: 'EXP-002',
        date: day(2026, 2, 14),
        sourceApInvoiceId: '',
        vendorName: 'Uber India',
        category: 'Travel',
        subCategory: 'Local conveyance',
        amount: '4200',
        gstAmount: '200',
        gstRate: '5',
        itcClaimable: 'partial',
        itcAmount: '0',
        notes: 'Missing GSTIN on invoice — ITC blocked',
        createdAt: day(2026, 2, 15),
      },
    ],
  });

  await prisma.gstInputLedger.createMany({
    data: [
      {
        ledgerId: 'GIN-2403-001',
        apInvoiceId: 'AP-240315-AWS',
        vendorName: 'Amazon Web Services India',
        invoiceDate: day(2026, 3, 5),
        periodMonth: '3',
        periodYear: '2026',
        invoiceAmount: '420000',
        gstAmount: '75600',
        gstRate: '18',
        itcClaimable: 'yes',
        itcClaimed: 'yes',
        itcAmount: '75600',
        category: 'Software & SaaS',
        createdAt: day(2026, 3, 12),
      },
      {
        ledgerId: 'GIN-2403-002',
        apInvoiceId: 'AP-240301-ZOOM',
        vendorName: 'Zoom Communications India Pvt Ltd',
        invoiceDate: day(2026, 3, 1),
        periodMonth: '3',
        periodYear: '2026',
        invoiceAmount: '98000',
        gstAmount: '17640',
        gstRate: '18',
        itcClaimable: 'yes',
        itcClaimed: 'pending',
        itcAmount: '17640',
        category: 'Software & SaaS',
        createdAt: day(2026, 3, 3),
      },
    ],
  });

  await prisma.gstOutputLedger.createMany({
    data: [
      {
        ledgerId: 'GOUT-2403-001',
        arInvoiceId: 'AR-240301-ORBIT',
        clientName: 'OrbitPay Fintech Pvt Ltd',
        invoiceDate: day(2026, 3, 1),
        periodMonth: '3',
        periodYear: '2026',
        taxableAmount: '850000',
        igst: '153000',
        cgst: '0',
        sgst: '0',
        totalGst: '153000',
        createdAt: day(2026, 3, 5),
      },
      {
        ledgerId: 'GOUT-2402-001',
        arInvoiceId: 'AR-240215-SUJA',
        clientName: 'Suja Enterprises',
        invoiceDate: day(2026, 2, 15),
        periodMonth: '2',
        periodYear: '2026',
        taxableAmount: '200000',
        igst: '0',
        cgst: '18000',
        sgst: '18000',
        totalGst: '36000',
        createdAt: day(2026, 2, 20),
      },
    ],
  });

  await prisma.complianceCalendar.createMany({
    data: [
      {
        calendarId: 'CC-GSTR1-0326',
        type: 'GSTR-1',
        label: 'March 2026 outward supplies',
        periodMonth: '3',
        periodYear: '2026',
        dueDate: day(2026, 4, 11),
        status: 'upcoming',
        alertSent7d: 'no',
        alertSent2d: 'no',
        completedDate: '',
        filingReference: '',
        notes: '',
      },
      {
        calendarId: 'CC-GSTR3B-0326',
        type: 'GSTR-3B',
        label: 'March 2026 summary return',
        periodMonth: '3',
        periodYear: '2026',
        dueDate: day(2026, 4, 20),
        status: 'not_started',
        alertSent7d: 'yes',
        alertSent2d: 'no',
        completedDate: '',
        filingReference: '',
        notes: 'ITC reconciliation with AWS / Zoom pending',
      },
      {
        calendarId: 'CC-PF-0326',
        type: 'PF',
        label: 'March ECR deposit',
        periodMonth: '3',
        periodYear: '2026',
        dueDate: day(2026, 4, 15),
        status: 'completed',
        alertSent7d: 'yes',
        alertSent2d: 'yes',
        completedDate: day(2026, 4, 14),
        filingReference: 'ECR881920',
        notes: '',
      },
    ],
  });

  await prisma.taxObligation.createMany({
    data: [
      {
        obligationId: 'TO-GST-NET-0326',
        type: 'GST net liability',
        periodMonth: '3',
        periodYear: '2026',
        dueDate: day(2026, 4, 20),
        amountInr: '77400',
        status: 'estimated',
        paidDate: '',
        paymentReference: '',
        payrollRunId: '',
        createdAt: day(2026, 4, 1),
      },
      {
        obligationId: 'TO-TDS-MAR26',
        type: 'TDS payable (salary)',
        periodMonth: '3',
        periodYear: '2026',
        dueDate: day(2026, 4, 7),
        amountInr: '412000',
        status: 'paid',
        paidDate: day(2026, 4, 6),
        paymentReference: 'CHLN-TDS-338821',
        payrollRunId: 'PR-2026-03',
        createdAt: day(2026, 4, 5),
      },
    ],
  });

  await prisma.tdsRecord.createMany({
    data: empRows.slice(3, 8).map((e, i) => ({
      recordId: `TDS-${e.employeeId}-Q4FY26`,
      employeeId: e.employeeId,
      employeeName: e.fullName,
      periodMonth: '3',
      periodYear: '2026',
      taxableIncomeYtd: money(950000 + i * 40000),
      tdsDeducted: money(85000 + i * 3000),
      tdsDeposited: i === 2 ? '0' : money(85000 + i * 3000),
      quarter: 'Q4',
      challanReference: i === 2 ? '' : `CHLN-2026-Q4-${100 + i}`,
      createdAt: day(2026, 4, 8),
    })),
  });

  await prisma.filingHistory.createMany({
    data: [
      {
        filingId: 'FH-GSTR3B-0226',
        type: 'GSTR-3B',
        period: 'Feb-2026',
        filedDate: day(2026, 3, 18),
        acknowledgementNumber: 'ACK-G3B-992817',
        filedBy: financeUser.email,
        status: 'filed',
        notes: '',
      },
      {
        filingId: 'FH-24Q3',
        type: '24Q',
        period: 'Jan-Mar FY26',
        filedDate: day(2026, 4, 12),
        acknowledgementNumber: 'TRACES-7712',
        filedBy: financeUser.email,
        status: 'accepted',
        notes: '',
      },
    ],
  });

  const sessionOps = await prisma.chatSession.create({
    data: {
      title: 'Runway & collections — April checkpoint',
      agentId: 'orchestrator',
      companyId: COMPANY_ID,
      actorRole: 'founder',
      actorId: founder.id,
    },
  });

  const sessionRev = await prisma.chatSession.create({
    data: {
      title: 'AWS cost anomaly review',
      agentId: 'finance_agent',
      companyId: COMPANY_ID,
      actorRole: 'finance',
      actorId: financeUser.id,
    },
  });

  await prisma.chatMessage.createMany({
    data: [
      {
        sessionId: sessionOps.id,
        role: 'user',
        content:
          'How many weeks of runway if OrbitPay pays next week vs slips another month? Assume burn flat.',
        attachments: [],
        artifacts: [],
        timestamp: new Date('2026-04-12T09:05:00.000Z'),
      },
      {
        sessionId: sessionOps.id,
        role: 'assistant',
        content:
          'If **OrbitPay (10.03L)** lands next week, runway extends roughly **11 weeks** at current net burn. If delayed 30 days, runway drops to **~8 weeks** — recommend accelerating SMB invoices and deferring non-critical SaaS renewals.',
        attachments: [],
        artifacts: [{ type: 'summary_table', id: 'art-1' }],
        timestamp: new Date('2026-04-12T09:05:22.000Z'),
      },
      {
        sessionId: sessionRev.id,
        role: 'user',
        content: 'Flag any AWS line items up >15% MoM.',
        attachments: [],
        artifacts: [],
        timestamp: new Date('2026-04-11T14:12:00.000Z'),
      },
      {
        sessionId: sessionRev.id,
        role: 'assistant',
        content:
          'RDS Multi-AZ charge increased **18% MoM** — likely snapshot retention. EC2 steady. Want me to draft a rightsizing checklist?',
        attachments: [],
        artifacts: [],
        timestamp: new Date('2026-04-11T14:12:18.000Z'),
      },
    ],
  });

  await prisma.upload.createMany({
    data: [
      {
        name: 'bank-statement-mar-2026.pdf',
        mime: 'application/pdf',
        size: 842901,
        path: '.velo/uploads/demo/bank-mar.pdf',
        checksum: 'sha256:demo001',
      },
      {
        name: 'orbitpay-po-signed.png',
        mime: 'image/png',
        size: 192033,
        path: '.velo/uploads/demo/po-orbit.png',
        checksum: 'sha256:demo002',
      },
    ],
  });

  await prisma.auditEvent.createMany({
    data: [
      {
        companyId: COMPANY_ID,
        actorId: founder.id,
        actorRole: 'founder',
        agentId: 'orchestrator',
        eventType: 'SESSION_START',
        sessionId: sessionOps.id,
        payload: { source: 'web', ip_masked: '103.x.x.x' },
      },
      {
        companyId: COMPANY_ID,
        actorId: financeUser.id,
        actorRole: 'finance',
        agentId: 'finance_agent',
        eventType: 'TOOL_RUN',
        sessionId: sessionRev.id,
        payload: { tool: 'sheets.read_range', confidence: 0.88 },
      },
    ],
  });

  await prisma.auditTrailEntry.createMany({
    data: [
      {
        entryId: 'AT-88321',
        timestamp: dt(2026, 4, 10, 15, 22),
        actorId: founder.id,
        actorRole: 'founder',
        agentId: 'orchestrator',
        actionType: 'UPDATE',
        module: 'ap_invoices',
        recordId: 'AP-240301-ZOOM',
        oldValueJson: JSON.stringify({ paymentStatus: 'pending_approval' }),
        newValueJson: JSON.stringify({ paymentStatus: 'pending_approval', notes: 'escalated' }),
        status: 'success',
        sessionId: sessionOps.id,
      },
      {
        entryId: 'AT-88322',
        timestamp: dt(2026, 4, 9, 11, 5),
        actorId: financeUser.id,
        actorRole: 'finance',
        agentId: 'manual',
        actionType: 'CREATE',
        module: 'bank_transactions',
        recordId: 'BTX-2026-00022',
        oldValueJson: '{}',
        newValueJson: '{"source":"manual_csv"}',
        status: 'success',
        sessionId: '',
      },
    ],
  });

  await prisma.chatLog.createMany({
    data: [
      {
        logId: 'CL-22991',
        timestamp: dt(2026, 4, 12, 9, 5),
        sessionId: sessionOps.id,
        actorId: founder.id,
        actorRole: 'founder',
        userMessage: 'How many weeks of runway if OrbitPay pays next week?',
        aiResponse: 'Roughly 11 weeks at flat burn…',
        agentRoutedTo: 'orchestrator',
        actionTaken: 'analysis.runway_estimate',
        actionStatus: 'ok',
      },
      {
        logId: 'CL-22992',
        timestamp: dt(2026, 4, 11, 14, 12),
        sessionId: sessionRev.id,
        actorId: financeUser.id,
        actorRole: 'finance',
        userMessage: 'Flag AWS MoM spikes',
        aiResponse: 'RDS Multi-AZ +18% MoM…',
        agentRoutedTo: 'finance_agent',
        actionTaken: 'tools.sheets_scan',
        actionStatus: 'ok',
      },
    ],
  });

  await prisma.agentRunLog.createMany({
    data: [
      {
        runId: 'RUN-99381',
        timestamp: dt(2026, 4, 12, 9, 5, 10),
        agentId: 'orchestrator',
        sessionId: sessionOps.id,
        inputJson: JSON.stringify({ intent: 'runway_scenario' }),
        outputJson: JSON.stringify({ weeks: 11 }),
        iterations: '3',
        status: 'success',
        confidenceScore: '0.86',
        policyResult: 'ALLOW_READ',
        durationMs: '1420',
      },
      {
        runId: 'RUN-99390',
        timestamp: dt(2026, 4, 10, 18, 1, 0),
        agentId: 'payroll_agent',
        sessionId: '',
        inputJson: '{"action":"finalize_run"}',
        outputJson: '{"error":"missing_approval"}',
        iterations: '1',
        status: 'blocked',
        confidenceScore: '0.55',
        policyResult: 'NEEDS_HUMAN',
        durationMs: '620',
      },
    ],
  });

  await prisma.policyDecision.createMany({
    data: [
      {
        decisionId: 'PD-771',
        timestamp: dt(2026, 4, 12, 9, 5, 11),
        agentId: 'orchestrator',
        actionType: 'READ_SENSITIVE',
        confidenceScore: '0.86',
        actorRole: 'founder',
        policyResult: 'ALLOW',
        overrideApplied: 'no',
        notes: '',
      },
      {
        decisionId: 'PD-772',
        timestamp: dt(2026, 4, 10, 18, 1, 2),
        agentId: 'payroll_agent',
        actionType: 'COMMIT_PAYROLL',
        confidenceScore: '0.55',
        actorRole: 'system',
        policyResult: 'BLOCK',
        overrideApplied: 'no',
        notes: 'Missing dual approval token',
      },
    ],
  });

  await prisma.policyDocument.createMany({
    data: [
      {
        docId: 'POL-V3-2026',
        docType: 'delegation_matrix',
        version: '3.1',
        generatedAt: day(2026, 1, 15),
        generatedBy: founder.email,
        contentMarkdown:
          '# Delegation matrix\n\n| Band | AP approval | Payroll |\n|------|-------------|---------|\n| <2L | Finance | Founder+Finance |\n| 2-5L | Founder | Founder |\n',
        gdriveUrl: 'drive://demo/policy/delegation.md',
      },
    ],
  });

  await prisma.notificationLog.createMany({
    data: [
      {
        notificationId: 'NT-9921',
        timestamp: dt(2026, 4, 10, 8, 0),
        type: 'compliance_due',
        channel: 'email',
        recipient: financeUser.email,
        subject: 'GSTR-3B due in 10 days',
        status: 'delivered',
        relatedRecordId: 'CC-GSTR3B-0326',
      },
      {
        notificationId: 'NT-9922',
        timestamp: dt(2026, 4, 9, 18, 30),
        type: 'slack_digest',
        channel: 'slack',
        recipient: '#finance-ops',
        subject: 'Daily collections summary',
        status: 'failed',
        relatedRecordId: 'AR-240301-ORBIT',
      },
    ],
  });

  await prisma.fileLink.createMany({
    data: [
      {
        linkId: 'FL-001',
        scopeTable: 'ap_invoices',
        scopeRecordId: 'AP-240315-AWS',
        role: 'source_invoice',
        driveFileId: 'demo-drive-aws',
        driveWebViewUrl: 'https://drive.google.com/demo/aws',
        mime: 'application/pdf',
        filename: 'aws-mar.pdf',
        localUploadId: '',
        source: 'gdrive',
        metaJson: '{"pages":3}',
        createdAt: day(2026, 3, 10),
      },
      {
        linkId: 'FL-002',
        scopeTable: 'employees',
        scopeRecordId: 'E018',
        role: 'exit_letter',
        driveFileId: 'demo-drive-exit',
        driveWebViewUrl: 'https://drive.google.com/demo/exit',
        mime: 'application/pdf',
        filename: 'acceptance-letter.pdf',
        localUploadId: '',
        source: 'gdrive',
        metaJson: '{}',
        createdAt: day(2026, 3, 20),
      },
    ],
  });

  console.log('\n✓ Postgres demo seed completed.');
  console.log('  Login: founder@demo.velo.local / VeloDemo2026!');
  console.log(`  Users: 4 | Employees: ${empRows.length} | Bank txns: ${bankRows.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
