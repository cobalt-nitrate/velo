# Velo

**The back office that runs like a team — not another spreadsheet dashboard.**

Velo is built for **early and growing startups in India** (roughly 0–100 people) that are tired of losing money and time to scattered tools, missed deadlines, and “someone should have caught that.” It connects **money** (cash, vendors, customers), **people** (payroll, HR, helpdesk), and **obligations** (GST, TDS, PF, ESIC, and the rest) in one place — with **you** still in charge where it matters.

Your operational truth lives in **Google Sheets** Velo already knows how to read and update; the **Command Center** is where you chat, approve, and see what needs attention. Under the hood, a **team of AI agents** works like specialist functions in a finance and people org — coordinated, audited, and bounded by **policy** so nothing critical ships without the right approval.

---

## Who Velo Is For

Velo is not generic “business software.” It is aimed at **Indian startup operating reality**: INR, April–March financial year, GST and statutory calendars, founder-led decisions, and small teams wearing many hats.

| Who | What they’re trying to do | What Velo helps with |
|-----|---------------------------|----------------------|
| **Founder / CEO** | See runway, sleep at night, approve big moves once | One place for cash picture, exceptions, and **approve / reject** on payroll, filings, and large payments — without digging through ten tabs |
| **Finance lead / CA tie-in** | Pay vendors on time, collect receivables, stay compliant | **AP** (bills, vendors), **AR** (invoices, ageing), **compliance calendar**, and hooks for notifications |
| **HR / people ops** | Onboard people, run payroll, close the month | **Payroll** runs, **HR tasks**, employee master — with approvals where your policy says so |
| **Employees** | Payslips, leave, “how does this tax thing work?” | **Helpdesk-style** answers and self-serve flows (within what you enable) |

Velo **augments** your team; it does **not** replace legal sign-off, your CA, or statutory liability. It **surfaces** work, **drafts** and **routes** actions, and **executes** only what your rules allow.

---

## What Velo Does (In Business Terms)

- **Runway and cash** — Uses bank and transaction data you keep in Sheets to reason about balance, burn, and “what if we hire / defer a payment?” style questions (via the **runway** agent and related tools).
- **Compliance awareness** — Tracks what’s on your **compliance calendar**, what’s due soon, and what’s still open — so “what’s filing this month?” has an answer tied to **your** data (via the **compliance** agent).
- **Vendor money (AP)** — Ingests and processes **vendor invoices**, ties them to **vendor master**, expense categories, and ITC context; escalates payments and anomalies for **approval** (via **ap-invoice** and sub-agents like extraction and matching).
- **Customer money (AR)** — Surfaces **receivables**, **overdue** items, and collections-oriented context (via **ar-collections**).
- **Payroll and people** — Supports **payroll runs**, salary-related data, and **HR workflows** (via **payroll** and **hr**).
- **Employee desk** — Day-to-day **employee questions** (payslips, leave, light guidance) through **helpdesk** — scoped by role and policy.
- **Health of operations** — A **health check** is not only “is Google connected?” It also summarizes **live** queues: pending **approvals**, upcoming **obligations**, open **payables/receivables**, **bank** activity signals, **headcount**, and **HR blockers** — so “how are we doing?” is grounded in **your** sheets.

---

## How the Agent Team Is Organized (Business Hierarchy)

Think of Velo’s agents like reporting lines in a tight ops org — not a bag of anonymous APIs.

### 1. Orchestrator — the “front door”

**Orchestrator** is who users talk to first. In business terms it acts like a **chief of staff**: it understands intent, explains which part of the business is involved, and hands work to the right **specialist**. It also runs a **full operational health** view (integrations **and** what your data says is waiting on someone). It is **not** supposed to quietly run every risky tool itself; execution belongs to the people and agents responsible for that domain.

### 2. Specialist agents — the “function heads”

Each specialist owns a **slice of the business**, similar to how you’d split ownership between finance, payroll, compliance, and HR:

