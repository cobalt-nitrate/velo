# Velo — AI-Powered Back Office Platform
### *Back Office at Velocity for Lean Teams*

---

## 1. What Is Velo?

Velo is a chat-first, AI-powered back office operating system built for lean Indian startups (roughly 3–50 employees). The founder or admin types what they want in plain English — "clear these three invoices", "run payroll for March", "what's my GST due this month" — and Velo figures it out, executes it, and asks for approval only where money actually moves.

Everything that normally lives across government portals, CA inboxes, Excel sheets, and bank dashboards gets unified into one command center. The underlying data stays in Google Sheets (prototype phase), so anyone can open a sheet, audit it, or hand it to their CA without needing a special export.

**No hardcoded business logic anywhere in the app code.** Every tax rate, every expense category, every approval threshold, every payroll rule, every policy template — lives in JSON config files or dedicated Google Sheets config tabs. The application reads config at runtime. Changing a GST rate means editing a cell, not a code deployment.

---

## 2. Who Is This For?

| Persona | Pain |
|---|---|
| Founder / Co-founder | Spends 3–4 hrs/week on invoices, payroll, compliance. Doesn't have a CFO. |
| Office Manager / EA | Manually uploads invoices, chases vendors, fills payroll sheets |
| Part-time CA / Accountant | Needs clean, structured data — not WhatsApp screenshots |

**Sweet spot:** Indian startups, 3–50 employees, spending ₹5K–₹15K/month on back-office software or CA retainer. This replaces most of that.

**Go-to-market starting point:** Early 6-figure ARR companies, bootstrapped or seed-stage.

---

## 3. Four Core Modules

```
┌─────────────────────────────────────────────────────────────┐
│                     VELO PLATFORM                           │
├──────────────┬──────────────┬──────────────┬────────────────┤
│   MODULE 1   │   MODULE 2   │   MODULE 3   │   MODULE 4     │
│     TAX &    │   PAYROLL    │     HR       │   INVOICE &    │
│  COMPLIANCE  │              │  OPERATIONS  │   FINANCE      │
│              │              │              │  (AP/AR/Exp)   │
└──────────────┴──────────────┴──────────────┴────────────────┘
         │                    │
    ┌────┴─────────────────────────┐
    │     AI COMMAND CENTER        │  ← Chat interface (Claude)
    │     DASHBOARD / CONTROL PANEL│  ← Sheets-linked dashboards
    └──────────────────────────────┘
```

---

## 4. Module 1 — Tax & Compliance

### What It Does
Tracks all employer tax obligations — PT, PF, ESIC, TDS — computes them monthly based on payroll, maintains a compliance calendar, and alerts you before due dates. Also tracks GST input credit from expenses and outputs from sales invoices.

### Key Concepts

**Professional Tax (PT)**
- Varies by state. PT slabs (salary bands → tax amount) live in `configs/tax_config.json`, keyed by state code.
- Computed per employee per month. Deducted from salary.
- Monthly/semi-annual filing depending on state.

**Provident Fund (PF)**
- Employee contribution: 12% of basic salary
- Employer contribution: 12% of basic salary (split: 8.33% goes to EPS, 3.67% to EPF)
- Both rates configurable in `configs/tax_config.json`
- Monthly challan filing on EPFO portal

**ESIC**
- Applicable if employee gross salary ≤ ₹21,000/month (threshold configurable)
- Employee: 0.75% of gross | Employer: 3.25% of gross (rates in config)
- Monthly filing

**TDS (Tax Deducted at Source)**
- Deducted from salary based on employee's declared investment proofs and tax slab
- Configurable tax slabs (old vs new regime) in `configs/tax_config.json`
- Quarterly returns (24Q)

**GST Input Credit Ledger**
- Every AP invoice classified by expense category → category maps to GST rate and whether Input Tax Credit (ITC) is claimable
- Mapping lives in `configs/expense_categories.json`
- Example: GPU purchase (18% GST, ITC claimable) vs team party at 5-star (18% GST, ITC NOT claimable under F&B)
- Running ITC balance maintained in `gst_input_ledger` sheet

### Compliance Calendar Logic
- Due dates for every compliance type stored in `configs/compliance_calendar_rules.json`
- Rules like: "PF challan due on 15th of following month", "PT due on last day of month" etc.
- System auto-generates monthly calendar entries in `compliance_calendar` sheet
- Alerts 7 days and 2 days before each due date (configurable lead time in config)

