# Enterprise Role Structure

---

## Current State (4 Roles, Env-Var Assigned)

| Role | Access | Limitation |
|------|--------|-----------|
| `founder` | `["*"]` — all actions | Catch-all; no granularity |
| `finance_lead` | AP, AR, compliance, bank | Can't be scoped to just AP or just AR |
| `hr_lead` | HR, employees, leave, limited payroll | Can't be scoped to department |
| `employee` | Helpdesk, own payslip, own leave | No way to grant limited finance visibility |

**Problem:** Roles are assigned by listing email addresses in env vars (`VELO_FOUNDER_EMAILS`, `VELO_FINANCE_EMAILS`, etc.). No UI, no invite flow, no role changes without a developer touching `.env.local` and restarting the server.

---

## V1 Target Role Model (6 Roles, UI-Assigned)

Replace env-var assignment with a `user_roles` table in PostgreSQL, managed via the team management UI.

| Role | Description | Key Permissions |
|------|-------------|-----------------|
| `founder` | Company owner, ultimate approver | All actions including terminate_employee, file_gst_return, run_payroll |
| `finance_lead` | CFO / finance head | AP, AR, compliance, bank, payroll view, approval.resolve |
| `hr_lead` | HR manager / people ops | HR, employees, leave, payroll view, document generation |
| `manager` | Team / department manager | Leave approval for own team, employee view (own team), helpdesk |
| `accountant` | External CA / bookkeeper | Read-only AP, AR, compliance, bank; can create draft entries only |
| `employee` | Individual contributor | Own payslip, own leave, own documents, helpdesk queries |

**Implementation path:**
1. Add `user_roles` table (columns: email, role, invited_by, invited_at, last_login)
2. Modify `packages/core/src/policy-engine/index.ts` to load roles from PostgreSQL at session resolution (with 5-minute cache)
3. Remove env-var role derivation from `packages/web/app/api/auth/[...nextauth]/route.ts`
4. Build `/settings/team` page for invite and role management

---

## V2 Enterprise Role Model

### Role Hierarchy

```
Organization
└── Super Admin (platform-level: manage entities, billing, SSO config)
    └── Entity Admin (per-company: manage users within one entity)
        ├── Finance
        │   ├── CFO / Finance Head      full visibility + all approvals
        │   ├── Finance Manager         AP+AR+bank, approve up to configured DoA threshold
        │   ├── AP Specialist           create invoices, cannot approve payment
        │   ├── AR Specialist           create invoices, send follow-ups
        │   └── Read-Only Auditor       no mutations; all finance data visible
        ├── HR
        │   ├── HR Head                 full HR, payroll run, policy documents
        │   ├── HR Manager              onboarding, leave approval, limited payroll view
        │   ├── Payroll Specialist      compute payroll, cannot approve disbursement
        │   └── Recruiter               candidate pipeline, offer letter generation only
        ├── Operations
        │   ├── COO / Founder           all visibility, all approvals
        │   └── Department Head         own department budgets, headcount, leave approval
        └── Employee                    self-service: own payslip, own leave, helpdesk
```

### Delegation of Authority (DoA) Matrix

Configurable per organization. Default matrix:

| Action | Up to ₹10k | ₹10k – ₹1L | ₹1L – ₹10L | > ₹10L |
|--------|-----------|------------|------------|--------|
| Vendor payment | AP Specialist (auto) | Finance Manager | CFO | Founder |
| Client refund | AR Specialist | Finance Manager | CFO | Founder |
| Payroll run | Payroll Specialist (auto) | HR Head | CFO | Founder |
| Hiring (offer letter) | Recruiter (auto) | HR Head | COO | Founder |
| Statutory filing | Finance Manager | CFO | Founder | Founder |
| Bank transfer | Finance Manager | CFO | Founder | Founder |

This matrix feeds directly into PolicyEngine's `action_overrides` and per-role confidence thresholds in `configs/policies/autopilot.json`.

### Role Permissions Model (V2)

Each role has permissions at three levels:

