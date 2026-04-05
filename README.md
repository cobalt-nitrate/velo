# Velo — Autonomous Back-Office OS for Startups

> Policy-first agents, Google Sheets as the system of record, and a Command Center for chat, approvals, and operations.

Velo is an **agentic back-office stack** for Indian startups: payroll, compliance, AP/AR, runway, HR workflows, and employee helpdesk — gated by **policy**, **confidence scoring**, and **human approvals** where it matters.

---

## How It Works (End-to-End)

1. **User** talks to the **Command Center** (`/chat`) or hits **APIs** (`/api/chat`, streaming `messages/stream`).
2. **Orchestrator** (or a specialist agent) runs a **ReAct-style loop** in `@velo/agents`: the LLM proposes tool calls → each call is evaluated by **`PolicyEngine`** (`@velo/core`) and **confidence** → auto-execute, request approval, recommend-only, or refuse.
3. **Tools** (`@velo/tools`) read/write **Google Sheets** (and optionally **Drive**, email, OCR). Sheet tabs map to domains (transactions, master, compliance, logs, config).
4. **Approvals** are persisted to the `approval_requests` tab and surfaced in the UI (`/approvals/[id]`). High-impact actions (payroll, filings, large payments) route to **REQUEST_APPROVAL** per `configs/policies/autopilot.json`.
5. **Audit** events record agent starts, tool proposals, policy decisions, and executions (`@velo/core/audit`).

```text
User → Next.js API → runAgent() → OpenAI-compatible LLM
                    ↓
              PolicyEngine + confidence
                    ↓
         Tool registry (Sheets, Drive, notifications, …)
                    ↓
         Google Sheets / Drive / Resend / Slack
```

---

## What’s Implemented

### Command Center (`packages/web`)

- **App shell**: primary sidebar (Overview, Chat, Files, Uploads, Settings) with **SVG icons**, **expand/collapse** rail, preference saved in `localStorage`.
- **Home (`/`)**: runway tile, approval card, weekly narrative, policy copilot, **platform health** card (`GET /api/health`), links into chat and uploads.
- **Chat (`/chat`)**:
  - Multi-session sidebar, attachments, agent picker.
  - **Streaming runs**: `POST /api/chat/sessions/:id/messages/stream` (NDJSON) with live **Mission control** panel (tool timeline, sub-agents, auto-detected **tables** from tool JSON).
  - Assistant replies rendered as **Markdown** (headings, lists, code, links).
- **Files / uploads**: browse and upload flows wired to APIs.
- **Settings / config**: app configuration surface.
- **Approvals**: review pages for pending decisions.
- **Auth**: NextAuth with Google provider (`/api/auth/[...nextauth]`); optional domain allowlists via env.

### Agents (`packages/agents`)

- **`runAgent(agentId, input, context, options?)`**: configurable **max iterations**, tool loop, **sub-agent delegation** (`internal.sub_agent.invoke`), nested depth limit.
- **Streaming hooks**: optional `onEvent` callback emits structured events (`run.start`, `iteration`, `assistant.delta`, `tool.proposed` / `executing` / `result`, `sub_agent.*`, `run.blocked`, `run.complete`) for the web UI.
- **Workflow executor** (`workflow/executor.ts`): linear workflows from config calling agents and tools.
- Agent definitions: `configs/agents/*.json` (prompt file, model env placeholder, tools, sub-agents, thresholds).

### Tools (`packages/tools`)

- **Google Sheets**: `executeSheetTool` + table map (CONFIG, MASTER, TRANSACTIONS, COMPLIANCE, LOGS workbooks). CRUD and domain reads (e.g. pending AP payables, AR overdue, compliance calendar window, bank balance, headcount, HR blockers, approvals).
- **Platform health** (`platform-health.ts` + `internal.platform.healthcheck`):
  - **Integration probes**: service account, LLM env, each `SHEETS_*_ID` workbook reachability, optional Drive folder, NextAuth in production, Resend, pending approval count.
  - **Operational snapshot** (live data): detailed **pending approvals**, upcoming **compliance_calendar** rows, AP/AR aggregates, **bank** balance/transaction count, **employees** headcount, **HR task** blockers, **`attention_items`** for the LLM to summarize.
- **Documents**: PDF generation, Drive folder layout, uploads; **OCR** (e.g. invoices); **bank statement** parsing; **notifications** (e.g. Slack approval blocks).

### Core (`packages/core`)

- **Types** for agents, tools, policy results.
- **PolicyEngine**: RBAC from `configs/policies/autopilot.json`, confidence floors, payment threshold, filing flags, action overrides; **`internal.platform.healthcheck`** auto-executes when allowed (read-only probe).
- **Confidence** scoring helpers and **tool-confidence** hints in agents.
- **Audit** logger for traceability.

### HTTP APIs (selected)