### Phase 2: Portal Connectors
- EPFO portal API integration for PF filing
- TRACES integration for TDS
- GST portal API for GSTR filing
- State-specific PT portal integrations where APIs exist

---

## 5. Module 2 — Payroll

### What It Does
Runs monthly payroll for all active employees: computes gross pay, applies all statutory deductions (PF, PT, ESIC, TDS), produces net pay, generates salary slips, and creates entries in compliance module for all tax obligations.

### Key Concepts

**Salary Structure**
- Every employee has a `salary_structure_id` pointing to a row in the `salary_structures` sheet
- Salary structure defines: Basic, HRA, Special Allowance, LTA, Medical, and any custom components
- Component names and their rules (taxable/non-taxable, % of basic or fixed) live in `configs/payroll_config.json`
- New components can be added by editing config — no code change

**Payroll Run Flow**
1. Trigger: User says "run payroll for March 2025" in chat
2. System pulls all `active` employees from `employees` sheet
3. For each employee:
   - Fetches salary structure
   - Fetches attendance/leave data for the month (from `attendance` sheet)
   - Computes pro-rata if employee joined mid-month (join date from `employees`)
   - Computes LOP (Loss of Pay) deductions for unpaid leaves
   - Applies PF, PT, ESIC, TDS deductions (rates from `tax_config.json`)
   - Computes net pay
4. Generates a payroll run summary row in `payroll_runs` sheet
5. Generates one salary slip row per employee in `salary_slips` sheet
6. Creates compliance obligation entries for PF challan, PT, ESIC, TDS for the month
7. Shows summary to user in chat for approval
8. On approval → marks payroll run as `approved`
9. Salary slip PDFs generated and stored (Phase 2: emailed to employees)

**LOP Logic**
- `leave_types` config defines which leave types are paid vs unpaid
- If employee has exhausted paid leave balance, additional leaves become LOP
- LOP deduction = (Monthly Gross / Working days in month) × LOP days

**Bonus Computation**
- Bonus rules stored in `configs/payroll_config.json` under `bonus_rules`
- Example rule: "festival bonus = 8.33% of annual basic, paid in October"
- One-time bonuses can be triggered via chat: "give Rahul a ₹20,000 performance bonus"

**Payroll Approval Gate**
- No payroll is final without explicit approval in chat or dashboard
- Approval logged with timestamp and approver name in `payroll_runs` sheet

---

## 6. Module 3 — HR Operations

### What It Does
Manages the employee lifecycle (onboarding → exit), leave tracking, HR policy document generation, and basic org structure. This is the source of truth for who works here and what their terms are.

### Key Concepts

**Employee Master**
Each employee record in `employees` sheet stores:
- Personal: Name, DOB, Gender, PAN, Aadhaar, Address
- Employment: Employee ID, Designation, Department, DOJ, DOE (exit), Status
- Compensation: `salary_structure_id`, CTC, effective date
- Statutory: PF UAN, ESIC IP number, PT applicable (Y/N)
- Bank: Account number, IFSC, bank name (for salary credit)

Fields are defined in `configs/employee_fields.json` — adding a new field means editing config.

**Leave Management**
- Leave types (EL, SL, CL, LWP, etc.) and their rules in `configs/leave_types.json`
  - Annual entitlement per leave type
  - Carry-forward limit
  - Whether encashable
  - Whether paid or unpaid
- `leave_balances` sheet: one row per (employee, leave_type, year) with opening, used, closing balance
- `leave_records` sheet: individual leave requests with dates, type, status, approver
- Leave approval flow: Employee requests (chat or form) → Manager approves (chat or link)

**HR Policy Documents**
- Policy templates stored in `configs/policy_templates.json` — markdown templates with placeholders
- Placeholders like `{{company_name}}`, `{{notice_period_days}}`, `{{probation_days}}`
- Company-specific values stored in `configs/company_config.json`
- User can say "generate POSH policy" or "generate leave policy" → AI fills template → produces document
- Generated policies stored in `policy_documents` sheet with version tracking

**Org Chart**
- `employees` sheet has `reports_to` column (Employee ID of manager)
- Org chart rendered from this — no separate table needed

**Onboarding Checklist**
- Onboarding task templates in `configs/onboarding_templates.json`
- When new employee added → system generates checklist entries in `hr_tasks` sheet
- AI can guide through: "start onboarding for Priya joining Monday"

---

## 7. Module 4 — Invoice & Finance

