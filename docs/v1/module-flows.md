# Parallel Module Specs (Common State + Approval Contract)

## Shared State Contract

All module entities should implement this shape:

```ts
type WorkflowEntityState = {
  id: string;
  module: 'runway' | 'compliance' | 'payroll' | 'ap' | 'ar' | 'hr' | 'helpdesk';
  status: 'DRAFT' | 'IN_PROGRESS' | 'WAITING_APPROVAL' | 'BLOCKED' | 'COMPLETED' | 'FAILED';
  confidence: number;
  policy_result: 'AUTO_EXECUTE' | 'REQUEST_APPROVAL' | 'RECOMMEND_ONLY' | 'REFUSE';
  owner_role: 'founder' | 'finance_lead' | 'hr_lead' | 'employee' | 'system';
  evidence_refs: string[];
  audit_entry_id: string;
  updated_at: string;
}
```

## Shared Approval Contract

Approval objects must carry:

- `approval_id`, `agent_id`, `action_type`, `action_payload`
- `confidence_score` and a concise evidence summary
- `created_at`, `expires_at`, `status`
- deterministic fallback (`EXPIRED -> RECOMMEND_ONLY` or escalation rule)

## Module Minimum Usable Flows

### Runway

- Inputs: bank balance snapshot, fixed costs, planned hires, receivables timeline
- Outputs: runway months, burn, confidence band, top 3 recommendations
- Approval points: policy changes that auto-adjust payment timing or hiring plan reminders

### Compliance

- Inputs: statutory calendar rules, task completion status, filing prerequisites
- Outputs: deadline risk board, missing input checklist, filing action requests
- Approval points: all irreversible filing submissions

### Payroll

- Inputs: active employees, salary structures, attendance/leave, payroll/tax config
- Outputs: monthly payroll proposal, variance flags, tax obligations
- Approval points: payroll execution and statutory challan submissions

### AP (Accounts Payable)

- Inputs: invoice source document, extraction result, vendor match, duplicate risk
- Outputs: AP record, expense/gst ledger updates, payment proposal
- Approval points: high-value payments, policy-overridden actions

### AR (Accounts Receivable)

- Inputs: client master, invoice request, GST logic, follow-up config
- Outputs: AR invoice draft/sent state, follow-up sequence, collection risk signal
- Approval points: external invoice send and legal escalation triggers

### HR

- Inputs: hire request, onboarding template, document collection status
- Outputs: onboarding checklist, offer-letter workflow, activation status
- Approval points: offer release and employment status changes with legal implications

### Helpdesk

- Inputs: employee query, role context, allowed data scope
- Outputs: answer, action recommendations, escalation trigger if sensitive
- Approval points: none by default; sensitive requests route to HR/Finance approval

## Cross-Module Interaction Rules

- Any action with `confidence < request_approval_min` cannot auto-execute.
- Module-to-module writes must include `source_module` and `source_audit_id`.
- Every status transition writes an audit event with `from_status`, `to_status`, and reason.
