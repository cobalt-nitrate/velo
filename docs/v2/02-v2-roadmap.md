# V2 Product Roadmap

V2 takes Velo from a sophisticated back-office automation tool to an enterprise-grade back-office OS. The core themes:

1. **Real integrations** — Live bank data, tax portals, accounting systems
2. **Multi-entity & enterprise RBAC** — Multiple companies, departments, custom roles, approval chains
3. **Advanced intelligence** — Predictive analytics, anomaly detection, scenario planning
4. **Platform extensibility** — Workflow builder, public API, webhooks
5. **Mobile** — Approval actions and expense capture on mobile

Story point scale: Fibonacci (same as V1 backlog).

---

## THEME A: Real Data Integrations

**Why this unlocks V2:** The platform currently reads bank data from Google Sheets (manual entry). Real value comes when bank statements auto-import, GST filings happen directly, and accounting systems stay in sync. This theme closes the loop between Velo's intelligence and actual money movement.

### A1. Banking Integration (Total: 39 pts)

| ID | Story | Pts | Notes |
|----|-------|-----|-------|
| V2-001 | Bank statement auto-import — scheduled pull from HDFC/ICICI/Axis via netbanking XML/API | 13 | Replaces manual Sheets entry; highest data freshness impact |
| V2-002 | Payment initiation — initiate NEFT/IMPS via bank API after approval | 13 | Closes the AP loop: agents propose → humans approve → bank executes |
| V2-003 | Bank reconciliation agent — auto-match GL entries with bank statement lines | 8 | Classic month-end pain; 2-day job becomes minutes |
| V2-004 | Multi-bank treasury view — balances across all accounts in one dashboard | 5 | Common in 30+ person companies with separate salary, opex, reserve accounts |

### A2. GST & Tax Portal Integration (Total: 42 pts)

| ID | Story | Pts | Notes |
|----|-------|-----|-------|
| V2-005 | GST portal read — pull GSTR-2B (ITC available) via NIC API | 8 | Enables automated ITC reconciliation |
| V2-006 | GSTR-1 auto-prepare — compile sales register into GSTR-1 format from AR invoices | 8 | Creates the filing artifact; currently agent computes but can't file |
| V2-007 | GSTR-3B auto-prepare + file via GSP (GST Suvidha Provider) | 13 | Game-changing; most companies spend 2 days/month on this |
| V2-008 | TDS certificate generation — generate Form 16A for vendors | 5 | Mandatory for vendor compliance |
| V2-009 | PF/ESIC challan generation — auto-calculate and produce payment challans | 8 | Monthly statutory obligation; currently entirely manual |

### A3. Accounting System Integration (Total: 21 pts)

| ID | Story | Pts | Notes |
|----|-------|-----|-------|
| V2-010 | Tally export — push GL entries to Tally-compatible XML | 8 | Most Indian SMEs use Tally as the book of record |
| V2-011 | Zoho Books two-way sync — invoices, payments, employees | 8 | Popular with tech-forward SMEs |
| V2-012 | QuickBooks connector | 5 | International companies and US subsidiaries |

**Theme A Total: 102 pts**

---

## THEME B: Multi-Entity & Enterprise RBAC

**Why this unlocks enterprise:** Series B+ companies have subsidiaries, holding structures, and complex approval hierarchies. A single env-var role model does not serve them. Multi-entity support and configurable approval chains are the gate to enterprise sales.

### B1. Multi-Entity / Multi-Tenant (Total: 34 pts)

| ID | Story | Pts | Notes |
|----|-------|-----|-------|
| V2-013 | Multi-company support — single login, switch between entities | 13 | Series B+ typically has holding + 2–3 subsidiaries |
| V2-014 | Entity-level data isolation — separate Sheets per entity, consolidated views at group level | 8 | |
| V2-015 | Inter-company transactions — record and reconcile charges between entities | 8 | Common: subsidiary bills parent for shared services |
| V2-016 | Consolidated dashboard — group-level runway, AP/AR, compliance across all entities | 5 | CFO-level view |

### B2. Enterprise RBAC & Governance (Total: 32 pts)