| Route | Purpose |
|--------|---------|
| `GET /api/health` | Same structured report as `internal.platform.healthcheck` (503 if `overall === fail`). |
| `POST /api/chat` | Stateless agent run with body (message, agentId, companyId, actor…). |
| `GET/POST /api/chat/sessions` | List/create chat sessions. |
| `GET /api/chat/sessions/:id` | Load session + messages. |
| `POST /api/chat/sessions/:id/messages` | Send message (full run, JSON response). |
| `POST /api/chat/sessions/:id/messages/stream` | NDJSON event stream + final session. |
| `POST /api/upload` | Upload file for chat attachments. |
| `GET /api/uploads/:id` | Download stored upload. |
| `GET /api/files` | File listing (Drive-aware when configured). |
| `POST /api/bank-statement` | Parse bank statement (Sheets integration path). |
| `POST /api/policy/simulate` | Evaluate policy for a proposed action. |
| `GET/PATCH …/api/approvals` | Approvals listing / resolution paths. |
| `POST /api/workflow` | Trigger configured workflows. |
| `GET /api/config` | Server config probe for UI. |

---

## Tech Stack (Actual)

| Layer | Choice |
|--------|--------|
| UI | **Next.js 14** (App Router), **Tailwind CSS**, client components for chat/shell. |
| LLM | **OpenAI SDK** against **`LLM_BASE_URL`** (e.g. **NVIDIA NIM** or any OpenAI-compatible API); per-agent models via env (`LLM_MODEL_ORCHESTRATOR`, etc.). |
| Data | **Google Sheets API** (primary); **Google Drive** optional (`VELO_DRIVE_FOLDER_ID`). |
| Auth | **NextAuth.js** + Google OAuth. |
| Email / chat ops | **Resend**, **Slack** (optional; env-driven). |
| Repo | **pnpm** workspaces; **Turbo** optional for `dev`/`build`. |

---

## Monorepo Layout

```text
packages/
├── web/       Next.js Command Center, APIs under app/api/
├── agents/    runAgent, workflows, OpenAI tool loop
├── tools/     Sheet tools, healthcheck, documents, OCR, notifications
└── core/      types, PolicyEngine, confidence, audit, config loader

configs/
├── agents/        Agent JSON (model, tools, prompts file, sub-agents)
├── prompts/       System prompts (markdown)
├── policies/      autopilot.json — thresholds, RBAC, overrides
├── workflows/     Multi-step definitions
└── business/      Tax, payroll, expense metadata (as present)
```

**Dependency direction:** `web` → `agents`, `core`; `agents` → `tools`, `core`; `tools` → `core`; `core` → (no internal packages).

---

## Configuration

- **Change behavior without code deploys**: edit JSON/markdown under `configs/`; agents load prompts and tool lists at runtime.
- **Autopilot**: `configs/policies/autopilot.json` — `payment_auto_threshold_inr`, `filing_auto_execute`, confidence cutoffs, `rbac` roles → allowed action patterns, `action_overrides` per action type.
- **Secrets**: see `.env.local.example` — LLM keys, Google service account, five `SHEETS_*_ID` values, NextAuth, Resend, Slack, optional `VELO_DRIVE_FOLDER_ID`, role email lists.

---

## Local Setup

```bash
cd "Back Office Ops"   # or your clone path
cp .env.local.example .env.local
# Fill LLM_API_KEY, LLM_MODEL_*, GOOGLE_* , SHEETS_*_ID at minimum.

pnpm install
pnpm run setup-sheets          # scaffold spreadsheets / tabs (see script)
pnpm run dev:web               # Next dev for @velo/web (from repo root)
```

Other root scripts: `ensure-bank-tab`, `ensure-file-links`, `audit-sheet-locations`, `seed-mock-data`, `seed-compliance`.

---

## Agent Landscape

| Agent id | Role (high level) |
|----------|-------------------|
| **orchestrator** | First contact; routes to specialists; calls **`internal.platform.healthcheck`** for holistic health + ops snapshot. |
| **runway** | Cash, burn, runway scenarios. |
| **compliance** | GST/TDS/PF/ESIC calendar and filings context. |
| **payroll** | Payroll runs and related sheet operations. |
| **ap-invoice** | Vendor invoices, masters, approvals, Drive upload. |
| **ar-collections** | Receivables, collections. |
| **hr** | HR tasks, employees. |
| **helpdesk** | Employee-facing Q&A flows. |
| Sub-agents (e.g. invoice-extractor) | Invoked via **`internal.sub_agent.invoke`** when wired in config. |

Exact **tool lists** per agent live in `configs/agents/<id>.json`.

---

## Product Docs

- **`docs/v1/ux-contracts.md`** — UI primitives and interaction expectations.
- **`PLATFORM_PLAN.md`** (if present) — broader product/architecture narrative.

---

## License / Attribution

Prototype / internal product. Built by Novaforge. Adjust repository URL and licensing to match your remote.