| Agent | Business role (analogy) | Typical concerns |
|-------|-------------------------|------------------|
| **Runway** | FP&A / cash discipline | Runway months, burn, scenarios (“can we afford X?”) |
| **Compliance** | Company secretary + indirect tax rhythm | Filing calendar, due dates, statutory tracking |
| **Payroll** | Payroll ops | Monthly run, salaries, deductions, slips |
| **AP invoice** | Accounts payable | Vendor bills, matching, payment readiness |
| **AR collections** | Accounts receivable | Invoices, dues, follow-up context |
| **HR** | People operations | Onboarding tasks, employee records, HR workflows |
| **Helpdesk** | Internal HR help line | Employee questions, light guidance |

They use **tools** that map to real work: updating the right **tabs** in your Velo workbooks, sending **notifications**, attaching **documents**, and creating **approval requests** when policy says a human must sign off.

### 3. Sub-agents — “specialists inside specialists”

Some jobs are **narrow but fiddly** (e.g. “read this PDF invoice,” “classify this line item,” “is this a duplicate?”). **Sub-agents** are smaller, focused helpers that a specialist can call in — like asking a **senior analyst** to pull in a **researcher** for one step. That keeps the main agent coordinated while the detail work stays reliable and testable.

### 4. Policy, confidence, and approvals — “the governance layer”

Not every suggestion becomes a bank transfer or a filed return. **Policy** encodes who may do what, payment thresholds, and when filings must get explicit sign-off. **Confidence** scores borderline model judgment. **Approvals** land in a **queue** you can open in the product — tied to audit and your Sheet data — so “who decided what, when” is clear.

---

## What You Use Day to Day (Product Surfaces)

- **Overview** — At-a-glance runway-style signals, what’s blocked, and links into chat and health.
- **Chat** — Conversation with the orchestrator or a chosen specialist; attachments; optional **live mission** sidebar on large screens (tools and data updating as the run progresses).
- **Approvals** — Clear **approve / reject** paths for gated actions.
- **Files & uploads** — Bring documents into flows Velo can use (invoices, statements, etc.).
- **Settings** — Workspace preferences, read-only **company_settings** from Sheets, **connector status** (which env vars are set), and API hints for workflows and cron.
- **Operations** — Live snapshot from the same data the agents use: **approvals** (with module filters and review links), compliance, AP/AR, bank, team, HR — plus triage helpers.

---

## For Builders: Technical Overview

Velo is a **monorepo**: **`packages/web`** (Next.js Command Center + APIs), **`packages/agents`** (agent runtime, streaming events, **config-driven workflows** with **pause/resume after approval**), **`packages/tools`** (Sheets, Drive, healthcheck, documents, OCR, email via Resend, Slack notifications), **`packages/core`** (policy, confidence, audit, workflow persistence, **connector-kit** TypeScript seams for your own HTTP ledger/notification adapters). Behavior is **config-driven** under **`configs/`** (agents, prompts, policies, workflows). The LLM uses an **OpenAI-compatible API** (`LLM_BASE_URL`; e.g. NVIDIA NIM). The default **system of record** is **Google Sheets** (workbooks keyed by `SHEETS_*_ID` in `.env.local`; see `.env.local.example`).

### Running Velo (development and Docker)

Velo is a **pnpm monorepo**. The **web app** is the only long-running server in development: **Next.js 14** in `packages/web` serves the UI and **Route Handlers / API routes** under `app/api`. There is **no separate backend process** — **`@velo/agents`**, **`@velo/core`**, and **`@velo/tools`** are libraries linked into the Next.js build.

#### Prerequisites

| Requirement | Notes |
|-------------|--------|
| **Node.js** | **>= 20** (`package.json` `engines`) |
| **pnpm** | **>= 9** — pinned to **9.15.0** via `packageManager`. Use `corepack enable` then `corepack prepare pnpm@9.15.0 --activate` |
| **PostgreSQL** | **16** recommended (see `docker-compose.yml`). Required for Prisma (users, invites, onboarding, app settings) |
| **Docker** (optional) | Docker Engine + Compose for `docker compose` (bundled Postgres + production-style web image) |

