# Velo — AI-Powered Back Office for Lean Teams

> One chat interface. All your tax, payroll, HR, and invoices. No more portals, no more Excel chaos.

---

## What Is This?

Velo is a prototype back office operating system built for Indian startups with 3–50 employees. Instead of juggling government portals, CA inboxes, and spreadsheets, you just talk to it.

```
You:   "These 3 invoices came in today — one for the GPU, one for the team dinner."
Velo:  "Got it. GPU (₹85,000) → ITC claimable, adding payee to bank queue.
        Team dinner at 5-star (₹12,000) → 18% GST, ITC blocked under F&B.
        Approve payment schedule?"
```

**Backend: Google Sheets. Config: JSON files. No hardcoded logic. Zero black boxes.**

---

## Four Modules

| Module | What It Handles |
|---|---|
| Tax & Compliance | PT, PF, ESIC, TDS, GST input credit, compliance calendar |
| Payroll | Salary computation, deductions, salary slips, bonus |
| HR Operations | Employee master, leave management, policy doc generation |
| Invoice & Finance | AP (vendor invoices), AR (client invoices), expense tracking |

---

## Tech Stack

- **Frontend:** Next.js + Tailwind CSS
- **AI:** Claude (Anthropic) — intent routing + extraction + conversation
- **Backend:** Google Sheets API v4
- **Config:** JSON files in `/configs` (all business rules live here)
- **Auth:** Google OAuth (NextAuth.js)
- **Hosting:** Vercel

---

## Key Design Principles

1. **No hardcoded logic** — tax rates, expense categories, approval rules, payroll components, leave types, HR policy templates — all in `/configs` JSON files or Sheets config tabs. Change a GST rate = edit a JSON, not a deploy.

2. **Approval gates on all financial actions** — nothing moves money without an explicit "yes" from the founder.

3. **Sheets as the source of truth** — every data table maps to a Google Sheet tab. CA can open it. Founder can download it. No special export needed.

4. **Unstructured in, structured out** — invoices can be PDFs, images, or pasted text. AI extracts and structures them. Only clean, confirmed data hits the sheets.

5. **Full audit trail** — every action logged in `audit_trail` sheet. Append-only.

---

## Project Status

- [x] Platform plan written (`PLATFORM_PLAN.md`)
- [ ] JSON configs scaffolded
- [ ] Google Sheets schema + setup script
- [ ] Next.js app shell + chat UI
- [ ] Claude API integration
- [ ] Module 4a: AP Invoices (first to build)
- [ ] Module 4b: AR Invoices
- [ ] Module 2: Payroll
- [ ] Module 1: Tax & Compliance
- [ ] Module 3: HR Operations

---

## Setup (Coming Soon)

```bash
git clone https://github.com/cobalt-nitrate/velo
cd velo
cp .env.local.example .env.local
# fill in your Google service account key + Anthropic API key
npm install
npm run setup-sheets   # creates all sheet tabs + headers
npm run dev
```

---

## Read the Full Plan

See [PLATFORM_PLAN.md](./PLATFORM_PLAN.md) for the complete architecture, all module flows, Google Sheets schema, config file specs, and what you need to provide to get started.

---

*Built by Novaforge | Prototype Phase*
