# Shared Runtime Foundation Design

## Implemented in This Pass

- Policy evaluation now consumes action metadata (`amount_inr`, filing flags, action type) and enforces additional guardrails.
- Confidence inputs are derived from runtime signals instead of fixed constants.
- Runtime audit trail emits structured events for start, tool proposal, policy decision, execution, approvals, completion.
- Tool schemas are registered and passed to model calls to enable tool-use loops.
- Workflow run state primitives support start, advance, pause/fail/complete status updates.

## Core Contract Boundaries

- `@velo/core` owns types, policy, confidence, config validation, audit, workflow state.
- `@velo/agents` owns ReAct loop and policy-mediated tool invocation.
- `@velo/tools` owns tool definitions, schemas, and handler implementations/adapters.
- `@velo/web` owns interaction surfaces and presentation contracts.

## Next Engineering Steps

- Add full workflow DSL executor over `configs/workflows/*.json`.
- Replace in-memory stores with persistent backends (Sheets/DB).
- Introduce audit event sink adapters (`sheets.audit_trail`, data warehouse export).
- Add route handlers in web package for chat, approvals, and webhook event ingestion.
