# V1 Gap Matrix (Vision vs Implementation)

## Current Snapshot

| Area | Vision Target | Current State | Gap | V1 Implementation Direction |
| --- | --- | --- | --- | --- |
| Core runtime | Policy-first, confidence-gated decisions with audit trail | `PolicyEngine`, weighted confidence scorer, in-memory audit + optional Sheets flush; config validation for policy/business JSON | Low–Med | Richer policy metadata, tenant-isolated audit sinks |
| Agent orchestration | ReAct loop with tool routing and approvals | `runAgent` with schema registry, derived confidence + risk caps, approval persistence; decision memory on auto-exec + resolve | Med | Deeper workflow/branch integration in the loop |
| Tools layer | Sheets/notifications/docs/email/bank callable by agents | Broad tool catalog with explicit JSON schemas (incl. bank / invoice PDF); handlers with graceful mocks | Med | Production connectors, WhatsApp, stricter RBAC on tools |
| Workflow engine | Config-driven workflows with pause/resume | Linear `runWorkflowLinear` + workflow JSON under `configs/workflows/`; pause on approval in agents | Med | Full DSL interpreter / branching |
| Web Command Center | Feed-first approvals, evidence drawer, runway card | Next.js shell, operations tiles, approvals PATCH, chat, `/api/memory`, policy simulate, bank upload | Med | Unified prefs, in-channel approve KPIs, calibration UI |
| Prompt quality | Production-grade specialist prompts | Improved `configs/prompts/*`; ongoing polish | Med | Rubric-driven prompt QA and eval hooks |
| Product operating docs | Detailed interaction/UX/wow specifications | `docs/v1/*` including this matrix | Med | Module contracts + UX specs as you productize surfaces |

## Implementation Evidence Added

- Runtime and policy hardening: `packages/agents/src/runner.ts`, `packages/core/src/policy-engine/index.ts`, `packages/core/src/confidence/index.ts`, `packages/agents/src/tool-confidence.ts`, `packages/agents/src/confidence-policy-bridge.ts`
- Shared core primitives: `packages/core/src/audit/index.ts`, `packages/core/src/workflow/index.ts`, `packages/core/src/memory/decision-memory.ts`, `packages/core/src/module-entity.ts`, `packages/core/src/config/loader.ts`
- Tools runtime: `packages/tools/src/index.ts` and adapters in `packages/tools/src/*`
- Web shell and primitives: `packages/web/app/*`, `packages/web/components/*`, `packages/web/tailwind.config.ts`

## Remaining Gaps After This Pass

- Workflow execution DSL is still primitive (state primitives only, not full interpreter over every branch in workflow JSON).
- Tool handlers are scaffolds; real integrations (Google Sheets API, WhatsApp/Slack APIs, payroll/statutory connectors) remain pending.
- Prompt files in `configs/prompts/` still require production instructions and guardrail completions.
- Web Command Center: core routes exist (`chat`, `approvals`, `operations`, `policy/simulate`, `memory`, `bank-statement`); channel webhooks and unified notification preferences are still thin.
- **Phase 3 progress:** config-driven confidence weights/signals/risk caps (`configs/business/confidence_signals.json`, `configs/policies/confidence_*.json`), file-backed **decision memory** (`packages/core/src/memory/decision-memory.ts`) wired into tool confidence boosts, runner auto-execute recording, and approval resolution (`packages/web/app/api/approvals/[id]/route.ts`); HTTP surface at `GET|POST /api/memory`. Embeddings/vector retrieval and calibration dashboards are still not implemented.
- Calibration analytics and full policy replay are still design-level beyond `packages/web/app/api/policy/simulate/route.ts`.
