# Velo — Autonomous Back-Office OS for Startups
### *Always-on. Agentic. Outcome-driven.*

---

## Table of Contents

1. [Product Vision & Definition](#1-product-vision--definition)
2. [Non-Negotiable Principles](#2-non-negotiable-principles)
3. [Target Personas & Jobs-to-be-Done](#3-target-personas--jobs-to-be-done)
4. [Success Metrics](#4-success-metrics)
5. [Agent Architecture](#5-agent-architecture)
6. [ReAct Loop Pattern](#6-react-loop-pattern)
7. [Confidence Scoring System](#7-confidence-scoring-system)
8. [Policy Engine](#8-policy-engine)
9. [User Journeys](#9-user-journeys)
10. [Core Surfaces & UX](#10-core-surfaces--ux)
11. [Onboarding Flow](#11-onboarding-flow)
12. [Module Deep-Dives](#12-module-deep-dives)
13. [Google Sheets Data Architecture](#13-google-sheets-data-architecture)
14. [Config Architecture](#14-config-architecture)
15. [Integration Map](#15-integration-map)
16. [Privacy & DPDPA Compliance](#16-privacy--dpdpa-compliance)
17. [Monorepo Structure](#17-monorepo-structure)
18. [Phase Roadmap](#18-phase-roadmap)
19. [What I Need From You](#19-what-i-need-from-you)

---

## 1. Product Vision & Definition

### What Velo Is

An **always-on agentic operating layer** that:

- **Observes** company money and people events in real time — bank, invoices, payroll, hiring pipeline, statutory calendars
- **Decides** what must happen next (pay, file, notify, remediate) with a quantified confidence score
- **Executes** safely under policy — auto-executes below thresholds, requests approvals above thresholds, never executes on low confidence
- **Explains** every decision with evidence snapshots — transactions, documents, regulatory references
- **Remembers** company-specific patterns — recurring vendors, pay cycles, seasonal revenue — to improve accuracy over time

**This is NOT another HRMS or accounting tool.** Velo is an outcome engine that sits on top of existing systems and takes responsibility for outcomes: payroll run completed, filings submitted, runway visibility maintained. It replaces manual coordination, not the systems of record.

### The Problem It Solves

Early-stage startups (0–100 employees) lose time, money, and confidence across finance + people ops because work is fragmented across:
- GST portal, IT portal, EPFO portal, ESIC portal, bank portal — all separate
- Manual Excel / Sheets for payroll computation
- WhatsApp threads with CA for filing reminders
- No single view of actual cash runway

This creates two existential risks:
- **Cash surprises** — "we didn't realise runway collapsed"
- **Compliance surprises** — GST/TDS/PF/ESI filings missed or incorrect

Velo eliminates both.

### What Velo Guarantees (Outcomes)
- Salaries paid correctly and on time
- Taxes never missed
- Cash runway always clear
- Hiring decisions made with burn impact visibility
- Compliance status always "green"

---

## 2. Non-Negotiable Principles

**1. No navigation as the default**
Users don't "go to payroll" or "go to GST." The OS brings the work to them via notifications, approval cards, and the command feed.

**2. Interfaces are evidence, not workspaces**
Every surface shows: (a) what happened, (b) what will happen, (c) what needs consent. Nothing is a form for data entry.

**3. Policy-first agency**
Every execution is gated by an explicit policy rule. No agent executes money-moving or compliance actions without a policy authorizing it. This directly addresses OWASP's "excessive agency" risk category.

**4. Confidence-gated execution**
Every LLM decision produces a confidence score. Actions below the auto-execute threshold go to approval. Actions below the recommend-only threshold produce no execution — only advice.

**5. Continuous close mentality**
The OS maintains a live view of cash position, payables, receivables, and obligations — not a monthly batch. Month-end is just another day.

**6. India-first compliance realism**
Government portals go down. Validation rules change without notice. The OS adapts: treats portal downtime as a known failure mode (tracked separately from missed deadlines), never promises timelines for government-side actions.

**7. No hardcoding — ever**
Tax rates, expense categories, approval thresholds, payroll components, leave policies, agent prompts, workflow sequences — all live in `/configs`. The application reads config at runtime. Changing a GST rate = editing a JSON cell, not a deployment.

---

## 3. Target Personas & Jobs-to-be-Done

### Personas

| Persona | Role | Primary Pain | Daily Interaction with Velo |
|---|---|---|---|
| **Founder / CEO** | Primary buyer, daily approver | Runway clarity, compliance peace of mind, time wasted on ops | Weekly digest, approval cards, "can I hire?" queries |
| **Finance Lead / CA** | Primary operator | Reconciliation, invoice tracking, filing prep | AP/AR management, compliance calendar, exception queue |
| **HR Lead / People Ops** | Operator | Onboarding friction, leave tracking, policy management | Employee onboarding workflows, leave approvals, helpdesk |
| **Employee** | End user | Payslips, tax planning, leave status, HR queries | Self-serve chat, payslip download, tax saving advice |

### Jobs-to-be-Done

Every JTBD is phrased as an **outcome + decision confidence**:

1. "Tell me my runway today and what decisions change it."
2. "Make sure statutory deadlines are never missed; tell me early when inputs are missing."
3. "Pay people and vendors correctly; surface only unusual changes."
4. "If hiring is off-plan, show why and what to change."
5. "Answer employee questions instantly without creating HR tickets."

---

## 4. Success Metrics

### Outcome Metrics (North Star)
| Metric | Target |
|---|---|
| Missed statutory deadlines per quarter | 0 (track portal downtime separately) |
| Payroll payment success rate | ≥ 99.5% |
| "Runway surprise" incidents (actual vs predicted beyond tolerance) | ~0 |

### Trust & Quality Metrics
| Metric | What It Measures |
|---|---|
| % actions under autopilot vs approval requests | Should rise with trust over time |
| Confidence calibration | Actions taken at low confidence should trend to 0 |
| Reconciliation drift | Delta between OS categorization and CA-corrected labels |

### Retention & Engagement Metrics
| Metric | Target |
|---|---|
| Founder weekly active approvals (not DAU) | At least 1 approval/week |
| Time-to-first-value (TTFV) | < 10 minutes from signup to first runway view |
| Weekly digest open/action rate | > 60% |

---

## 5. Agent Architecture

### Design Principle

> **Every place where an LLM makes a decision is a separate agent.** Each agent has its own system prompt, its own tool set, its own confidence scoring, and its own input/output schema. Agents can call other agents. No business logic is shared via globals — only via typed interfaces.

### Agent Map

```
┌─────────────────────────────────────────────────────────────────────┐
│                    USER INPUT (Chat / Notification action)          │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │   OrchestratorAgent    │  Routes intent → specialist
              │   (Intent Router)      │
              └──────┬─────────────────┘
                     │
        ┌────────────┼──────────────────────────────────┐
        │            │                    │              │
        ▼            ▼                    ▼              ▼
   ┌─────────┐  ┌──────────┐  ┌──────────────┐  ┌─────────────┐
   │ Runway  │  │Compliance│  │  PayrollAgent│  │   HRAgent   │
   │  Agent  │  │  Agent   │  │              │  │             │
   └─────────┘  └──────────┘  └──────────────┘  └──────┬──────┘
                                                        │
                                              ┌─────────▼──────────┐
                                              │ DocumentGenerator  │
                                              │     SubAgent       │
                                              └────────────────────┘
        │            │
        ▼            ▼
   ┌─────────┐  ┌──────────────────────────────────────────────────┐
   │   AR    │  │              APInvoiceAgent                      │
   │Collecti-│  │                                                  │
   │onsAgent │  │  ┌─────────────────┐  ┌──────────────────────┐  │
   └─────────┘  │  │InvoiceExtractor │  │ ExpenseClassifier    │  │
                │  │   SubAgent      │  │   SubAgent           │  │
                │  └─────────────────┘  └──────────────────────┘  │
                │  ┌─────────────────┐  ┌──────────────────────┐  │
                │  │ VendorMatcher   │  │ DuplicateDetector    │  │
                │  │   SubAgent      │  │   SubAgent           │  │
                │  └─────────────────┘  └──────────────────────┘  │
                └──────────────────────────────────────────────────┘
        │
        ▼
   ┌──────────────┐    ┌─────────────────┐
   │HelpdeskAgent │    │ TaxPlanningAgent │
   │ (Employee    │    │ (Employee tax    │
   │  self-serve) │    │  optimization)   │
   └──────────────┘    └─────────────────┘

   ──────────────────────────────────────────
   CROSS-CUTTING (every agent goes through these):
   ┌─────────────┐  ┌────────────────┐  ┌──────────────┐
   │PolicyEngine │  │ConfidenceScorer│  │ AuditLogger  │
   │ (no LLM)    │  │  (no LLM)      │  │ (append-only)│
   └─────────────┘  └────────────────┘  └──────────────┘
```

### Agent Inventory

| Agent ID | Role | Parent | Key Tools | LLM? |
|---|---|---|---|---|
| `orchestrator` | Routes user intent to specialist agent | — | all agents | Yes |
| `runway` | Cash/burn/runway analysis + hiring simulation | orchestrator | `bank.*`, `payroll.*`, `hr.*` | Yes |
| `compliance` | Compliance calendar, filing status, alerts | orchestrator | `compliance.*`, `data.*` | Yes |
| `payroll` | Monthly payroll computation + execution | orchestrator | `payroll.*`, `data.*`, `notifications.*` | Yes |
| `ap-invoice` | End-to-end vendor invoice processing | orchestrator | `data.ap_*`, `bank.*` | Yes |
| `invoice-extractor` | Extract structured fields from raw invoice | ap-invoice | `ocr.*`, `documents.*` | Yes |
| `expense-classifier` | Classify expense category + ITC eligibility | ap-invoice | `config.expense_categories` | Yes |
| `vendor-matcher` | Match/identify vendor in vendor master | ap-invoice | `data.vendor_master` | Yes |
| `duplicate-detector` | Detect possible duplicate invoices | ap-invoice | `data.ap_invoices` | Yes |
| `ar-collections` | Raise client invoices + write follow-ups | orchestrator | `data.ar_*`, `email.*` | Yes |
| `hr` | Onboarding, leave, policy management | orchestrator | `data.hr_*`, `notifications.*` | Yes |
| `document-generator` | Generate offer letters, policy docs, payslips | hr / payroll | `documents.*`, `config.policy_templates` | Yes |
| `helpdesk` | Employee self-serve — payslips, HR queries | orchestrator | `data.*`, `notifications.*` | Yes |
| `tax-planning` | Employee tax optimization advice | helpdesk | `config.tax_config`, `data.salary_*` | Yes |
| `policy-engine` | Evaluate action against autopilot policies | ALL | `config.policies.*` | **No** |
| `confidence-scorer` | Score confidence of any LLM decision | ALL | — | **No** |
| `audit-logger` | Write immutable audit entries | ALL | `data.audit_trail` | **No** |

### Agent Definition Schema (`configs/agents/*.json`)

Every agent is defined by a config file. The code never hardcodes agent behaviour.

```json
{
  "id": "ap-invoice",
  "label": "AP Invoice Agent",
  "description": "Processes incoming vendor invoices end-to-end: extract, classify, match, approve, schedule payment.",
  "model": "claude-opus-4-6",
  "system_prompt_file": "configs/prompts/ap-invoice.md",
  "sub_agents": ["invoice-extractor", "expense-classifier", "vendor-matcher", "duplicate-detector"],
  "tools": [
    "data.ap_invoices.create",
    "data.ap_invoices.update",
    "data.vendor_master.lookup",
    "data.vendor_master.create",
    "data.gst_input_ledger.create",
    "data.expense_entries.create",
    "data.approval_requests.create",
    "data.bank_payees.lookup",
    "notifications.send_approval_request"
  ],
  "confidence_thresholds": {
    "auto_execute": 0.85,
    "request_approval": 0.60,
    "recommend_only": 0.40,
    "refuse": 0.0
  },
  "input_schema": "schemas/ap-invoice-input.json",
  "output_schema": "schemas/ap-invoice-output.json",
  "max_iterations": 10,
  "timeout_seconds": 60
}
```

---

## 6. ReAct Loop Pattern

Every agent follows a **Reason → Act → Observe** loop. No agent executes a tool without reasoning about it first. No agent terminates without a structured output.

### Pseudocode

```
agent.run(input, context):
  iterations = 0

  while iterations < agent.max_iterations:
    // Reason
    thought = llm.complete(
      system_prompt = load_prompt(agent.system_prompt_file),
      messages = context.messages,
      tools = resolve_tools(agent.tools),
      sub_agents = resolve_sub_agents(agent.sub_agents)
    )

    if thought.type == FINAL_ANSWER:
      audit_logger.log(agent.id, input, thought.answer, context)
      return thought.answer

    if thought.type == TOOL_CALL:
      // Score confidence before acting
      confidence = confidence_scorer.score(thought, context)

      // Check policy
      policy_result = policy_engine.evaluate(
        action = thought.tool_call,
        confidence = confidence,
        agent_id = agent.id
      )

      if policy_result == AUTO_EXECUTE:
        result = execute_tool(thought.tool_call)
        context.add_observation(result)

      elif policy_result == REQUEST_APPROVAL:
        approval_id = create_approval_request(thought.tool_call, confidence, evidence)
        return PENDING_APPROVAL(approval_id)

      elif policy_result == RECOMMEND_ONLY:
        return RECOMMENDATION(thought.reasoning, no_action=True)

      elif policy_result == REFUSE:
        return REFUSED("Confidence too low to act. Please provide more information.")

    if thought.type == SPAWN_SUB_AGENT:
      sub_result = run_agent(thought.sub_agent_id, thought.sub_agent_input, context)
      context.add_observation(sub_result)

    iterations++

  return ERROR("Max iterations reached without resolution.")
```

### Context Object

The context passed through every agent turn contains:
- `messages`: full conversation history for this session
- `company_id`: current workspace
- `actor_id`: who triggered this (founder, finance_lead, employee, system)
- `session_id`: for grouping related agent calls
- `memory`: retrieved company-specific patterns (recurring vendors, past runs)
- `observations`: accumulated tool results in this run

---

## 7. Confidence Scoring System

### What Gets Scored

Every LLM decision before tool execution. Not the final answer — the specific action being proposed.

### Scoring Inputs

The confidence scorer (pure function, no LLM) evaluates:

| Signal | Weight | Description |
|---|---|---|
| Extraction completeness | 30% | How many required fields were successfully extracted |
| Vendor/entity match quality | 20% | Exact match vs fuzzy match vs no match |
| Category match quality | 20% | Exact category match vs ambiguous |
| Historical pattern match | 15% | Has this same action been taken before successfully? |
| Data freshness | 15% | How recent is the source data (bank feed, last sync)? |

### Thresholds (configurable in `configs/policies/autopilot.json`)

| Score Range | Decision | Action |
|---|---|---|
| ≥ 0.85 | AUTO_EXECUTE | Execute immediately, log to audit trail |
| 0.60–0.84 | REQUEST_APPROVAL | Create approval card, surface to approver |
| 0.40–0.59 | RECOMMEND_ONLY | Show recommendation, no execution, ask for confirmation |
| < 0.40 | REFUSE | Return "I'm not confident. Please provide X." |

### Confidence in Evidence Snapshots

Every approval card shows the confidence score + the evidence used to compute it:
> "Suggested GL category: SaaS (confidence: 0.86). Based on: vendor name 'Acme Cloud', past 3 invoices categorized identically."

---

## 8. Policy Engine

### What It Does

The Policy Engine is a **pure function** (zero LLM calls) that takes an action + context and returns one of: `AUTO_EXECUTE | REQUEST_APPROVAL | RECOMMEND_ONLY | REFUSE`.

It is the last gate before any tool execution. No agent can bypass it.

### Policy Evaluation Order

```
1. Is the actor authorized for this action type? (RBAC check)
   → No: REFUSE

2. Is the action type covered by an autopilot policy?
   → No coverage: REQUEST_APPROVAL (default safe)

3. Does the action meet the policy's condition?
   (e.g., payment_amount <= autopilot.payment_auto_threshold_inr)
   → Yes + confidence >= auto_execute_min: AUTO_EXECUTE
   → Yes + confidence < auto_execute_min: REQUEST_APPROVAL

4. Does the action exceed policy threshold?
   → Yes: REQUEST_APPROVAL

5. Is confidence below refuse threshold?
   → Yes: REFUSE
```

### Policy Config (`configs/policies/autopilot.json`)

```json
{
  "_comment": "Autopilot policy. Edit to change what the OS does automatically vs what it asks for.",
  "payment_auto_threshold_inr": 25000,
  "filing_auto_execute": false,
  "alerts_mode": "balanced",
  "confidence_thresholds": {
    "auto_execute_min": 0.85,
    "recommend_only_min": 0.40
  },
  "action_overrides": [
    {
      "action_type": "terminate_employee",
      "policy": "NEVER_AUTO_EXECUTE",
      "reason": "Excessive agency guardrail — termination always requires human action"
    },
    {
      "action_type": "send_legal_notice",
      "policy": "NEVER_AUTO_EXECUTE"
    },
    {
      "action_type": "file_gst_return",
      "policy": "REQUEST_APPROVAL",
      "reason": "Filing is irreversible; always get explicit approval"
    }
  ],
  "rbac": {
    "founder": ["*"],
    "finance_lead": ["ap_*", "ar_*", "compliance_*", "expense_*"],
    "hr_lead": ["hr_*", "payroll_view"],
    "employee": ["helpdesk_*", "leave_request", "payslip_download"]
  }
}
```

### Approval Request Schema

When `REQUEST_APPROVAL` is triggered, this record goes into `approval_requests` sheet and surfaces in the Command Center:

```
{
  approval_id: auto
  agent_id: "ap-invoice"
  action_type: "schedule_vendor_payment"
  action_payload: { vendor_id, amount, scheduled_date }
  confidence_score: 0.72
  evidence: [
    { type: "invoice_image", ref: "drive://invoices/INV-2025-042.pdf" },
    { type: "past_payments", summary: "Last 3 payments to this vendor: ₹1.2L, ₹1.1L, ₹1.3L" },
    { type: "policy_rule", text: "Payment > ₹25,000 requires approval" }
  ]
  proposed_action_text: "Pay ₹1,48,000 to Acme Cloud on 12 Apr 2025"
  created_at: timestamp
  expires_at: timestamp + workflow_config.approval_expiry_hours
  status: "PENDING"
  approver_role: "founder"
}
```

---

## 9. User Journeys

### Journey 1 — Founder: "Runway always clear + approve only what matters"

**Scenario:** Founder wants to know if they can hire two engineers.

```
Step 1: Founder receives weekly digest notification
  Surface: mobile push / email card
  Content: "Runway: 5.2 months ↓0.6 (last 30d). Top drivers: salaries + vendor renewals."
  CTA: "Open Command Center"

Step 2: Founder asks in chat
  Input: "Can we hire 2 engineers in May?"
  → OrchestratorAgent routes to RunwayAgent

Step 3: RunwayAgent responds with decision card
  "Hiring 2 engineers → burn +₹3.8L/mo → runway drops: 5.2 → 4.1 months."
  "Recommendation: proceed only if collections improve by ₹X, or defer Vendor A renewal."
  Buttons: [Simulate alternatives] [Proceed anyway] [Cancel]

Step 4: Founder taps "Simulate alternatives"
  RunwayAgent offers 3 options:
  A) "Hire 1 engineer" → runway 4.7 months
  B) "Hire 2 + defer Vendor A payment 7 days" → runway 4.3 months
  C) "Hire 2 + start fundraise planning" → (show dilution impact)

Step 5: Founder chooses Option B
  → PolicyEngine evaluates: defer payment = within policy? amount < threshold? → REQUEST_APPROVAL
  → Approval card surfaces: "Defer Vendor A payment by 7 days. Impact: +0.2 months runway.
     No late fees detected (confidence: medium). [Approve] [Edit date] [Reject]"

Step 6: Founder approves
  → APInvoiceAgent updates payment date
  → AuditLogger records: actor=founder, action=defer_payment, amount=₹X, new_date=...
  → Confirmation: "Done. Vendor A payment moved to [date]. Runway now showing 4.3 months."
```

**Error States**
- Bank feed stale (>48h): "Runway confidence is LOW. Bank data hasn't updated. Upload statement or re-consent to refresh."
- Confidence below threshold: OS switches to recommend-only, no action proposed.

---

### Journey 2 — Finance Lead: "Continuous close, no dashboards"

**Scenario:** AP invoice comes in via email forward.

```
Step 1: Invoice arrives at ap@company.velo.app (or forwarded email)
  → APInvoiceAgent receives raw email/attachment

Step 2: InvoiceExtractorAgent runs
  Input: invoice PDF/image
  Output: { vendor_name, gstin, invoice_number, date, line_items[], subtotal, gst, total }
  Confidence scored per field.

Step 3: VendorMatcherAgent runs
  Input: vendor_name + gstin
  → Exact GSTIN match in vendor_master → confidence: 0.97 → AUTO_EXECUTE lookup
  → Or: fuzzy name match, different GSTIN → confidence: 0.61 → surface for confirmation

Step 4: ExpenseClassifierAgent runs per line item
  Input: line item description + amount
  → "H100 GPU" → category: it_hardware, gst_rate: 18%, itc_claimable: true
  Confidence: 0.91 → will show label + let user override

Step 5: DuplicateDetectorAgent runs
  → Checks ap_invoices sheet: same vendor + amount + approximate date?
  → Match found → surfaces: "Possible duplicate — same amount and vendor as #124. Confirm?"

Step 6: AP entry created (pending duplicate check resolution)
  → gst_input_ledger updated
  → expense_entries updated

Step 7: Payment workflow
  → Amount > autopilot threshold → approval card surfaces
  "Pay ₹1,48,000 to Acme Cloud on 12 Apr?
   Evidence: invoice PDF + last 3 payments + contract renewal note.
   [Approve] [Request info] [Mark duplicate] [Reassign]"

Step 8: Founder approves
  → bank_payees lookup → payee exists → payment scheduled
  → If payee missing → "Add Acme Cloud as a payee in your bank portal. I'll remind you in 24h."
```

**Microcopy**
- "Invoice detected: Vendor 'Acme Cloud' ₹1,48,000 due 12 Apr."
- "Suggested GL: SaaS (confidence 0.86)."
- "Payment failure: Bank transfer failed. Retry scheduled in 2h. Reason: insufficient balance."

---

### Journey 3 — HR Lead: "Onboarding auto-checked, helpdesk deflected"

**Scenario:** New hire being onboarded.

```
Step 1: HR Lead triggers onboarding
  Input (chat): "Add hire: Priya, joining 6 May, SDE2, CTC ₹18L"
  → OrchestratorAgent routes to HRAgent

Step 2: HRAgent creates employee record (status: ONBOARDING)
  → Pulls onboarding template from configs/business/onboarding_templates.json
  → Creates checklist entries in hr_tasks sheet

Step 3: DocumentGeneratorAgent runs
  → Generates offer letter (template from configs/prompts/document-generator.md)
  → Microcopy: "Offer draft ready. Send for e-sign? [Yes, send] [Edit first]"

Step 4: Employee receives onboarding link / WhatsApp flow
  → Collects: PAN, Aadhaar, bank account, address

Step 5: HRAgent monitors completion
  → 48h before joining date: checks hr_tasks for blockers
  → "Missing: PAN, bank account proof. Priya joins Monday. [Send reminder to Priya]"

Step 6: Doc mismatch detection
  → "PAN name (PRIYA SHARMA) doesn't match bank account name (P SHARMA). Request clarification?"
```

**Offer Negotiation Assistant**
- HR: "Candidate wants +20% hike. What's our band?"
- HRAgent: "Based on internal parity + runway impact, safe max is +12% (adds ₹0.4L/mo burn). Options: increase variable component, joining bonus, ESOPs." *(Uses only internal data — no hallucinated market benchmarks)*

---

### Journey 4 — Employee: "Self-serve, no HR tickets"

**Scenario:** Employee asks for payslip + tax advice.

```
Step 1: Employee messages via Slack / WhatsApp / Command Center
  "Need payslip for March"
  → HelpdeskAgent receives message

Step 2: Identity verified (SSO-bound channel = verified; open channel = OTP)
  → Payslip link generated: "Download March payslip (link expires in 24h)"

Step 3: Employee asks: "How can I reduce my tax?"
  → HelpdeskAgent routes to TaxPlanningAgent

Step 4: TaxPlanningAgent asks minimal clarifiers
  "Which regime are you on — old or new?"
  "What investments have you declared so far?"

Step 5: TaxPlanningAgent responds
  → "Switching to old regime + maxing 80C saves ₹X this year.
     Submit proofs by [deadline] to avoid higher TDS."
  → "Upload proofs? [Upload here]"
```

**Error States**
- Access control: "You don't have permission to access payroll details for other employees."
- Expired link: "That payslip link has expired. Request a new one? [Yes]"

---

## 10. Core Surfaces & UX

### Surface Types (where Velo talks to users)

| Surface | Use Case | Frequency |
|---|---|---|
| Mobile push notification | Critical alerts, approval requests | As needed |
| Email digest | Weekly summary, compliance reminders | Weekly |
| Slack / Teams card | Approval requests, exception alerts | As needed |
| WhatsApp message | Employee self-serve, approvals where appropriate | As needed |
| Command Center web app | Audit trail, chat, evidence drawers | On demand |

### Component Library

**State Chip** — `GREEN / AMBER / RED` with short label: "Compliance: GREEN"

**Runway Tile** — always visible at top of Command Center:
```
Runway: 5.2 months  ↓0.6 (30d)   ● Confidence: HIGH
```

**Approval Card** (standardized across all agents):
```
┌─────────────────────────────────────────────────┐
│ [Action title]                                   │
│ "Pay ₹1,48,000 to Acme Cloud on 12 Apr"         │
├─────────────────────────────────────────────────┤
│ Impact: Reduces cash by ₹1.48L                  │
│ Runway impact: −0.08 months                      │
├─────────────────────────────────────────────────┤
│ Evidence:                                        │
│  · Invoice PDF [view]                           │
│  · Last 3 payments: ₹1.2L, ₹1.1L, ₹1.3L       │
│  · Policy: Payments > ₹25K require approval      │
├─────────────────────────────────────────────────┤
│ Confidence: 0.86 (HIGH)                         │
│ Expires in: 48h                                 │
├─────────────────────────────────────────────────┤
│  [Approve]   [Edit]   [Reject]   [Ask more]     │
└─────────────────────────────────────────────────┘
```

**Exception Card** — for anomalies the OS surfaces:
```
[What happened] [Why it matters] [Proposed fix] [What's missing]
```

**Evidence Drawer** — ephemeral right panel when user taps "Evidence":
- Transaction list snippet
- Invoice image
- Statutory reference link

**Policy Banner** — always visible, always editable:
`"Autopilot: payments < ₹25,000 auto-execute · Filing: always ask · Alerts: balanced  [Edit]"`

**Command Bar** — bottom of Command Center:
`"Ask anything..." [suggested: "Can I hire..."] [suggested: "What's due this month?"]`

**Audit Trail View** — immutable log:
- Who approved, what executed, timestamps, external reference IDs (bank refs, GST ARN, EPFO acknowledgement)

### Microcopy Rules
- No jargon in primary copy; jargon only in evidence drawer (e.g., "GSTR-3B" only in details)
- Always show rupee amounts in Indian format (₹1,48,000 not ₹148000)
- Always include "why" in one line: "Delaying this improves runway by 0.2 months."
- Use plain English: "Your monthly tax payment" not "TDS challan under Section 194J"

---

## 11. Onboarding Flow

**Target:** < 10 minutes from landing to first runway view. Feels like "turning on autopilot", not "setting up accounting."

```
Screen A — Welcome
  Header: "Activate your Back-Office OS"
  Subtext: "Connect your bank to calculate runway and protect deadlines."
  CTA: [Connect bank]   Secondary: [Upload statement instead]

Screen B — Bank Connection
  Primary: "Connect via Account Aggregator" (AA framework — consented, reversible)
  Fallback: "Upload last 6 months statement (PDF / CSV)"
  Microcopy: "We don't move money without approval."

Screen C — Company Inference Confirmation
  OS shows inferred values (from bank statement analysis):
    "Estimated monthly burn: ₹18.4L"
    "Recurring salaries detected: ~₹12.1L"
    "GST-like payments detected: yes"
    "Compliance registrations: PF likely, GST likely"
  [Looks right]   [Edit]

Screen D — People Import (optional)
  "Upload employee list (CSV)"   [Skip for now]
  Microcopy: "You can turn on salary automation later. Runway works immediately."

Screen E — Autopilot Policies (3 choices only)
  1. Payment approvals: [Always ask] / [Auto-pay under ₹___]
  2. Filing: [Always ask before filing] / [Auto-file when ready]
  3. Alerts: [Only critical] / [Balanced] / [Verbose]

Screen F — Activation Complete
  "Autopilot is ON."
  "First analysis ready in ~30 seconds."  (no hard promise)
  [Open Command Center]
```

---

## 12. Module Deep-Dives

### Module A — Runway & Cash Intelligence

**Always-on background agent.** Runs on schedule (configurable, default: hourly) and on any event that changes cash position.

**Inputs:** Bank balance (AA feed / statement), `payroll_runs` sheet (committed salaries), `ap_invoices` sheet (payables due), `ar_invoices` sheet (receivables), `compliance_calendar` sheet (tax payments due), `hr_tasks` sheet (pending hires with committed CTCs).

**Outputs:** Runway tile update, weekly digest content, alerts on threshold breach.

**Core Logic:**
```
runway_months = current_cash / monthly_burn_rate

monthly_burn_rate = confirmed_salaries
                  + vendor_commitments_this_month
                  + tax_obligations_this_month
                  + pending_approved_capex

confidence = f(bank_data_freshness, salary_data_completeness, ar_certainty)
```

**Alert Triggers** (thresholds in `configs/policies/autopilot.json`):
- Runway drops below X months → AMBER alert
- Runway drops below Y months → RED alert + escalation
- Runway changes >0.5 months week-over-week → digest mention

---

### Module B — Tax & Compliance

**Compliance Calendar Generation** — from `configs/business/compliance_calendar_rules.json`:
- Rules define: filing type, frequency, due day logic, applicable state, portal
- System generates monthly calendar entries automatically
- Alert lead times: 7 days (AMBER), 2 days (RED), overdue (CRITICAL)

**GST Input Credit (ITC) Tracking:**
- Every AP invoice line item → ExpenseClassifierAgent → ITC eligible? (from `expense_categories.json`)
- ITC eligible entries → `gst_input_ledger` sheet
- Monthly ITC balance = sum of eligible credits for the period
- GSTR-3B prefill prepared from `gst_output_ledger` (AR invoices) + `gst_input_ledger`

**Payroll Compliance (per payroll run):**
- PF challan amount computed → creates `tax_obligations` entry (due: 15th of next month)
- ESIC challan amount → `tax_obligations` entry
- PT deducted per employee → `tax_obligations` entry (per state rule)
- TDS deducted → `tds_records` entry + quarterly return tracking

---

### Module C — Payroll

**Payroll Run Flow:**
```
Trigger → PullActiveEmployees → FetchSalaryStructures
→ FetchAttendance → ComputeGross → ApplyDeductions
→ ComputeNet → GeneratePayrollRunRecord
→ GenerateSalarySlips → CreateTaxObligations
→ SurfaceApprovalCard → OnApproval → MarkApproved
→ (Phase 2) InitiateBankPayments
```

All computation logic reads from:
- `configs/business/payroll_config.json` — salary components, LOP rules, bonus rules
- `configs/business/tax_config.json` — PF/ESIC/PT/TDS rates

**No payroll computation logic is hardcoded in any TypeScript file.**

---

### Module D — AP Invoice Processing

**Full flow:** See Journey 2 above.

**Key agent calls within APInvoiceAgent:**
1. `InvoiceExtractorAgent` — PDF/image → structured fields
2. `VendorMatcherAgent` — vendor name/GSTIN → vendor_master lookup
3. `ExpenseClassifierAgent` — line items → categories + ITC
4. `DuplicateDetectorAgent` — check for duplicates
5. PolicyEngine — payment amount vs threshold
6. AuditLogger — every step logged

**Payment State Machine:**
```
PENDING_EXTRACTION → EXTRACTED → CLASSIFIED → VENDOR_MATCHED
→ PENDING_APPROVAL | AUTO_SCHEDULED
→ APPROVED → PAYMENT_INITIATED → PAID | FAILED
```

---

### Module E — AR Collections

**Invoice Raising Flow:**
```
User input → OrchestratorAgent → ARCollectionsAgent
→ ClientMasterLookup → InvoiceNumberGeneration
→ GSTComputation (IGST vs CGST+SGST based on state)
→ GenerateInvoicePDF → CreateAREntry
→ ApprovalCard (if amount > threshold)
→ OnApproval → SendToClientEmail
→ ScheduleFollowUp (from workflow_config.json: D+7, D+14, D+30)
```

**Follow-up Email Generation:**
- `ARCollectionsAgent` generates follow-up email copy based on tone config
- Tone per follow-up level in `configs/business/workflow_config.json`:
  - D+7: `gentle_reminder`
  - D+14: `firm_reminder`
  - D+30: `final_notice`
- Agent generates email text matching the tone — no hardcoded templates

---

### Module F — HR Operations

**Onboarding Workflow:**
```
"Add hire: [name], [date], [role], [CTC]"
→ HRAgent creates employee record (status: ONBOARDING)
→ Pulls onboarding_template from configs
→ DocumentGeneratorAgent: offer letter
→ Sends onboarding collection flow to employee (email / WhatsApp)
→ Monitors completion → alerts HR 48h before joining on blockers
→ On all docs received: status → ACTIVE
→ First payroll auto-includes employee (pro-rated)
```

**Policy Document Generation:**
```
"Generate POSH policy"
→ HRAgent → DocumentGeneratorAgent
→ Loads template from configs/business/policy_templates.json
→ Fills placeholders from configs/business/company_config.json
→ Outputs markdown → stores in policy_documents sheet
→ (Optional) generates PDF
```

---

## 13. Google Sheets Data Architecture

### Spreadsheet Layout

One workspace = one Google Spreadsheet set per company.

```
VELO_CONFIG (business rules — read-only for agents)
  tabs: tax_rates | expense_categories | payroll_components
        leave_types | compliance_rules | company_settings

VELO_MASTER (reference data)
  tabs: employees | salary_structures | vendor_master | client_master | bank_payees

VELO_TRANSACTIONS
  tabs: payroll_runs | salary_slips | ap_invoices | ar_invoices
        expense_entries | leave_records | leave_balances
        attendance | approval_requests | hr_tasks

VELO_COMPLIANCE
  tabs: tax_obligations | gst_input_ledger | gst_output_ledger
        compliance_calendar | tds_records | filing_history

VELO_LOGS (immutable)
  tabs: audit_trail | chat_log | agent_run_log | policy_decisions
        policy_documents | notification_log
```

### Handling Unstructured Data

Unstructured inputs (invoice PDFs, images, pasted text) are never stored raw in the database.

```
Raw input received
      │
      ▼
Stored temporarily in memory / Vercel /tmp
      │
      ▼
InvoiceExtractorAgent runs: PDF/image → structured fields
      │
      ▼
Confidence scored per field
      │
      ▼
Low-confidence fields surfaced to user for confirmation
      │
      ▼
Confirmed structured data → Sheets row created
      │
      ▼
Raw file uploaded to Google Drive
(auto-folder: /Velo/invoices/YYYY-MM/)
      │
      ▼
Sheet row gets: source_file_url → Drive link
```

**Sheets store only structured, confirmed data. Drive stores originals. Each sheet row links to Drive.**

---

## 14. Config Architecture

### Directory Structure

```
configs/
├── business/                    ← All business rules (tax, payroll, HR, etc.)
│   ├── company_config.json      ← Company identity and settings
│   ├── tax_config.json          ← PT slabs, PF/ESIC rates, TDS slabs
│   ├── expense_categories.json  ← Categories, GST rates, ITC eligibility
│   ├── payroll_config.json      ← Salary components, LOP, bonus rules
│   ├── leave_types.json         ← Leave types, entitlements, carry-forward
│   ├── compliance_calendar_rules.json ← Filing due date rules
│   ├── employee_fields.json     ← Employee master field definitions
│   ├── onboarding_templates.json ← Onboarding checklist templates
│   └── policy_templates.json   ← HR policy document templates (markdown)
│
├── agents/                      ← Agent definitions
│   ├── orchestrator.json
│   ├── runway.json
│   ├── compliance.json
│   ├── payroll.json
│   ├── ap-invoice.json
│   ├── ar-collections.json
│   ├── hr.json
│   ├── helpdesk.json
│   ├── tax-planning.json
│   └── sub-agents/
│       ├── invoice-extractor.json
│       ├── expense-classifier.json
│       ├── vendor-matcher.json
│       └── duplicate-detector.json
│
├── prompts/                     ← Agent system prompts (markdown files)
│   ├── orchestrator.md
│   ├── runway.md
│   ├── compliance.md
│   ├── payroll.md
│   ├── ap-invoice.md
│   ├── invoice-extractor.md
│   ├── expense-classifier.md
│   ├── vendor-matcher.md
│   ├── duplicate-detector.md
│   ├── ar-collections.md
│   ├── hr.md
│   ├── document-generator.md
│   ├── helpdesk.md
│   └── tax-planning.md
│
├── policies/                    ← Autopilot + approval policies
│   ├── autopilot.json           ← Thresholds, RBAC, action overrides
│   └── approval_rules.json      ← Per-action approval configuration
│
└── workflows/                   ← Multi-step agent workflow definitions
    ├── payroll_run.json
    ├── ap_invoice_processing.json
    ├── employee_onboarding.json
    └── ar_invoice_flow.json
```

### Workflow Config Format (`configs/workflows/ap_invoice_processing.json`)

Defines the sequence of agent calls for a complex task. Changing the flow = editing JSON.

```json
{
  "id": "ap_invoice_processing",
  "label": "AP Invoice Processing",
  "trigger": "ap_invoice.received",
  "steps": [
    {
      "step": 1,
      "agent": "invoice-extractor",
      "input_from": "trigger.payload",
      "output_to": "extracted_fields",
      "on_low_confidence": "surface_for_confirmation"
    },
    {
      "step": 2,
      "agent": "duplicate-detector",
      "input_from": "extracted_fields",
      "output_to": "duplicate_check",
      "on_duplicate_found": "surface_exception_card",
      "on_no_duplicate": "continue"
    },
    {
      "step": 3,
      "agent": "vendor-matcher",
      "input_from": "extracted_fields.vendor_name + extracted_fields.gstin",
      "output_to": "vendor_match",
      "on_no_match": "prompt_user_to_confirm_new_vendor"
    },
    {
      "step": 4,
      "agent": "expense-classifier",
      "input_from": "extracted_fields.line_items",
      "output_to": "classifications",
      "on_ambiguous": "surface_for_confirmation"
    },
    {
      "step": 5,
      "action": "create_ap_invoice_entry",
      "tool": "data.ap_invoices.create",
      "input_from": ["extracted_fields", "vendor_match", "classifications"],
      "requires_policy_check": true
    },
    {
      "step": 6,
      "action": "update_gst_input_ledger",
      "tool": "data.gst_input_ledger.create",
      "condition": "classifications.any.itc_claimable == true"
    },
    {
      "step": 7,
      "action": "initiate_payment_workflow",
      "tool": "data.approval_requests.create",
      "requires_policy_check": true,
      "on_auto_execute": "schedule_payment",
      "on_request_approval": "surface_approval_card"
    }
  ]
}
```

---

## 15. Integration Map

### Phase 1 (Prototype — Sheets-backed)
| Integration | Method | Purpose |
|---|---|---|
| Google Sheets | Sheets API v4 (service account) | All data storage |
| Google Drive | Drive API v3 | Raw file storage (invoices, docs) |
| Google OAuth | NextAuth.js | User authentication |
| Claude (Anthropic) | Anthropic SDK | All agent LLM calls |
| Email | Resend / Nodemailer | AR follow-ups, notifications |

### Phase 2 (Connectors)
| Integration | Method | Purpose |
|---|---|---|
| Bank (read) | Account Aggregator (AA) framework | Real-time bank balance + transactions |
| Bank (write) | Corporate banking APIs (RBL, ICICI, etc.) | Payment initiation |
| GST Portal | GSP/ASP APIs | GSTR-1, GSTR-3B prefill + filing |
| EPFO | EPFO Unified Portal API | PF challan + ECR filing |
| ESIC | ESIC API | ESIC contribution filing |
| Income Tax | TRACES/IT portal API | TDS return filing, Form 16 |
| e-Invoice | NIC e-Invoice API | e-Invoice generation for B2B sales |

### India-Specific Architecture Notes

**Account Aggregator (AA) Framework:**
- User consents via AA app (NBFC-AA like Finvu, OneMoney)
- Consent is revocable; OS stores consent artifact, not credentials
- Fallback: PDF/CSV bank statement upload + parser
- AA data = always treated as "read-only + ephemeral" — never stored raw, only structured summaries

**GST Portal Realities:**
- Portal downtime is common; track downtime separately from filing misses
- GSP (GST Suvidha Provider) intermediary needed for API access
- Validation strictness changes without notice; always validate locally before API call
- e-Invoice mandatory for turnover > ₹5 Cr (threshold configurable in `tax_config.json`)

**DPDPA 2023 Alignment:**
- All employee PII (PAN, Aadhaar, bank) = sensitive personal data
- Purpose limitation: collected for payroll/compliance only, not analytics
- Data principal rights: employee can request own data via helpdesk
- Consent records maintained in `audit_trail`
- Retention policy: `workflow_config.json` → `audit_trail_retention_months`

---

## 16. Privacy & DPDPA Compliance

| Requirement | Implementation |
|---|---|
| Lawful processing | Employer-employee relationship = lawful basis; explicit consent for AA bank access |
| Purpose limitation | Employee PII used only for payroll/compliance; logged in audit_trail |
| Data minimization | Collect only fields defined in employee_fields.json; no extra collection |
| Security safeguards | Service account key in env vars; no PII in logs; encrypted at rest (Google Workspace) |
| User rights | Employee can request their data via HelpdeskAgent; download via secure link |
| Retention | Configurable in workflow_config.json; audit_trail_retention_months = 84 (7 years, I-T requirement) |
| Breach response | Audit trail enables full reconstruction; incident response runbook = docs/ |

---

## 17. Monorepo Structure

### Why Monorepo

Agents, tools, core, and web share types and config loading logic. A monorepo with `pnpm workspaces` + `Turborepo` keeps everything in sync without duplicating packages.

### Full Directory Tree

```
velo/
├── packages/
│   │
│   ├── web/                             ← Next.js Command Center (user-facing app)
│   │   ├── src/
│   │   │   ├── app/                    ← Next.js App Router
│   │   │   │   ├── page.tsx            ← Command Center (chat + runway tile)
│   │   │   │   ├── dashboard/page.tsx  ← Dashboard tabs
│   │   │   │   └── api/               ← API routes (thin wrappers → agents package)
│   │   │   │       ├── chat/route.ts
│   │   │   │       ├── approvals/route.ts
│   │   │   │       └── webhooks/route.ts
│   │   │   ├── components/
│   │   │   │   ├── chat/              ← Command bar, message bubbles
│   │   │   │   ├── cards/             ← ApprovalCard, ExceptionCard, RunwayTile
│   │   │   │   └── dashboard/         ← Module dashboard tabs
│   │   │   └── lib/
│   │   │       └── api-client.ts      ← Typed client for API routes
│   │   └── package.json
│   │
│   ├── agents/                          ← All agent runtime code
│   │   ├── src/
│   │   │   ├── orchestrator/
│   │   │   │   └── index.ts           ← OrchestratorAgent
│   │   │   ├── runway/
│   │   │   │   └── index.ts           ← RunwayAgent
│   │   │   ├── compliance/
│   │   │   │   └── index.ts           ← ComplianceAgent
│   │   │   ├── payroll/
│   │   │   │   └── index.ts           ← PayrollAgent
│   │   │   ├── ap-invoice/
│   │   │   │   ├── index.ts           ← APInvoiceAgent (parent)
│   │   │   │   ├── extractor/index.ts ← InvoiceExtractorAgent
│   │   │   │   ├── classifier/index.ts ← ExpenseClassifierAgent
│   │   │   │   ├── vendor-matcher/index.ts
│   │   │   │   └── duplicate-detector/index.ts
│   │   │   ├── ar-collections/
│   │   │   │   └── index.ts
│   │   │   ├── hr/
│   │   │   │   ├── index.ts           ← HRAgent
│   │   │   │   └── document-generator/index.ts
│   │   │   ├── helpdesk/
│   │   │   │   └── index.ts
│   │   │   ├── tax-planning/
│   │   │   │   └── index.ts
│   │   │   └── runner.ts              ← AgentRunner: loads config, runs ReAct loop
│   │   ├── __tests__/
│   │   └── package.json
│   │
│   ├── tools/                           ← Tool functions callable by agents
│   │   ├── src/
│   │   │   ├── sheets/                ← Google Sheets CRUD, typed per sheet
│   │   │   │   ├── client.ts          ← Authenticated Sheets client (singleton)
│   │   │   │   ├── ap-invoices.ts
│   │   │   │   ├── ar-invoices.ts
│   │   │   │   ├── employees.ts
│   │   │   │   ├── payroll.ts
│   │   │   │   ├── compliance.ts
│   │   │   │   ├── vendor-master.ts
│   │   │   │   ├── approval-requests.ts
│   │   │   │   └── audit-trail.ts
│   │   │   ├── email/
│   │   │   │   └── index.ts           ← Send emails (Resend)
│   │   │   ├── notifications/
│   │   │   │   ├── slack.ts
│   │   │   │   ├── push.ts
│   │   │   │   └── whatsapp.ts
│   │   │   ├── bank/
│   │   │   │   ├── aa-framework.ts    ← Account Aggregator connector
│   │   │   │   └── statement-parser.ts ← PDF/CSV bank statement parser
│   │   │   ├── documents/
│   │   │   │   ├── pdf-generator.ts   ← Salary slips, offer letters
│   │   │   │   └── drive.ts           ← Google Drive upload
│   │   │   └── ocr/
│   │   │       └── invoice-parser.ts  ← pdf-parse + Tesseract
│   │   ├── __tests__/
│   │   └── package.json
│   │
│   └── core/                            ← Shared types, engines, utilities
│       ├── src/
│       │   ├── types/                 ← All shared TypeScript interfaces
│       │   │   ├── agent.ts           ← Agent, AgentConfig, AgentResult
│       │   │   ├── invoice.ts         ← APInvoice, ARInvoice
│       │   │   ├── employee.ts        ← Employee, SalaryStructure
│       │   │   ├── payroll.ts         ← PayrollRun, SalarySlip
│       │   │   ├── compliance.ts      ← TaxObligation, FilingRecord
│       │   │   └── policy.ts          ← Policy, PolicyResult
│       │   ├── policy-engine/
│       │   │   └── index.ts           ← PolicyEngine (pure function, no LLM)
│       │   ├── confidence/
│       │   │   └── index.ts           ← ConfidenceScorer (pure function)
│       │   ├── audit/
│       │   │   └── index.ts           ← AuditLogger (append-only writes)
│       │   ├── memory/
│       │   │   └── index.ts           ← CompanyMemory (pattern retrieval)
│       │   └── config/
│       │       ├── loader.ts          ← Loads + validates all JSON configs
│       │       └── validator.ts       ← Zod schemas for every config file
│       ├── __tests__/
│       └── package.json
│
├── configs/                             ← (see Section 14)
│   ├── business/
│   ├── agents/
│   │   └── sub-agents/
│   ├── prompts/
│   ├── policies/
│   └── workflows/
│
├── scripts/
│   ├── seed-postgres-demo.ts           ← Seed PostgreSQL demo data
│
├── turbo.json                           ← Turborepo pipeline config
├── pnpm-workspace.yaml                  ← Workspace package declarations
├── package.json                         ← Root package.json
├── tsconfig.base.json                   ← Shared TypeScript config
├── .env.local.example
├── .gitignore
├── PLATFORM_PLAN.md
└── README.md
```

### Package Dependency Rules
```
web → agents, core
agents → tools, core
tools → core
core → (no internal deps)
```

`core` knows nothing about agents, tools, or web. Tools know nothing about agents or web. This means you can swap the LLM or the web framework without touching everything.

---

## 18. Phase Roadmap

### Phase 0 — Foundation (Now)
- [x] Platform plan + configs scaffold
- [x] Repo setup (monorepo structure)
- [ ] `pnpm-workspace.yaml` + `turbo.json` setup
- [ ] `core` package: types, policy engine, confidence scorer, audit logger, config loader
- [ ] `tools/sheets` package: authenticated Sheets client + all CRUD operations
- [ ] Seed script (`scripts/seed-postgres-demo.ts`)
- [ ] Google Sheets — all tabs created with correct headers

### Phase 1 — Core Agents (Prototype)
- [ ] AgentRunner: loads config, runs ReAct loop, calls tools
- [ ] OrchestratorAgent: intent routing from user message to specialist
- [ ] APInvoiceAgent + all 4 sub-agents
- [ ] RunwayAgent: basic cash/burn calculation
- [ ] Next.js Command Center: chat UI + approval cards
- [ ] AR CollectionsAgent: invoice generation + follow-up
- [ ] PayrollAgent: monthly payroll run
- [ ] ComplianceAgent: calendar + alerts
- [ ] HRAgent: onboarding + leave
- [ ] HelpdeskAgent + TaxPlanningAgent
- [ ] Email notifications (Resend)
- [ ] Onboarding flow (5 screens)

### Phase 2 — Connectors & Intelligence
- [ ] Account Aggregator integration (real bank data)
- [ ] GSP/ASP connector (GST portal API)
- [ ] EPFO API connector
- [ ] Bank payment initiation API
- [ ] PDF generation (salary slips, offer letters)
- [ ] Slack / WhatsApp approval surfaces
- [ ] Company memory (pattern learning from past actions)
- [ ] Weekly digest email automation

### Phase 3 — Managed Service Layer
- [ ] CA/accountant read-only access role
- [ ] Multi-company workspace support
- [ ] On-demand CA consultation booking
- [ ] Board pack auto-generation
- [ ] Cost leak detection agent

---

## 19. What I Need From You

### One-Time Setup (to start executing Phase 1)

| # | What | How to get it to me |
|---|---|---|
| 1 | **Google Cloud service account** | console.cloud.google.com → new project → enable Sheets API + Drive API → create Service Account → download JSON key → paste here |
| 2 | **Company config** | Your company name, state (for PT slabs), GSTIN (if any), PF/ESIC registration status, invoice prefix (e.g. INV-2025-) |
| 3 | **Anthropic API key** | claude.ai → API keys → create key → paste here |
| 4 | **One blank Google Sheet** | Create it, name it `VELO_CONFIG`, share with service account email (from step 1), send me the URL — I'll build all 5 spreadsheets |
| 5 | **Notification channel** | Slack workspace URL + bot token, OR just email for now? |
| 6 | **Module priority** | I recommend starting with **AP Invoices** (Module D): most visible daily pain, best demo |

### Decisions to Make Before I Build

| Decision | Options | Recommendation |
|---|---|---|
| Package manager | npm / yarn / pnpm | **pnpm** (fastest, disk-efficient with monorepo) |
| LLM for agents | Claude Opus / Sonnet / Haiku | **Sonnet 4.6** for most agents, Haiku for classifiers |
| Email provider | Resend / Nodemailer + SMTP | **Resend** (dead simple, good free tier) |
| First notification surface | Email / Slack / WhatsApp | **Email** first (no infra), then Slack |
| Bank data Phase 1 | AA Framework / Statement upload | **Statement upload** first (no AA setup needed) |

---

*Last updated: April 2026 | Velo v0.2 | Status: Phase 0 → Phase 1*
