# V1 UX Contracts and Interaction Primitives

## Experience Rules

- Feed-first default screen; avoid dashboard maze and deep navigation before value.
- Every recommendation card must show confidence + policy reason.
- Every approval must expose at least one evidence path.
- All high-impact actions must be reversible in UI where legally safe (undo/defer/edit).

## Primitive Components

These are scaffolded in `packages/web/components/`:

- `RunwayTile`: compact runway + burn + confidence view
- `ApprovalCard`: action summary, confidence badge, approve/reject CTAs
- `ExceptionCard`: blocked-state surfacing with direct remediation CTA
- `EvidenceDrawer`: supporting facts and policy rationale
- `PolicyChip`: mode indicator (`AUTO_EXECUTE`, `REQUEST_APPROVAL`, etc.)
- `ConfidenceBadge`: normalized confidence state UI
- `AuditTimeline`: immutable event view for trust/compliance
- `CommandBar`: intent-first interaction launcher

## Interaction Contracts

### ApprovalCard Contract

- Required: title, impact summary, confidence, policy reason, expiration
- Actions: approve/reject/edit/defer
- Side effects: write audit event, update entity status, notify stakeholders

### EvidenceDrawer Contract

- Required sections: input snapshot, confidence factors, policy rationale, historical context
- Optional: source file links, extraction deltas, anomaly explanations

### CommandBar Contract

- Accept natural language intent
- Offer contextual suggested prompts by role
- Return either immediate answer, recommendation card, or approval request

## Role-Default Information Architecture

- Founder: runway, strategic exceptions, major approvals, weekly narrative
- Finance Lead: AP/AR/compliance exceptions, filing approvals, payment queue
- HR Lead: onboarding blockers, payroll exceptions, policy and employee action requests
- Employee: self-serve documents and tax/helpdesk flows

## UX Quality Gates

- Time to first meaningful action under 2 minutes from login
- At least 90% of cards have one-click access to evidence
- Approval action latency target under 1 second perceived response
- Mobile web support for approve/reject from notifications deep links
