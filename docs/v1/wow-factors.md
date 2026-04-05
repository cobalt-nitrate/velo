# V1 Wow Factor Designs

## 1) Live Runway Simulator

### Concept

Interactive "what-if" controls recalculate runway instantly for hiring, cost cuts, deferred payments, and collection assumptions.

### UX Pattern

- Inline controls in runway panel
- Delta chips: `+/- months`, `risk band`, `confidence shift`
- Side-by-side baseline vs proposed scenario

### Success Metrics

- At least 40% of weekly active founders run one simulation
- 25% of simulations lead to an explicit saved decision
- Average simulation completion under 45 seconds

## 2) Autonomous Weekly Close Narrative

### Concept

A generated narrative explaining what changed in cashflow, compliance posture, payroll, and receivables with evidence links.

### UX Pattern

- Delivered in dashboard feed and notifications
- Three layers: headline summary, module deltas, recommended actions
- "Show evidence" on each bullet opens drawer

### Success Metrics

- Weekly digest open rate above 60%
- Action conversion from narrative above 20%
- User-rated clarity above 4/5 on feedback prompt

## 3) Policy Copilot with Simulation

### Concept

Users edit autopilot settings in natural language and preview operational impact before publishing.

### UX Pattern

- Input: "Raise AP auto-limit to INR 40k"
- Output: predicted impact on approval volume, risk, and exception load
- Mandatory confirm step with rollback option

### Success Metrics

- At least 1 policy simulation per active founder per month
- Reduction in manual approvals without increase in policy incidents
- Rollback rate under 10% after policy updates

## Design/Engineering Dependencies

- Confidence breakdown must be available in runtime responses
- Audit trail must support pre/post policy snapshot comparison
- Web shell must support scenario state and side-by-side presentation
