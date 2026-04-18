# V1 Completion Backlog

Story point scale: Fibonacci — 1 = trivial, 2 = easy, 3 = small, 5 = medium, 8 = large, 13 = xlarge, 21 = epic (split before starting)

---

## EPIC 1: First-Run Experience & Onboarding

**Why:** New users land with no guidance. Zero empty states, zero setup wizard. The product requires manually creating 5 Google Sheets workbooks via CLI and editing env vars to assign roles. This is the #1 activation blocker — ~80% drop-off before first agent run.

**Total: 34 pts**

| ID | Story | Pts | Notes |
|----|-------|-----|-------|
| V1-001 | Onboarding wizard — 5-step flow: LLM → Google Sheets → Slack → team roles → seed data | 13 | Highest activation impact; guides zero-to-first-agent-run |
| V1-002 | Empty state designs — chat, operations, approvals pages when no data exists | 3 | Show contextual "what to do first" prompts per page |
| V1-003 | One-click Sheets bootstrap from UI — auto-create all 5 workbooks with correct tabs | 8 | Currently requires CLI; blocks self-serve entirely |
| V1-004 | Sample data seeder from UI — populate demo employees, invoices, compliance calendar | 5 | Let users explore before committing real data |
| V1-005 | "Platform ready" confirmation screen with checklist of connected services | 2 | Trust signal after onboarding completes |
| V1-006 | Help tooltips on key UI actions — approval review, operations tabs, chat composer | 3 | In-context help reduces first-week support load |

---

## EPIC 2: User & Team Management

**Why:** Role assignment is done via env vars (`VELO_FOUNDER_EMAILS`). No invite flow, no UI. Not viable as a team product — a finance lead can't onboard without a developer touching `.env.local`.

**Total: 29 pts**

| ID | Story | Pts | Notes |
|----|-------|-----|-------|
| V1-007 | Team management page — list users, assign roles (founder, finance_lead, hr_lead, manager, accountant, employee) | 8 | Replace env-var role assignment entirely |
| V1-008 | Invite flow — send invite link, Google OAuth onboarding for invitee | 8 | Core for any multi-user usage |
| V1-009 | User profile page — name, role, last activity, notification preferences | 3 | Self-service account management |
| V1-010 | Role-based UI visibility — hide nav items and actions the user's role can't access | 5 | Employee sees only helpdesk + leave; finance_lead sees AP/AR/compliance |
| V1-011 | Session management — view active sessions, revoke access | 3 | Security baseline for team product |
| V1-012 | Persist actor_role to session — role shouldn't reset to settings default on each login | 2 | UX polish; eliminates daily confusion |

---

## EPIC 3: Approval UX Hardening

**Why:** The approval flow is functionally complete but the review experience is minimal. The approval page shows action text and a textarea — no evidence, no confidence breakdown, no history. Finance leads need context to make confident decisions.

**Total: 26 pts**

| ID | Story | Pts | Notes |
|----|-------|-----|-------|
| V1-013 | Evidence panel on approval page — extracted invoice fields, vendor match quality, past payment history | 8 | Most impactful single UX improvement |
| V1-014 | Confidence breakdown display — show per-signal scores (extraction 0.9, vendor 0.7, freshness 1.0) | 3 | Transparency in why agent is requesting approval |
| V1-015 | Approval list improvements — sortable columns, filter by module, bulk-approve low-risk items | 5 | Finance lead managing 20 approvals/week needs efficiency |
| V1-016 | Approval expiry handling — expired badge + one-click resubmit | 3 | Approvals currently expire silently with no recovery path |
| V1-017 | Slack approval card → deep link to web review (not just acknowledge) | 3 | Slack button should open the evidence page, not just confirm |
| V1-018 | Approval history tab — searchable log with outcome, approver, notes | 3 | Audit readiness; also useful for finance reconciliation |
| V1-019 | Mobile-responsive approval review page | 1 | Approvals frequently happen on phones; current layout breaks at <768px |

---

## EPIC 4: Operations Dashboard Enhancements

**Why:** Operations page is the most powerful screen but data is flat tables only. No trends, no aging summaries, no drill-downs. Finance leads accustomed to accounting tools will miss these views.

**Total: 21 pts**

| ID | Story | Pts | Notes |
|----|-------|-----|-------|
| V1-020 | Runway tile with mini trend chart — 6-month burn, projected exhaustion date | 5 | Most-watched founder metric; needs visual not just text |
| V1-021 | AP aging summary — invoices grouped by 0–30, 31–60, 60+ days overdue | 3 | Standard finance view; drives payment prioritisation |
| V1-022 | AR collections summary — total outstanding, avg days to collect, top 5 overdue | 3 | Mirror of AP; drives urgency on collections follow-up |
| V1-023 | Compliance calendar view — monthly grid layout showing filing due dates | 5 | Table exists; calendar layout is more actionable for planning |
| V1-024 | Operations page export — download any tab as CSV | 3 | Basic reporting need; finance leads live in spreadsheets |
| V1-025 | Bank transactions search + filter — by narration, date range, amount | 2 | Currently shows flat list with no search |

---

## EPIC 5: Document Management

**Why:** Generated documents (salary slips, offer letters, certificates) currently disappear into Google Drive. There's no dedicated document registry in the platform, no in-browser preview, and employees have no self-service access to their own documents.

