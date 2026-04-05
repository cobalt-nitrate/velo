# V1 Delivery Roadmap and KPIs (6 Months)

## Phase 1 (Weeks 1-5) - Shared Runtime Foundation

- Deliverables
  - Policy+confidence integration in agent runtime
  - Tool schema registration and executable adapter layer
  - Workflow run-state primitives and audit event logger
  - Web command center skeleton + reusable UX primitives
- Exit KPIs
  - 100% proposed tool actions pass through policy evaluation
  - 100% agent runs generate auditable start/end events
  - At least one path in each module can render in UI feed

## Phase 2 (Weeks 6-10) - Parallel Module Minimum Flows

- Deliverables
  - Minimum usable flow for Runway, Compliance, Payroll, AP, AR, HR, Helpdesk
  - Unified entity status and approval contracts adopted by all modules
  - Foundational notification hooks for approval requests
- Exit KPIs
  - At least one complete workflow per module reaches terminal state
  - Approval lifecycle success above 95% (create -> resolve/expire)
  - Fewer than 5% flows end in unknown/unclassified errors

## Phase 3 (Weeks 11-16) - Intelligence Quality

- Deliverables
  - Replace placeholder confidence signals with measured runtime inputs
  - Prompt system upgrades for all specialist agents
  - Basic memory loop from corrections to recommendations
- Exit KPIs
  - Confidence calibration MAE improves month-over-month
  - Manual correction rate decreases by at least 20% from Phase 2 baseline
  - Recommendation acceptance rate above 35%

## Phase 4 (Weeks 17-20) - Multi-Surface Operations

- Deliverables
  - Slack/WhatsApp/email approval and digest pathways
  - Retry/escalation state machine for unresolved approvals
  - Unified notification preference config
- Exit KPIs
  - 2-click approval completion from notification deep links
  - Notification-to-action conversion above 30%
  - Escalation SLA adherence above 95%

## Phase 5 (Weeks 21-24) - Trust and Scale Readiness

- Deliverables
  - Decision replay and policy simulation polish
  - Observability dashboards and incident runbooks
  - Onboarding funnel optimization
- Exit KPIs
  - Zero critical statutory misses due to internal workflow failure
  - Payroll run reliability at or above 99.5%
  - Founder weekly meaningful action rate at or above 1 per active company

## Program-Level Objective Metrics

- Trust: reduction in approvals requiring rework
- Reliability: workflow completion without manual intervention
- Engagement: weekly active decision-makers and action depth
- Financial impact: runway surprise incidents and preventable cash leaks