This is the most complex module. It has three sub-modules: **Accounts Payable (AP)**, **Accounts Receivable (AR)**, and **Expense Management**. All three feed into a unified finance dashboard.

---

### 7a. Accounts Payable (AP)

**What It Does:** Manages every invoice you receive from vendors — parsing, classification, approval, payment initiation, and GST input credit capture.

**AP Invoice Flow (Step by Step)**

```
User uploads invoice (image/PDF/text)
        │
        ▼
AI extracts fields:
  vendor name, GSTIN, invoice number,
  invoice date, line items, amounts, GST
        │
        ▼
Vendor lookup in vendor_master sheet
  ├── Found → pull existing vendor details
  └── Not found → prompt user to confirm new vendor
              → add to vendor_master
        │
        ▼
Classify each line item:
  → look up configs/expense_categories.json
  → determine: category, GST rate, ITC claimable (Y/N)
  → if ambiguous → AI asks user to confirm category
        │
        ▼
Create AP invoice entry in ap_invoices sheet:
  status = PENDING_APPROVAL
        │
        ▼
Update gst_input_ledger (if ITC claimable)
Update expense_entries sheet
        │
        ▼
Payment workflow:
  Check vendor in bank_payees sheet
  ├── Payee exists → schedule payment
  │     └── Create approval_requests entry
  │           → Notify user: "₹45,000 to GPU vendor. Approve?"
  │           → On approval → status = APPROVED, schedule execution
  │           → D+1: "Payment ready. Initiate?" → User confirms
  │           → status = INITIATED
  │           → Phase 2: actual bank API call
  └── Payee missing → notify user to add payee in bank portal
        → set reminder (configurable days in workflow_config.json)
        → once confirmed added → proceed above
```

**AP Invoice Fields (in ap_invoices sheet)**
- invoice_id (auto), vendor_id, invoice_number, invoice_date, due_date
- subtotal, gst_amount, total_amount
- expense_category, itc_claimable, itc_amount
- payment_status (PENDING / APPROVED / INITIATED / PAID / OVERDUE)
- payment_date, bank_reference
- approver, approved_at, notes

**Vendor Master Fields**
- vendor_id (auto), vendor_name, GSTIN, PAN
- bank_account, IFSC, bank_name
- payment_terms (days), is_payee_added (Y/N)
- contact_email, contact_phone

---

### 7b. Accounts Receivable (AR)

**What It Does:** Tracks money owed to you — raises invoices to clients, auto-follows up, marks payment received.

**AR Invoice Flow**

```
User: "raise invoice to Acme Corp for ₹2L for dev services for March"
        │
        ▼
AI: pulls client from client_master
  └── Not found → prompts for client GSTIN, address, email
        │
        ▼
Generates invoice:
  - auto-increments invoice number (format in company_config.json)
  - applies GST based on service type + state (inter/intra-state → IGST vs CGST+SGST)
  - creates ar_invoices entry, status = RAISED
        │
        ▼
Sends invoice PDF to client email (Phase 2: actual email)
Currently: generates draft, user sends manually
        │
        ▼
Follow-up schedule created:
  → D+7 reminder, D+14 escalation, D+30 final notice
  (schedule configurable in configs/workflow_config.json)
        │
        ▼
On payment received:
  User: "Acme paid invoice #INV-2025-042"
  → status = PAID, payment_date recorded
  → updates cash position in finance dashboard
```

**AR Invoice Fields**
- invoice_id, client_id, invoice_number, invoice_date, due_date
- service_description, subtotal, igst/cgst/sgst, total
- status (RAISED / OVERDUE / PAID / CANCELLED)
- payment_received_date, bank_reference
- followup_count, last_followup_date

---

### 7c. Expense Management

**What It Does:** Every AP invoice auto-creates an expense entry. Direct expenses (no invoice) can also be logged. Produces monthly expense reports with GST classification.

**Expense Categories Config (`configs/expense_categories.json`)**
```json
{
  "categories": [
    {
      "id": "food_beverages",
      "label": "Food & Beverages",
      "gst_rate": 18,
      "itc_claimable": false,
      "itc_reason": "Section 17(5)(b) - F&B ITC blocked",
      "sub_categories": ["team_meals", "client_entertainment", "office_pantry"]
    },
    {
      "id": "it_hardware",
      "label": "IT Hardware",
      "gst_rate": 18,
      "itc_claimable": true,
      "sub_categories": ["laptops", "gpu", "peripherals", "servers"]
    },
    {
      "id": "travel",
      "label": "Travel & Conveyance",
      "gst_rate": 5,
      "itc_claimable": true,
      "sub_categories": ["flights", "hotels", "cab", "fuel"]
    }
    // ... all categories here, not in code
  ]
}
```