#### Install dependencies

From the **repository root**:

```bash
corepack enable
pnpm install
pnpm --filter @velo/web exec prisma generate
```

#### Environment variables

1. **Local dev:** Next.js loads **`.env.local` from `packages/web`** (that package is the cwd for `pnpm dev` / `pnpm dev:web`). Copy the template there:

   ```bash
   cp .env.local.example packages/web/.env.local
   ```

2. Edit **`packages/web/.env.local`**. At minimum set **`DATABASE_URL`**, **`NEXTAUTH_SECRET`**, **`NEXTAUTH_URL`**, and **LLM** settings (`LLM_API_KEY`, `LLM_BASE_URL`, model env vars). For Google Sheets, set **`GOOGLE_SERVICE_ACCOUNT_EMAIL`**, **`GOOGLE_PRIVATE_KEY`**, and **`SHEETS_*_ID`** (or use in-app onboarding to create/link workbooks). The full list and comments are in **`.env.local.example`**.

3. **Docker Compose** reads **`.env.local` at the repo root** (`docker-compose.yml` `env_file`). Avoid drifting copies:

   ```bash
   ln -sf packages/web/.env.local .env.local   # macOS / Linux
   ```

   On Windows, keep **root** `.env.local` in sync with **`packages/web/.env.local`** when you change secrets.

#### Database

- **Schema:** `packages/web/prisma/schema.prisma` · **migrations:** `packages/web/prisma/migrations/`.

**Run PostgreSQL**

- **Docker (DB only):** `docker compose up postgres -d` — **`localhost:5432`**, user **`velo`**, password **`velo_local`**, database **`velo`** (matches `.env.local.example`).
- **Native install:** create a role/database and set **`DATABASE_URL`** accordingly.

**Apply migrations** (from repo root). Use the **`run` scripts** so **`packages/web/.env.local`** is loaded — raw `pnpm exec prisma …` does **not** read `.env.local` (only `.env`).

```bash
pnpm --filter @velo/web run db:migrate          # interactive (migrate dev)
pnpm --filter @velo/web run db:migrate:deploy   # non-interactive (CI / deploy)
```

#### Run the development server

```bash
pnpm dev          # turbo; only @velo/web defines `dev`
pnpm dev:web      # same app, filter only the web package
```

- Default: **http://localhost:3000** (Next picks another port if busy).
- Scripts use **`node -r ./lib/register-env.cjs … next dev`** so **`.velo/connector-env.json`** can fill unset keys; prefer **`pnpm dev:web`** over raw `next dev`.
- Broken build cache: **`pnpm dev:web:clean`** (deletes `packages/web/.next`).

#### Optional: Sheets scripts and agent E2E

After Google and sheet IDs are configured:

| Command | Purpose |
|---------|---------|
| `pnpm setup-sheets` | Create Velo workbooks/tabs (`scripts/setup-sheets-run.js`; may need local edits) |
| `pnpm ensure-bank-tab` | Ensure bank transactions tab |
| `pnpm ensure-file-links` | Ensure file links tab |
| `pnpm seed-mock-data` | Seed mock Velo data |
| `pnpm seed-mock:generate` | Generate demo seed JSON |
| `pnpm seed-compliance` | Seed compliance calendar |
| `pnpm audit-sheet-locations` | Audit configured sheet IDs |
| `pnpm e2e:modules` | Agents package: one tool + approval path per module |

#### Docker Compose (Postgres + web)

Requires **repo root** `.env.local`. Compose overrides **`DATABASE_URL`** to the **`postgres`** service and sets **`NEXTAUTH_URL=http://localhost:3000`**.

```bash
docker compose up --build
```