**Total: 18 pts**

| ID | Story | Pts | Notes |
|----|-------|-----|-------|
| V1-026 | Documents page — list all generated docs with filter by type and employee | 5 | Central document registry replacing Drive folder browsing |
| V1-027 | In-browser PDF preview — view generated documents without leaving the platform | 5 | Reduces Drive dependency; critical for finance review |
| V1-028 | Document re-generation — trigger reprint of salary slip or offer letter without full agent run | 3 | HR and finance frequently need reprints |
| V1-029 | Employee document portal — employee-facing view of their own payslips, offer letter, certs | 5 | Self-service; reduces HR query volume significantly |

---

## EPIC 6: In-App Notification System

**Why:** Platform currently relies 100% on Slack and email for alerting. Users who don't have Slack open miss approvals, compliance deadlines, and agent completions. There's no notification history in the product.

**Total: 13 pts**

| ID | Story | Pts | Notes |
|----|-------|-----|-------|
| V1-030 | Notification bell — badge count of pending approvals + compliance alerts in nav | 5 | Baseline attention system without Slack dependency |
| V1-031 | Notification history page — all past notifications (agent actions, approvals, alerts) | 3 | Replaces need to scroll Slack channels for history |
| V1-032 | Notification preferences per user — toggle email/Slack/in-app per event type | 3 | Reduce noise; non-founders currently get all alerts |
| V1-033 | Browser push notifications for new approvals (PWA) | 2 | Drives approval velocity for mobile-first users |

---

## EPIC 7: Error Handling & Reliability

**Why:** The platform has no user-facing error recovery. When the LLM times out, when Google Sheets quota is exceeded (60 req/min limit), or when an agent fails mid-run, the user sees a raw error and has no path to retry or recover.

**Total: 21 pts**

| ID | Story | Pts | Notes |
|----|-------|-----|-------|
| V1-034 | Health dashboard page — real-time connector status with last-checked timestamp | 3 | `/api/health` endpoint exists; just needs a UI page |
| V1-035 | Agent run error recovery — show retry option + error summary in chat on failure | 5 | Currently surfaces raw JS error to user |
| V1-036 | Sheets quota exceeded — graceful handling with retry queue and user-facing message | 3 | Real production risk; 60 req/min is easy to hit |
| V1-037 | LLM timeout fallback — surface partial results + manual action suggestion if agent times out | 3 | 30s timeout exists; failure UX is entirely absent |
| V1-038 | Vendor match disambiguation UI — when match is ambiguous (0.6–0.8), let user pick | 5 | Currently auto-picks best match; wrong vendor on payment is costly |
| V1-039 | Stale workflow cleanup — surface and archive runs stuck in WAITING_FOR_APPROVAL > 7 days | 2 | `workflow-runs.json` will grow unbounded; needs housekeeping |

---

## EPIC 8: Agent Quality & Domain Logic

**Why:** Core agent scaffolding is complete but three critical domain paths are partially placeholder: TDS auto-calculation in payroll, payment initiation in AP, and automated collections sequences in AR.

**Total: 21 pts**

| ID | Story | Pts | Notes |
|----|-------|-----|-------|
| V1-040 | Payroll agent — auto TDS calculation (old vs. new tax regime) from salary structure | 8 | Currently creates obligations but doesn't compute actual TDS deduction |
| V1-041 | AP agent — payment initiation output: bank transfer instruction + payee record creation | 8 | Approval chain works; the final payment step is a placeholder |
| V1-042 | AR agent — automated collections follow-up sequence: T+0, T+7, T+14 with escalating tone | 5 | Single email exists; sequence logic and scheduling absent |

---

## EPIC 9: Security & Access Baseline

**Why:** Pre-ship hardening before any customer financial data goes into the platform. LLM apps have a unique prompt injection surface; file uploads are currently unvalidated; audit events have no integrity protection.

**Total: 13 pts**

| ID | Story | Pts | Notes |
|----|-------|-----|-------|
| V1-043 | CSP headers + rate limiting on all `/api` routes | 3 | Baseline defence against abuse |
| V1-044 | Input sanitisation on agent chat inputs — prevent prompt injection | 5 | LLM-specific attack surface; must be closed before customer data |
| V1-045 | Audit log row hashing — add tamper-detection hash to each audit event | 3 | Required for compliance product positioning |
| V1-046 | Secure file upload — file type validation + virus scan stub before OCR | 2 | Currently accepts any file; OCR pipeline processes blindly |

---

## V1 Summary

| Epic | Pts |
|------|-----|
| 1. First-Run / Onboarding | 34 |
| 2. User & Team Management | 29 |
| 3. Approval UX Hardening | 26 |
| 4. Operations Dashboard | 21 |
| 5. Document Management | 18 |
| 6. Notification System | 13 |
| 7. Error Handling & Reliability | 21 |
| 8. Agent Quality | 21 |
| 9. Security Baseline | 13 |
| **Total** | **196 pts** |

**Velocity reference:** At a 2-engineer team doing ~20 pts/sprint (2-week sprints), V1 completion is ~10 sprints (~5 months). Priority order: Epics 1 → 2 → 3 → 9 → 8 → rest.