**Monthly Expense Sheet**
- Auto-enriched from AP invoices
- Columns: Date, Vendor, Category, Sub-category, Amount, GST, ITC Claimable, ITC Amount, Notes
- User can open this sheet anytime, download, share with CA
- Dashboard shows: total spend by category, total ITC claimed, top vendors

---

## 8. AI Command Center

### How It Works
- Single chat interface at the top of the app
- User types in plain English (or Hinglish — the AI handles it)
- AI (Claude) interprets intent, extracts entities, maps to one of the four modules, executes the right action
- For destructive or financial actions → AI always asks for explicit confirmation before executing
- All AI interactions logged in `chat_log` sheet with timestamp, user message, AI response, action taken

### Intent Routing Config (`configs/ai_intents.json`)
```json
{
  "intents": [
    {
      "id": "run_payroll",
      "module": "payroll",
      "triggers": ["run payroll", "process payroll", "payroll for"],
      "required_params": ["month", "year"],
      "confirmation_required": true
    },
    {
      "id": "upload_invoice",
      "module": "finance_ap",
      "triggers": ["invoice", "bill", "vendor", "clear payment"],
      "required_params": [],
      "confirmation_required": false
    }
    // all intents here, not in code
  ]
}
```

### Prompt Templates (`configs/prompts_config.json`)
- System prompts for each module live in config
- Extraction prompts (for invoice parsing), classification prompts, summary prompts
- All editable without code changes

### Approval Flow
Every action that moves money or changes final records goes through:
1. AI proposes action with full details
2. User types "yes", "approve", "go ahead" or clicks Approve button
3. Action executes
4. Confirmation + audit trail created

---

## 9. Dashboard / Control Panel

### Structure
Navigation has two top-level items:
1. **Command Center** — the chat interface (default view)
2. **My Dashboard** — tabbed view of all module dashboards

### Dashboard Tabs

**Finance Overview**
- Cash position (AR outstanding vs AP outstanding)
- Top unpaid invoices (AP)
- Overdue AR invoices
- Monthly expense trend (chart)
- ITC balance available

**Payroll**
- Last payroll run status
- Total payroll cost this month
- Next payroll due date
- Headcount breakdown

**Tax & Compliance**
- Compliance calendar — upcoming dues with days remaining
- Color-coded: green (>7 days), amber (3–7 days), red (<3 days)
- GST ITC balance

**HR**
- Active headcount
- Pending leave requests
- Employees on leave today
- Policy documents list

### Sheets Access
- Each dashboard tab has a "Open Sheet" button → opens the underlying Google Sheet
- "Download" button → downloads as CSV/Excel
- All dashboards are read-only aggregations — data lives in sheets, not in the app's own DB

---

## 10. Tech Stack — Prototype

| Layer | Choice | Reason |
|---|---|---|
| Frontend | Next.js (React) | Fast to build, SSR for sheets data |
| Styling | Tailwind CSS | Rapid UI |
| AI | Claude API (Anthropic) | Best instruction-following, handles Hinglish |
| Backend | Google Sheets via Sheets API v4 | Zero infra, shareable, auditable |
| Auth | NextAuth.js with Google OAuth | Same Google account = same Sheets access |
| Config | JSON files in `/configs` directory | No hardcoded logic anywhere in app |
| Hosting | Vercel (free tier) | Zero-config Next.js deployment |
| File parsing | pdf-parse + Tesseract OCR | Invoice PDF/image extraction |

### Why Google Sheets as Backend (Prototype)
- CA/accountant can open it directly — no export needed
- Founder already lives in Google Workspace
- Free, zero-ops
- Easy to migrate to PostgreSQL later: same schema, just swap the data layer

---

## 11. Google Sheets Architecture

### Spreadsheet Layout
One Google Spreadsheet per company (one workspace = one company for now).

