# Velo — Autonomous Back-Office OS for Startups

> Always-on. Agentic. Outcome-driven. One platform that guarantees salaries paid, taxes never missed, and runway always visible.

---

## What Is This?

Velo is an AI-native, agentic back-office operating system for Indian startups (0–100 employees). It's not a dashboard. It's not a form. It's an **ambient OS** that runs continuously in the background, surfaces only approvals and exceptions, and handles everything else automatically under founder-defined policy.

```
Founder: "Can we hire 2 engineers?"

Velo:  Hiring 2 engineers → burn +₹3.8L/mo → runway 5.2 → 4.1 months.
       Recommendation: proceed only if collections improve or defer Vendor A renewal.
       [Hire 1 engineer]  [Hire 2 + defer Vendor A]  [Start fundraise planning]

Founder: "Hire 2 + defer Vendor A"

Velo:  Defer Vendor A payment by 7 days? Improves runway +0.2 months. No late fees detected.
       [Approve]  [Edit date]  [Reject]

Founder: [Approve]

Velo:  Done. Payment moved to [date]. Runway: 4.3 months.
```

**This is not chat-as-UI. Chat is one surface. The OS also sends you push notifications, email digests, and Slack cards — you approve in Slack, it executes.**

---

## The Core Design Moves

**1. No navigation**
Users don't "go to payroll" or "go to GST." The OS brings the work to them.

**2. Interfaces are evidence, not workspaces**
Every surface shows what happened, what will happen, and what needs consent. Nothing is a data-entry form.

**3. Policy-first agency**
Every execution is gated by an explicit policy. Auto-execute below the threshold, request approval above it, never execute on low confidence. Founder sets the thresholds.

**4. Confidence-scored decisions**
Every LLM decision has a score. Actions above 0.85 auto-execute. Between 0.60–0.85, you get an approval card. Below 0.60, you get a recommendation with no action.

**5. No hardcoding — ever**
Tax rates, expense categories, approval thresholds, payroll rules, agent system prompts, workflow sequences — all in `/configs`. The app reads config at runtime.

---

## What It Guarantees

| Outcome | How |
|---|---|
| Salaries paid correctly, on time | PayrollAgent computes + surfaces approval |
| Taxes never missed | ComplianceAgent generates calendar, alerts 7d + 2d ahead |
| Cash runway always clear | RunwayAgent monitors bank + payables + receivables continuously |
| Hiring decisions with burn visibility | RunwayAgent simulates impact before you commit |
| Compliance always green | All statutory filings tracked, prefilled, approved |
| Employee questions answered instantly | HelpdeskAgent + TaxPlanningAgent, no HR ticket needed |

---

## Agent Architecture

Velo is a multi-agent system. Every LLM decision point is a separate agent with its own system prompt, tools, and confidence thresholds. Agents call other agents. No business logic is hardcoded.

```
OrchestratorAgent
├── RunwayAgent
├── ComplianceAgent
├── PayrollAgent
├── APInvoiceAgent
│   ├── InvoiceExtractorAgent      ← PDF/image → structured fields
│   ├── ExpenseClassifierAgent     ← line items → category + ITC
│   ├── VendorMatcherAgent         ← vendor name/GSTIN → master lookup
│   └── DuplicateDetectorAgent     ← detect duplicate submissions
├── ARCollectionsAgent
├── HRAgent
│   └── DocumentGeneratorAgent     ← offer letters, policy docs, payslips
├── HelpdeskAgent
│   └── TaxPlanningAgent
│
└── [Cross-cutting — no LLM]
    ├── PolicyEngine               ← every action gated here
    ├── ConfidenceScorer           ← scores every LLM decision
    └── AuditLogger                ← append-only trail of everything
```

All agents are defined in `/configs/agents/`. System prompts in `/configs/prompts/`. Workflows in `/configs/workflows/`.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js (App Router) + Tailwind CSS |
| Agents | Anthropic Claude SDK (Sonnet 4.6 / Haiku) |
| Backend | Google Sheets API v4 + Google Drive |
| Auth | Google OAuth (NextAuth.js) |
| Email | Resend |
| Notifications | Slack API / Push / WhatsApp (Phase 2) |
| Hosting | Vercel |
| Monorepo | pnpm workspaces + Turborepo |

---

## Monorepo Package Structure

```
packages/
├── web/          ← Next.js Command Center (chat UI + approval cards + dashboard)
├── agents/       ← All agent runtime code (OrchestratorAgent + all specialists)
├── tools/        ← Tool functions callable by agents (Sheets, email, OCR, Drive)
└── core/         ← Shared types, PolicyEngine, ConfidenceScorer, AuditLogger, ConfigLoader
```

**Dependency rules:** `web → agents, core` | `agents → tools, core` | `tools → core` | `core → nothing`

---

## Config-Driven Everything

```
configs/
├── business/      ← tax rates, payroll rules, expense categories, leave types, compliance rules
├── agents/        ← agent definitions (model, tools, confidence thresholds, sub-agents)
├── prompts/       ← agent system prompts (markdown files, one per agent)
├── policies/      ← autopilot thresholds, RBAC, action overrides
└── workflows/     ← multi-step workflow definitions (sequence of agent calls)
```

Want to change a GST rate? Edit `configs/business/tax_config.json`.  
Want to change who approves payments? Edit `configs/policies/autopilot.json`.  
Want to change how the AP invoice agent behaves? Edit `configs/prompts/ap-invoice.md`.  
**No deploys needed for any of this.**

---

## Personas

| Persona | Primary Interface |
|---|---|
| **Founder** | Weekly digest + approval cards (push/email/Slack) |
| **Finance Lead** | AP/AR exception queue + compliance calendar |
| **HR Lead** | Onboarding workflows + exception queue |
| **Employee** | Self-serve chat (payslips, leave, tax advice) |

---

## Project Status

- [x] Platform plan written (`PLATFORM_PLAN.md`)
- [x] All business config JSONs scaffolded
- [x] Agent configs + workflow configs scaffolded
- [ ] `core` package: types, PolicyEngine, ConfidenceScorer, AuditLogger, ConfigLoader
- [ ] `tools/sheets` package: Sheets CRUD layer
- [ ] Sheets setup script (creates all tabs + headers)
- [ ] AgentRunner: ReAct loop runtime
- [ ] OrchestratorAgent + APInvoiceAgent (first to ship)
- [ ] Next.js Command Center shell + approval card component
- [ ] RunwayAgent: cash/burn computation
- [ ] All remaining agents
- [ ] Onboarding flow (5 screens, <10 min to first runway view)
- [ ] Email notifications (Resend)

---

## Setup (Prototype)

```bash
git clone https://github.com/cobalt-nitrate/velo
cd velo
cp .env.local.example .env.local
# fill in: ANTHROPIC_API_KEY, GOOGLE_SERVICE_ACCOUNT_*, SHEETS_*_ID

pnpm install
pnpm run setup-sheets   # creates all 5 Google Spreadsheets + tab headers
pnpm dev                # starts web package
```

---

## Read the Full Plan

[PLATFORM_PLAN.md](./PLATFORM_PLAN.md) — complete agent architecture, all user journeys, ReAct loop design, confidence scoring, policy engine, Google Sheets schema, integration map, and phase roadmap.

---

*Repo: [cobalt-nitrate/velo](https://github.com/cobalt-nitrate/velo) · Built by Novaforge · Prototype Phase*