| ID | Story | Pts | Notes |
|----|-------|-----|-------|
| V2-017 | Custom roles — define roles beyond 6 built-in (e.g., department_head, auditor, readonly_finance) | 8 | Enterprise always has domain-specific role requirements |
| V2-018 | Department-level access — scope finance lead to own cost center only | 5 | Budget owner access model |
| V2-019 | Multi-level approval chains — "if amount > X, require finance_lead AND founder sequentially" | 8 | Delegation of authority matrix; standard in enterprises |
| V2-020 | Approval delegation — "OOO until date Y, delegate approvals to Z" | 3 | Business continuity; prevents approval gridlock |
| V2-021 | SSO (SAML/OIDC) — Okta, Azure AD, Google Workspace | 5 | Hard requirement for enterprise buyers |
| V2-022 | MFA enforcement — require TOTP for finance and founder roles | 3 | Security compliance baseline |

**Theme B Total: 66 pts**

---

## THEME C: Advanced Intelligence

**Why this creates moat:** The current agents answer "what is" — what's the current runway, what invoices are overdue. V2 moves to "what will be" and "what's wrong" — forecasting, anomaly detection, and scenario modeling. This is the differentiation that justifies premium pricing.

### C1. Predictive Analytics (Total: 31 pts)

| ID | Story | Pts | Notes |
|----|-------|-----|-------|
| V2-023 | Cash flow forecasting — predict 90-day cash position from commitments, receivables, burn | 13 | Extends runway agent from current state to forward projection |
| V2-024 | Hiring scenario modeling — "if I hire 3 engineers at X CTC, runway changes by Y months" | 8 | Founders ask this at every board meeting |
| V2-025 | Vendor spend analytics — monthly spend by category, YoY comparison, top vendors | 5 | CFO-level spend visibility |
| V2-026 | Revenue concentration risk — which clients drive what % of AR | 5 | Sales + finance intersection; surfaces dangerous client dependency |

### C2. Anomaly Detection (Total: 19 pts)

| ID | Story | Pts | Notes |
|----|-------|-----|-------|
| V2-027 | Duplicate payment detection — flag if same vendor received same amount in same period | 8 | Happens more than people admit; catches real money losses |
| V2-028 | Expense spike alert — flag when vendor bill is >20% above their 3-month average | 5 | Catches billing errors and potential fraud early |
| V2-029 | Salary anomaly detection — flag if any component changed >10% month-on-month | 3 | Payroll error catch before disbursement |
| V2-030 | Bank balance below threshold alert — proactive runway safety net | 3 | Founder should never discover a cash crisis by accident |

### C3. Contract & Document Intelligence (Total: 16 pts)

| ID | Story | Pts | Notes |
|----|-------|-----|-------|
| V2-031 | Contract analysis agent — extract payment terms, renewal dates, SLA from vendor/client contracts | 13 | Legal ops time-save; surfaces renewal risks and obligations |
| V2-032 | Contract expiry calendar — integrate extracted terms into compliance calendar | 3 | Prevent costly silent auto-renewals |

**Theme C Total: 66 pts**

---

## THEME D: Platform Extensibility

**Why this builds a moat:** Every company has slightly different back-office processes. A visual workflow builder means enterprise customers can model their exact approval chains without engineering. An API and webhook layer turns Velo into a platform other tools integrate with.

### D1. Workflow Builder (Total: 34 pts)

| ID | Story | Pts | Notes |
|----|-------|-----|-------|
| V2-033 | Visual workflow builder — no-code editor for approval chains and agent sequences | 21 | Unlocks customer-specific processes without code changes |
| V2-034 | Trigger system — event-based automation ("when invoice >50k received, notify CFO") | 8 | Extends from chat-triggered to fully background automations |
| V2-035 | Scheduled workflow runs — run payroll or AR review on a product-level schedule | 5 | Replaces manual cron management |

### D2. API & Developer Platform (Total: 21 pts)

| ID | Story | Pts | Notes |
|----|-------|-----|-------|
| V2-036 | Public REST API — agent invocation, approvals, operations data via authenticated API | 8 | Enables embedding Velo into other tools |
| V2-037 | Webhooks — push events (approval created, agent completed, compliance due) to external URLs | 5 | Foundation for Zapier/Make integrations |
| V2-038 | Zapier connector — official app with triggers (approval created) and actions (run agent) | 5 | Viral growth via Zapier ecosystem; low engineering cost |
| V2-039 | TypeScript/Python SDK — build custom agents on Velo's PolicyEngine + AuditLogger | 3 | Developer extensibility; ISV ecosystem |