1. **Module** — which agent domains they can trigger (`ap`, `ar`, `hr`, `payroll`, `compliance`, `runway`)
2. **Action** — `read` vs. `draft` vs. `approve` vs. `execute` within a module
3. **Scope** — which records: `own`, `department:<name>`, `cost_center:<id>`, `entity:<id>`, `all`

Example custom role definition (`configs/rbac/custom_roles.json`):

```json
{
  "id": "dept_head_engineering",
  "label": "Engineering Department Head",
  "inherits": "manager",
  "overrides": {
    "hr.leave.approve":   { "scope": "department:engineering" },
    "hr.employee.view":   { "scope": "department:engineering" },
    "payroll.view":       { "scope": "department:engineering" },
    "ap.invoice.create":  { "scope": "cost_center:engineering" }
  }
}
```

---

## Multi-Level Approval Chains (V2)

Configured per organization in `configs/policies/approval_chains.json`. PolicyEngine evaluates the chain on each approval request, routing to the next approver when the current step resolves.

```json
{
  "vendor_payment_high_value": {
    "trigger": {
      "action": "ap_invoice.approve_payment",
      "amount_gt_inr": 500000
    },
    "approvers": [
      { "step": 1, "role": "finance_lead", "timeout_hours": 24, "on_timeout": "escalate" },
      { "step": 2, "role": "founder",       "timeout_hours": 48, "on_timeout": "escalate" }
    ],
    "parallel": false
  },
  "payroll_run": {
    "trigger": { "action": "payroll.run" },
    "approvers": [
      { "step": 1, "role": "hr_lead",      "timeout_hours": 24, "on_timeout": "escalate" },
      { "step": 2, "role": "finance_lead", "timeout_hours": 24, "on_timeout": "escalate" }
    ],
    "parallel": false
  }
}
```

---

## Approval Delegation

When a role-holder is out of office, they can delegate approval authority to another user for a defined period:

```
POST /api/approvals/delegate
{
  "delegator_id": "user_abc",
  "delegate_id": "user_xyz",
  "role": "finance_lead",
  "valid_from": "2026-04-20",
  "valid_until": "2026-04-27",
  "reason": "Annual leave"
}
```

The PolicyEngine checks delegation records before routing approval requests. All delegations are audit-logged.

---

## SSO Integration (V2)

| Protocol | Providers | Features |
|----------|-----------|---------|
| SAML 2.0 | Okta, Azure AD, Ping Identity, ADFS | SP-initiated and IdP-initiated SSO |
| OIDC | Google Workspace, Okta, Auth0 | Used for web app + mobile app |

**JIT Provisioning:** User account created automatically on first SSO login. Role assigned from IdP group attribute mapping (e.g., Okta group `Finance` → Velo role `finance_lead`).

**Group-to-role mapping config** (`configs/auth/sso_mapping.json`):
```json
{
  "group_mappings": [
    { "idp_group": "Finance",    "velo_role": "finance_lead" },
    { "idp_group": "HR",         "velo_role": "hr_lead" },
    { "idp_group": "Leadership", "velo_role": "founder" },
    { "idp_group": "Staff",      "velo_role": "employee" }
  ],
  "default_role": "employee"
}
```

---

## Security Controls Comparison

| Feature | V1 | V2 |
|---------|----|----|
| Role assignment | 6 roles via team UI + database | Custom roles, department scope, cost center scope |
| Auth | Google OAuth (NextAuth) | SAML + OIDC + Google; JIT provisioning |
| MFA | None | TOTP enforced for finance + founder roles |
| Session timeout | NextAuth default | Configurable per role (15 min – 8h) |
| IP allowlisting | None | CIDR ranges per organization |
| Data access scope | Role at module level | Role + department + cost center |
| API key management | None | Per-user keys with scope + expiry |
| Approval delegation | None | OOO delegation with time-bounded scope |
| Audit log | Database table | Database + immutable external store + row hashing |
| Failed auth logging | None | RBAC_DENIED events in audit trail |
| Access review | None | Monthly report: who has what access, last login |
| SOC 2 | Not applicable | Type I target in V2 Wave 3 |
| Data residency | Google US regions | India-region option (BigQuery/Cloud SQL) |
