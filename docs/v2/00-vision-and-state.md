# Velo — Product Vision & Current State

## Product Vision

Velo is the operating system for back-office functions in startups and SMEs — starting in India, expandable globally. The end-state vision:

> Every back-office action — from processing a vendor invoice to running payroll to filing GST — is handled by a supervised AI agent. Humans approve, not administer. The company's financial and operational data lives in one place. Nothing falls through the cracks.

The three-layer value proposition:

1. **Execution layer** — Agents take action (create invoices, run payroll, log compliance obligations) faster and more accurately than manual entry
2. **Governance layer** — PolicyEngine + confidence scoring ensures the right human approves the right action; nothing high-stakes executes without a trace
3. **Intelligence layer** — Agents surface what matters (runway risk, overdue AR, compliance deadlines) before humans have to look

**Target customer (V1):** 10–200 person Indian startup with a founder or finance lead who currently juggles back-office manually or with a 2-person ops team. Key pain: too much time in spreadsheets, too many things missed, too many vendors chasing payment.

**Target customer (V2+):** Series B+ company or enterprise division needing multi-entity ops, custom workflows, audit compliance, and integration with ERP and banking.

---

## Product Architecture

Velo is a pnpm monorepo with four packages:

| Package | Role |
|---------|------|
| `packages/core` | Types, PolicyEngine, ConfidenceScorer, AuditLogger, ConfigLoader, WorkflowPersistence |
| `packages/agents` | ReAct runtime, 8 specialist agents, 5 sub-agents |
| `packages/tools` | 100+ sheet tools, Slack/Resend notifications, OCR, PDF generation, Drive management |
| `packages/web` | Next.js 14 command center — chat UI, operations dashboard, approval flow, settings |

**LLM:** OpenAI-compatible API (default: NVIDIA NIM). Each agent gets its own model env var.
**Data store:** Google Sheets (5 workbooks: CONFIG, MASTER, TRANSACTIONS, COMPLIANCE, LOGS).
**Auth:** NextAuth with Google OAuth. Roles: founder, finance_lead, hr_lead, employee.
**Notifications:** Slack Block Kit + Resend email.

---

## Agent Roster

| Agent | Domain | Sub-agents |
|-------|--------|-----------|
| Orchestrator | Intent routing, multi-turn context | All specialists |
| Runway | Cash / burn / runway forecasting | — |
| Compliance | Statutory calendar, GST/TDS/PF/ESIC/PT | — |
| Payroll | Monthly run, salary slips, tax obligations | document-generator |
| AP Invoice | Vendor bill processing, payment workflow | invoice-extractor, expense-classifier, vendor-matcher, duplicate-detector |
| AR Collections | Customer invoicing, receivables tracking | — |
| HR | Onboarding, leave, policy docs | document-generator |
| Helpdesk | Employee self-service, policy Q&A | — |

Sub-agents: invoice-extractor, expense-classifier, vendor-matcher, duplicate-detector, document-generator, tax-planning

---

## Current Build Maturity (Phase 3)

### Core Engine — Production Ready ✅

| Component | Status | Notes |
|-----------|--------|-------|
| ReAct agent runner | ✅ Full | Max iterations, timeout, sub-agent depth, streaming events |
| PolicyEngine | ✅ Full | RBAC + confidence thresholds + action overrides |
| ConfidenceScorer | ✅ Full | 5-signal weighted model (extraction, entity, category, history, freshness) |
| AuditLogger | ✅ Full | Fire-and-forget append to Sheets, queryable by session/company |
| Approval flow (create → notify → resume) | ✅ Full | Slack Block Kit + email + Sheets persistence + workflow resume |
| Workflow executor (pause/resume) | ✅ Full | Linear steps, conditional branches, pause at approval gates |

### Agents — ~80–90% Complete 🟡

| Agent | Status |
|-------|--------|
| Orchestrator | ✅ Full |
| Runway | ✅ Full |
| Compliance | ✅ Full |
| Helpdesk | ✅ Full |
| Payroll | 🟡 ~85% — auto-TDS calculation partial |
| AP Invoice | 🟡 ~85% — payment initiation is placeholder |
| AR Collections | 🟡 ~80% — automated follow-up sequence absent |
| HR | 🟡 ~80% — advanced workflows partial |

### Web UI — ~90% Complete 🟡

| Screen | Status |
|--------|--------|
| Chat workspace (sessions, streaming, live agent panel) | ✅ |
| Operations dashboard (9 tabs, AI triage modal) | ✅ |
| Approval review page | 🟡 Basic — no evidence panel |
| Settings / connector config | ✅ |
| Files + uploads | ✅ |
| Onboarding / setup wizard | ❌ Missing |
| Notifications center | ❌ Missing |
| Team / user management | ❌ Missing |
| Reports / export | ❌ Missing |
| Document viewer | ❌ Missing |

### Integrations — 6 Connectors ✅

Google Sheets · LLM (OpenAI-compatible) · Slack · Resend · Google Drive · Google OAuth

### What's Not Yet Wired

- Live bank API (Sheets only — no HDFC/ICICI/Axis pull)
- GST portal integration (no GSTR-1/3B filing)
- Accounting system sync (Tally, Zoho Books, QuickBooks)
- Decision memory wired to historical pattern scoring
- Cron jobs connected to a host scheduler (Vercel/GitHub Actions)

See [01-v1-backlog.md](./01-v1-backlog.md) and [02-v2-roadmap.md](./02-v2-roadmap.md) for full gap breakdown.
