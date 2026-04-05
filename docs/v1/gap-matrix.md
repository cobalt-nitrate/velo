# V1 Gap Matrix (Vision vs Implementation)

## Current Snapshot

| Area | Vision Target | Current State | Gap | V1 Implementation Direction |
| --- | --- | --- | --- | --- |
| Core runtime | Policy-first, confidence-gated decisions with audit trail | `PolicyEngine` + confidence scorer exist; audit missing before this implementation | Medium | Extend policy metadata evaluation, add audit event logger, normalize action metadata |
| Agent orchestration | ReAct loop with tool routing and approvals | `runAgent` exists but used placeholder confidence and empty tool schemas | High | Add schema-aware tool registry, derived confidence inputs, approval payload model |
| Tools layer | Sheets/notifications/docs/email/bank callable by agents | Package existed without source | High | Add runtime tools with schemas + handlers and standardized return contracts |
| Workflow engine | Config-driven workflows with pause/resume | Workflow JSON existed but no runtime state object | High | Add workflow run state lifecycle primitives and context updates |
| Web Command Center | Feed-first approvals, evidence drawer, runway card | Web package had only `package.json` | High | Scaffold Next.js shell + shared UI primitives and role-oriented dashboard layout |
| Prompt quality | Production-grade specialist prompts | Prompt files are TODO placeholders | High | Keep placeholders for now; document quality rubric and complete in Phase 3 |
| Product operating docs | Detailed interaction/UX/wow specifications | No implementation docs beyond high-level plan | Medium | Add docs in `docs/v1/` for module contracts, UX specs, wow factors, milestones |

## Implementation Evidence Added

- Runtime and policy hardening: `packages/agents/src/runner.ts`, `packages/core/src/policy-engine/index.ts`, `packages/core/src/confidence/index.ts`
- Shared core primitives: `packages/core/src/audit/index.ts`, `packages/core/src/workflow/index.ts`, `packages/core/src/index.ts`
- Tools runtime scaffolding: `packages/tools/src/index.ts` and adapters in `packages/tools/src/*`
- Web shell and primitives: `packages/web/app/*`, `packages/web/components/*`, `packages/web/tailwind.config.ts`

## Remaining Gaps After This Pass

- Workflow execution DSL is still primitive (state primitives only, not full interpreter over every branch in workflow JSON).
- Tool handlers are scaffolds; real integrations (Google Sheets API, WhatsApp/Slack APIs, payroll/statutory connectors) remain pending.
- Prompt files in `configs/prompts/` still require production instructions and guardrail completions.
- API routes (`chat`, `approvals`, `webhooks`) and auth wiring are not yet implemented in web package.
- Calibration analytics and policy simulator backend logic are currently design-level.
