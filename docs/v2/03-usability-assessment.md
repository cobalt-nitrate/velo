# Usability Assessment — User Journeys & Agent Behaviors

---

## 1. When the User Comes to the Platform

### First-Time User (Day 1)

**Current experience (broken):**
- Lands on dashboard — empty state, no guidance
- No onboarding wizard, no "what to do first" prompt
- Must create 5 Google Sheets workbooks manually via CLI
- Role assignment requires editing env vars + server restart
- Result: ~80% estimated drop-off before first agent run

**Target V1 experience:**
1. Redirected to `/welcome` — 5-step wizard
2. Step 1: Connect LLM — paste API key, test connection shows green checkmark
3. Step 2: Connect Google — service account email + key, platform auto-creates 5 workbooks
4. Step 3: Invite team — email-based invite with role selector
5. Step 4: Seed data — choose demo data or import CSV (employees, vendors)
6. Step 5: First run — "Ask the orchestrator anything" with suggestion chips ("What's our runway?", "Show pending payables", "Upcoming compliance dates")

---

### Returning User (Daily Use)

**What they see on arrival:**
- Overview (`/`) — 3 priority tiles: pending approvals count, runway months, next compliance deadline
- Notification bell with unread badge
- Recent chat sessions in sidebar

**Primary daily flows:**

| Flow | Steps |
|------|-------|
| **Approval review** | Notification bell → Click approval → Review evidence panel → Approve or Reject with note |
| **Ad-hoc finance query** | Chat → "What's our runway if we hire 2 engineers?" → Runway agent responds with live Sheets data |
| **Operations triage** | Operations page → Overdue AR tab → Click Triage → AI analysis modal → "Open chat" → AR agent drafts follow-up email → Approve + send |
| **Invoice upload** | Drag PDF to uploads → AP agent auto-processes → Approval request created if confidence < 0.85 |
| **Compliance check** | Operations → Compliance tab → GST due in 3 days → Triage → Agent prepares filing summary → Founder approves |

---

### Finance Lead (Power User)

- Starts day on Operations page, reviews AP aging and overdue AR
- Bulk-approves low-confidence vendor payments from approval list
- Exports AP/AR tab to CSV for external reporting or CA
- Uses chat for ad-hoc queries: "Total SaaS spend this quarter" / "Which vendors have outstanding >30 days"
- Gets weekly digest email on Monday morning with snapshot

---

### Employee (Self-Service)

- Logs in to download payslip → Helpdesk agent or document portal
- Applies for leave: chat "Apply 3 days PL from Dec 23–25" → HR agent processes
- Views own documents: offer letter, experience certificate
- Asks tax questions: "How much home loan deduction can I claim?" → Helpdesk agent (scoped to policy + basic tax guidance)

---

## 2. When the User Does NOT Come to the Platform

This is the product's core value proposition — the back-office keeps running even when no one is watching.

### Always-On Behaviors (Current)

| Behavior | Trigger | Frequency | Output |
|----------|---------|-----------|--------|
| Compliance due date alerts | Cron (configurable interval) | Every 12h | Slack `#compliance` with days-until-due |
| Weekly operations digest | Every Monday 9am IST | Weekly | Slack + email: runway, AP/AR, HR blockers, compliance |
| Approval escalation | Cron: daily | Daily | Mark PENDING approvals past `expires_at` as EXPIRED, re-notify on Slack |

### Missing Autonomous Behaviors (V1 Gaps)

| Behavior | Why It Matters |
|----------|---------------|
| Runway below threshold alert | Founder should know before it's too late — not only when they log in |
| Overdue AR escalation sequence | AR agent should auto-draft follow-up emails at T+7, T+14, T+21 without waiting for user input |
| Vendor payment due date alert | AP due date approaching — alert finance lead before invoice becomes overdue |
| Anomalous bank transaction flag | Unusual transaction outside normal patterns — surface for human review |
| Payroll run reminder | 5 business days before month-end, remind finance lead to initiate payroll run |

### What Agents Should Do Between Sessions (V2 Ideal)

**AR Agent (background, daily):**
```
1. Pull open AR list each morning
2. For invoices 7+ days overdue: draft follow-up email, queue for finance_lead approval
3. For invoices 30+ days overdue: escalate to founder via Slack DM
4. For newly reconciled payments (if bank connected): mark invoice as paid
```

**Compliance Agent (background, daily):**
```
1. Check compliance calendar against today's date
2. 15 days before filing: create checklist task for finance_lead (data required list)
3. 3 days before filing: Slack DM to founder + finance_lead with urgency flag
4. On filing day if unfiled: escalate with penalty risk amount
```

**Runway Agent (background, weekly):**
```
1. Compute burn rate from last 4 weeks of bank transactions
2. < 4 months runway: amber alert to founder (Slack + email)
3. < 2 months runway: red alert with suggested cost reduction actions
4. Include updated projection in Monday digest
```

---

## 3. UX Anti-Patterns to Fix (V1)

| Problem | Where | Fix |
|---------|-------|-----|
| Agent selection resets to default on every page load | Chat workspace | Persist selected agent to session |
| Approval evidence is empty for most approvals | `/approvals/[id]` | Wire evidence extraction to approval creation in the agent runner |
| Operations triage fetch has no loading skeleton | Operations page | Add shimmer skeleton during POST to `/api/operations/triage` |
| Connector settings lost after server restart | `server-bootstrap.ts` | Ensure `.velo/connector-env.json` is applied on every boot, not just first load |
| Chat streaming fails silently on SSE disconnect | Chat workspace | Show reconnection notice + offer fallback mode |
| File uploads have no per-file progress indicator | Uploads page | Add `<progress>` or styled bar per file |
| No way to stop an in-flight agent run | Chat workspace | Add Stop button that calls `POST /api/chat/abort` |
| Approval review page breaks on mobile | `/approvals/[id]` | Fix Tailwind layout for `<768px` |
| Sessions list shows raw ID, not readable title | Chat sidebar | Auto-generate title from first message (truncated to 40 chars) |
| Settings save to `process.env` — reset on process restart | Settings page | Confirm write to `.velo/connector-env.json` AND show "applied" state |

---

## 4. Latency Targets

| Operation | Current Estimate | V1 Target |
|-----------|-----------------|-----------|
| Agent first token (streaming start) | 2–4s (cold LLM) | < 1.5s |
| Operations snapshot load | 3–5s (sequential Sheets) | < 2s (parallel batch reads) |
| Approval page load | < 1s | < 1s (already fine) |
| Connector test (Google Sheets) | ~2s | < 1s |
| PDF generation (salary slip) | 5–10s | < 5s |
| OCR extraction (1-page invoice) | 8–15s | < 6s (Tesseract WASM warm cache) |

---

## 5. Key Missing Pages (V1)

| Page | Route | Priority |
|------|-------|----------|
| Onboarding wizard | `/welcome` | P0 |
| Team management | `/settings/team` | P0 |
| Health status | `/settings/health` or `/health` | P1 |
| Document registry | `/documents` | P1 |
| Notification history | `/notifications` | P1 |
| User profile | `/profile` | P2 |
| Approval history | `/approvals?tab=history` | P2 |
| Employee self-service portal | `/me` | P2 |