```
VELO_[CompanyName]_CONFIG (separate spreadsheet — read-only business rules)
  ├── Sheet: tax_rates
  ├── Sheet: expense_categories
  ├── Sheet: payroll_components
  ├── Sheet: leave_types
  ├── Sheet: compliance_rules
  └── Sheet: company_settings

VELO_[CompanyName]_MASTER (master data)
  ├── Sheet: employees
  ├── Sheet: salary_structures
  ├── Sheet: vendor_master
  └── Sheet: client_master

VELO_[CompanyName]_TRANSACTIONS (all transactional data)
  ├── Sheet: payroll_runs
  ├── Sheet: salary_slips
  ├── Sheet: ap_invoices
  ├── Sheet: ar_invoices
  ├── Sheet: expense_entries
  ├── Sheet: leave_records
  ├── Sheet: leave_balances
  ├── Sheet: attendance
  ├── Sheet: bank_payees
  └── Sheet: approval_requests

VELO_[CompanyName]_COMPLIANCE
  ├── Sheet: tax_obligations
  ├── Sheet: gst_input_ledger
  ├── Sheet: gst_output_ledger
  ├── Sheet: compliance_calendar
  └── Sheet: tds_records

VELO_[CompanyName]_LOGS
  ├── Sheet: chat_log
  ├── Sheet: audit_trail
  └── Sheet: policy_documents
```

### Handling Unstructured Data (Invoices, Policy Docs, etc.)

Unstructured inputs (invoice PDFs, images, free-text) are handled at the API layer, never stored raw in sheets. The flow:

1. **Intake:** File uploaded → stored temporarily (Vercel /tmp or base64 in memory)
2. **Extraction:** AI + OCR extracts structured fields from the unstructured input
3. **Validation:** Extracted fields shown to user for confirmation if confidence < threshold
4. **Storage:** Only the structured, confirmed fields go into sheets
5. **Reference:** Original file stored in Google Drive (auto-created folder per module) — the sheet row contains a `source_file_url` column pointing to Drive

This means sheets stay clean and queryable. The raw files are in Drive, linked from each row.

For policy documents (which are semi-structured text):
- Templates in `configs/policy_templates.json` (markdown with placeholders)
- Generated document stored as a new row in `policy_documents` sheet with: doc_type, version, generated_at, content (markdown text), gdrive_url
- Full text in the sheet column itself (Google Sheets handles long text fine)

---

## 12. JSON Config Files (Full List)

All live in `/configs` directory in the repo. Never hardcoded in app logic.

```
/configs
  ├── company_config.json          ← company name, GSTIN, state, invoice prefix, etc.
  ├── tax_config.json              ← PT slabs by state, PF rates, ESIC rates, TDS slabs
  ├── expense_categories.json      ← all expense categories, GST rates, ITC eligibility
  ├── payroll_config.json          ← salary components, LOP rules, bonus rules
  ├── leave_types.json             ← leave types, entitlements, carry-forward rules
  ├── compliance_calendar_rules.json ← due date rules for each compliance type
  ├── workflow_config.json         ← approval thresholds, follow-up schedules, reminder lead times
  ├── ai_intents.json              ← intent routing for AI command center
  ├── prompts_config.json          ← AI prompt templates for each module action
  ├── employee_fields.json         ← employee master field definitions
  ├── onboarding_templates.json    ← onboarding checklist templates
  └── policy_templates.json        ← HR policy document templates (markdown)
```

---

## 13. Approval & Workflow Governance

### Approval Threshold Rules (`configs/workflow_config.json`)
```json
{
  "approval_rules": [
    {
      "action": "ap_payment",
      "threshold_inr": 0,
      "approvers": ["founder"],
      "requires_confirmation": true
    },
    {
      "action": "payroll_run",
      "threshold_inr": 0,
      "approvers": ["founder"],
      "requires_confirmation": true
    },
    {
      "action": "new_vendor",
      "approvers": ["founder"],
      "requires_confirmation": true
    }
  ],
  "ar_followup_schedule_days": [7, 14, 30],
  "payment_reminder_lead_days": 3,
  "compliance_alert_lead_days": [7, 2]
}
```

Every action with `requires_confirmation: true` creates an entry in `approval_requests` sheet and blocks execution until approved.

### Audit Trail
Every write action creates a row in `audit_trail` sheet:
- timestamp, actor (user email), action_type, module, record_id, old_value, new_value, status

This is append-only. Nothing ever gets deleted from this sheet.

---

## 14. Phase Roadmap

### Phase 0 — Foundation (Now)
- [ ] Set up repo, config files structure, Sheets schema
- [ ] Google Sheets API integration layer
- [ ] Basic Next.js app shell + chat UI
- [ ] Claude API integration with intent routing