**Theme D Total: 55 pts**

---

## THEME E: Mobile

**Why:** Approvals are the most time-critical action in the platform. They happen on the go. An approver should be able to review evidence, approve, and move on from their phone in under 60 seconds. Mobile also unlocks employee expense capture.

| ID | Story | Pts | Notes |
|----|-------|-----|-------|
| V2-040 | Mobile app (React Native) — approvals, operations summary, chat | 21 | Table stakes for a team product; approval velocity is a core KPI |
| V2-041 | Expense capture — photo of receipt → OCR → expense entry submitted from mobile | 8 | Employee self-service; integrates with AP agent |
| V2-042 | Push notifications — approval requests, compliance alerts, agent completions | 3 | Drives approval velocity |
| V2-043 | Biometric auth on mobile | 2 | Security UX baseline |

**Theme E Total: 34 pts**

---

## THEME F: HR & Payroll Advanced

**Why:** HR module today covers onboarding, leave, and documents. V2 expands to the full people ops lifecycle — performance, ESOPs, benefits, and full & final settlement. These are high-value, high-stickiness features that make churning away from Velo much harder.

| ID | Story | Pts | Notes |
|----|-------|-----|-------|
| V2-044 | Performance management — OKRs, 360 feedback, review cycles | 13 | Turns HR module into full people ops platform |
| V2-045 | ESOP management — grant issuance, vesting schedules, exercise tracking | 8 | Standard at Series A+; no good low-cost tool in India |
| V2-046 | Benefits administration — health insurance, reimbursements, flexible benefits | 8 | Integrates with insurer APIs |
| V2-047 | Full & Final settlement — compute F&F on offboarding (leave encashment, gratuity, TDS) | 8 | Currently HR agent supports tasks; computation is manual |
| V2-048 | Attendance integration — biometric/RFID import for attendance-linked payroll | 5 | Required for factory and field workforce |

**Theme F Total: 42 pts**

---

## THEME G: Security & Enterprise Compliance

**Why:** SOC 2 and data residency are hard gates for enterprise sales in BFSI and government. Session audit replay goes beyond the audit trail table to give external auditors a first-class experience.

| ID | Story | Pts | Notes |
|----|-------|-----|-------|
| V2-049 | SOC 2 Type I readiness — encryption, access logs, incident response runbook | 8 | Gate for enterprise sales; start early |
| V2-050 | Data residency — India-region storage option (Sheets → BigQuery/Cloud SQL) | 5 | BFSI and government mandates |
| V2-051 | IP allowlisting — restrict platform access to corporate network CIDRs | 3 | Enterprise security standard |
| V2-052 | Session recording / audit replay — step-by-step agent run replay for external auditors | 5 | Auditor experience beyond audit trail table |

**Theme G Total: 21 pts**

---

## V2 Summary

| Theme | Pts |
|-------|-----|
| A. Real Data Integrations | 102 |
| B. Multi-Entity & Enterprise RBAC | 66 |
| C. Advanced Intelligence | 66 |
| D. Platform Extensibility | 55 |
| E. Mobile | 34 |
| F. HR & Payroll Advanced | 42 |
| G. Security & Enterprise Compliance | 21 |
| **Total V2** | **386 pts** |

### Recommended Wave Sequencing

**Wave 1 — Enterprise unlock** (~90 pts, 4–5 sprints):
A2 (GST portal) + B2 (enterprise RBAC + SSO) + D2 (API/webhooks)
→ First sales to Series A+ companies

**Wave 2 — Stickiness + differentiation** (~120 pts, 6 sprints):
A1 (banking) + C1 (cash forecasting) + E (mobile) + C2 (anomaly detection)
→ Makes the product indispensable; drives daily active use

**Wave 3 — Platform moat** (~176 pts, 8–9 sprints):
A3 (accounting sync) + D1 (workflow builder) + B1 (multi-entity) + F (HR advanced) + G (SOC 2)
→ Turns Velo into a platform; expands TAM to mid-market