The production **runner image** is Next **standalone** — it does **not** ship the Prisma CLI. Apply migrations **from the host** (or any checkout with `pnpm`) against the published DB port, e.g.:

```bash
pnpm --filter @velo/web run db:migrate:deploy
# or inline (no .env files):
DATABASE_URL=postgresql://velo:velo_local@localhost:5432/velo pnpm --filter @velo/web exec prisma migrate deploy
```

**Volumes:** `postgres_data` (database) · `velo_data` → `/app/.velo` (uploads, local connector overlay). See **`Dockerfile`** for build stages.

#### Production mode (no Docker)

```bash
pnpm build
pnpm --filter @velo/web start
```

#### Minimal quick reference

1. `pnpm install` → `pnpm --filter @velo/web exec prisma generate`
2. PostgreSQL up · **`DATABASE_URL`** in **`packages/web/.env.local`**
3. `pnpm --filter @velo/web db:migrate`
4. LLM + **`NEXTAUTH_*`** + Google/sheet IDs as needed
5. `pnpm dev:web`

#### Tests and lint

```bash
pnpm validate-configs   # Zod validation for configs/agents/workflows
pnpm lint               # all workspaces that define `lint`
pnpm test               # Vitest (e.g. `packages/core`, `packages/agents`, `packages/tools`)
pnpm verify:ci          # validate-configs + `tsc --noEmit` on all TS packages (same as CI)
```

### CI and config validation

- **`pnpm validate-configs`** — Zod-checks `configs/business`, `configs/policies`, `configs/workflows`, and all agent JSON.
- **`pnpm verify:ci`** — Validates configs plus `tsc --noEmit` on **core**, **agents**, **tools**, **web** (used by **GitHub Actions** in `.github/workflows/ci.yml`).

### Workflow and approval APIs (HTTP)

| Method | Route | Purpose |
|--------|--------|--------|
| `POST` | `/api/workflows/run` | Start a linear workflow (`workflowKey` + optional `context` + actor fields). May return **`WAITING_FOR_APPROVAL`** and a **`run_id`**. |
| `POST` | `/api/workflows/resume` | After an approval is **APPROVED** in Sheets/UI, continue the deferred tool and remaining steps (`run_id` + same actor context as run). |
| `GET` | `/api/workflows/runs?status=WAITING_FOR_APPROVAL` | List persisted runs (backed by **`.velo/workflow-runs.json`** under the repo root unless `VELO_STATE_DIR` is set). |

Agent runs surface **policy + confidence** (including deterministic risk caps for large amounts / filing-shaped tools), **audit events** (start, tool proposed, policy decision, approval requested, completion/failure), and **Slack + optional email** when a new approval row is created (`VELO_APPROVAL_EMAIL_TO`, Resend).

### Scheduled jobs (cron)

Protected by **`VELO_CRON_SECRET`**: send header **`x-velo-cron-secret`** or **`Authorization: Bearer <secret>`**.

| Route | Purpose |
|--------|--------|
| `POST /api/cron/digest` | Slack digest from **platform health** + optional email (`VELO_DIGEST_EMAIL_TO`). |
| `POST /api/cron/escalate-approvals` | Mark **PENDING** approvals past **`expires_at`** as **EXPIRED**, then alert Slack (and optional email). |

Use your host’s scheduler (Vercel Cron, GitHub Actions, etc.) to hit these endpoints.

### Other useful API areas

Chat (**streaming** where enabled), health, uploads, **`PATCH /api/approvals/[id]`**, policy simulate, operations snapshot and related **`/api/operations/*`** routes, bank-statement and files, **`GET /api/config/integrations`** (boolean “configured” flags only — never secrets).

---

## Further Reading

- **`PLATFORM_PLAN.md`** — Deeper product and architecture narrative.
- **`docs/v1/ux-contracts.md`** — How key UI patterns should behave.

---

## License / Attribution

Prototype / internal product. Built by Novaforge. Adjust repository URL and licensing to match your remote.