### Phase 1 — Core Modules (Prototype)
- [ ] Module 4a: AP invoice upload + classification + expense entry
- [ ] Module 4b: AR invoice generation + follow-up tracking
- [ ] Module 2: Payroll run (manual trigger, approval, salary slip)
- [ ] Module 1: Compliance calendar + tax obligation tracking
- [ ] Module 3: Employee master + leave management
- [ ] Dashboard views for all modules

### Phase 2 — Connectors & Automation
- [ ] Bank portal integrations (payee creation, payment initiation)
- [ ] Email integration (AR follow-ups, salary slips)
- [ ] GST portal API connector
- [ ] EPFO API connector
- [ ] PDF salary slip generation
- [ ] Multi-user / role-based access

### Phase 3 — Managed Service Layer
- [ ] CA/accountant access role (read-only, download)
- [ ] Service layer: on-demand CA consultation booking
- [ ] Compliance managed service (Velo + CA handles filings)

---

## 15. What I Need From You to Start Executing

### One-Time Setup

| # | What | How to Get It to Me |
|---|---|---|
| 1 | **Google Cloud Project** | Create a project at console.cloud.google.com → enable Sheets API + Drive API → create a Service Account → download the JSON key → paste it here |
| 2 | **Company Config** | Tell me: company name, state (for PT), GSTIN (if registered), are you registered for PF/ESIC?, invoice number prefix you want (e.g. INV-2025-) |
| 3 | **AI API Key** | Anthropic API key (claude.ai/settings/keys) — paste it here or I'll set up .env.local |
| 4 | **Module Priority** | Which module do you want working first? Recommendation: start with AP invoices (Module 4a) since it's the most painful daily problem |
| 5 | **Employee List (optional)** | Even a rough CSV: Name, Designation, Monthly CTC, DOJ — we'll onboard them into the sheets |

### One Google Sheet to Create
Create one Google Spreadsheet, name it `VELO_CONFIG`, share it with the service account email (from step 1 above), and send me the spreadsheet URL. I'll set up all the tabs and populate the config.

---

## 16. Folder Structure (Repo)

```
velo/
├── configs/                     ← all JSON business logic configs
│   ├── company_config.json
│   ├── tax_config.json
│   ├── expense_categories.json
│   ├── payroll_config.json
│   ├── leave_types.json
│   ├── compliance_calendar_rules.json
│   ├── workflow_config.json
│   ├── ai_intents.json
│   ├── prompts_config.json
│   ├── employee_fields.json
│   ├── onboarding_templates.json
│   └── policy_templates.json
├── src/
│   ├── app/                     ← Next.js app router
│   │   ├── page.tsx             ← Command center (chat)
│   │   ├── dashboard/
│   │   │   └── page.tsx         ← Dashboard tabs
│   │   └── api/
│   │       ├── chat/route.ts    ← AI command center API
│   │       ├── payroll/route.ts
│   │       ├── invoices/route.ts
│   │       ├── hr/route.ts
│   │       └── compliance/route.ts
│   ├── lib/
│   │   ├── sheets/              ← Google Sheets read/write layer
│   │   │   ├── client.ts        ← authenticated Sheets client
│   │   │   ├── employees.ts
│   │   │   ├── invoices.ts
│   │   │   ├── payroll.ts
│   │   │   └── compliance.ts
│   │   ├── ai/
│   │   │   ├── claude.ts        ← Claude API client
│   │   │   ├── intent-router.ts ← maps user message to module action
│   │   │   └── extractors/      ← invoice extraction, entity extraction
│   │   ├── modules/
│   │   │   ├── payroll.ts       ← payroll computation logic
│   │   │   ├── tax.ts           ← tax computation
│   │   │   ├── invoices.ts      ← AP/AR logic
│   │   │   └── hr.ts            ← HR logic
│   │   └── config/
│   │       └── loader.ts        ← loads and validates all JSON configs
│   └── components/
│       ├── chat/                ← chat UI components
│       ├── dashboard/           ← dashboard tab components
│       └── ui/                  ← shared UI (buttons, modals, etc.)
├── scripts/
│   └── setup-sheets.ts          ← one-time script to create all sheet tabs + headers
├── .env.local.example
├── PLATFORM_PLAN.md             ← this file
└── README.md
```

---

*Last updated: April 2026 | Platform: Velo v0.1 | Status: Planning → Phase 0*
