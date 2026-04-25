# Graph Report - /Users/harshitsingh/Documents/Novaforge/Projects/Fun/Back Office Ops  (2026-04-25)

## Corpus Check
- 182 files · ~150,844 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 657 nodes · 1137 edges · 74 communities detected
- Extraction: 81% EXTRACTED · 19% INFERRED · 0% AMBIGUOUS · INFERRED: 221 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 68|Community 68]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 70|Community 70]]
- [[_COMMUNITY_Community 71|Community 71]]
- [[_COMMUNITY_Community 72|Community 72]]
- [[_COMMUNITY_Community 73|Community 73]]

## God Nodes (most connected - your core abstractions)
1. `GET()` - 89 edges
2. `POST()` - 80 edges
3. `runAgent()` - 37 edges
4. `parseInvoiceText()` - 16 edges
5. `PATCH()` - 15 edges
6. `baseProps()` - 15 edges
7. `generatePdfDocument()` - 14 edges
8. `loadConfig()` - 12 edges
9. `resumeWorkflowAfterApproval()` - 12 edges
10. `invokeRegisteredTool()` - 11 edges

## Surprising Connections (you probably didn't know these)
- `runAgent()` --calls--> `deriveScoringInputs()`  [INFERRED]
  /Users/harshitsingh/Documents/Novaforge/Projects/Fun/Back Office Ops/packages/agents/src/runner.ts → packages/core/src/confidence/index.ts
- `GET()` --calls--> `listUploads()`  [INFERRED]
  /Users/harshitsingh/Documents/Novaforge/Projects/Fun/Back Office Ops/packages/web/app/api/onboarding/state/route.ts → packages/web/lib/upload-store.ts
- `deleteInvite()` --calls--> `DELETE()`  [INFERRED]
  packages/web/lib/invites-store.ts → /Users/harshitsingh/Documents/Novaforge/Projects/Fun/Back Office Ops/packages/web/app/api/team/members/route.ts
- `POST()` --calls--> `parseBankStatement()`  [INFERRED]
  /Users/harshitsingh/Documents/Novaforge/Projects/Fun/Back Office Ops/packages/web/app/api/cron/escalate-approvals/route.ts → packages/tools/src/bank/statement-parser.ts
- `fetchFileBuffer()` --calls--> `GET()`  [INFERRED]
  packages/tools/src/ocr/invoice-parser.ts → /Users/harshitsingh/Documents/Novaforge/Projects/Fun/Back Office Ops/packages/web/app/api/onboarding/state/route.ts

## Communities

### Community 0 - "Community 0"
Cohesion: 0.04
Nodes (31): appendChatExchange(), createChatSession(), deleteChatSession(), getChatSession(), listChatSessions(), rowToSession(), updateChatSessionMeta(), listDataTable() (+23 more)

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (40): buildAgentContextFromBody(), testGoogleDriveConnect(), testLlmConnect(), testPostgresConnect(), testResendConnect(), testSlackConnect(), consumeInvite(), createInvite() (+32 more)

### Community 2 - "Community 2"
Cohesion: 0.08
Nodes (41): mergeAttachmentRefs(), mergeFileLinkRowsIntoApprovalAttachmentsJson(), parseAttachmentDriveUrlsJson(), stringifyAttachmentRefs(), isApprovalApprovedStatus(), isApprovalPendingStatus(), ApprovalArtifactBlock(), allowInMemoryDataFallback() (+33 more)

### Community 3 - "Community 3"
Cohesion: 0.06
Nodes (29): adjustConfidenceForPolicyRisk(), riskCaps(), isReadOnlyVeloDataTool(), PolicyEngine, runApInvoiceAgent(), runArCollectionsAgent(), runComplianceAgent(), runHelpdeskAgent() (+21 more)

### Community 4 - "Community 4"
Cohesion: 0.1
Nodes (32): ensureVeloDrivePath(), escapeDriveQueryValue(), sanitizeSegment(), segmentsForDocumentTool(), segmentsForUploadedFile(), uploadBufferToDrive(), yearMonth(), mirrorEnabled() (+24 more)

### Community 5 - "Community 5"
Cohesion: 0.09
Nodes (28): resolve(), appendDecisionMemory(), decisionSignature(), flush(), listDecisionMemoryRecent(), memoryBoostForTool(), readAll(), storeFile() (+20 more)

### Community 6 - "Community 6"
Cohesion: 0.22
Nodes (20): drainWorkflowRun(), evaluateCondition(), getPath(), parseLiteral(), resolveInputFrom(), resumeWorkflowAfterApproval(), runSingleWorkflowStep(), runWorkflowLinear() (+12 more)

### Community 7 - "Community 7"
Cohesion: 0.13
Nodes (16): buildOrchestrationNote(), buildPlaybookMissionPlan(), buildSelectedPlan(), domainToAgentIds(), inferApprovalKind(), pickFirstByPrefix(), pickTool(), toolSet() (+8 more)

### Community 8 - "Community 8"
Cohesion: 0.16
Nodes (14): applyStoredConnectorEnvAtStartup(), connectorEnvPath(), getStoredConnectorEnv(), keyStatus(), patchStoredConnectorEnv(), readRaw(), RootLayout(), getUiSettings() (+6 more)

### Community 9 - "Community 9"
Cohesion: 0.22
Nodes (18): buildIntegrationChecks(), daysUntilDue(), foldOverall(), gatherOperationalSnapshot(), getGoogleDriveClient(), isPostgresReachable(), mapApPayableRow(), mapArReceivableRow() (+10 more)

### Community 10 - "Community 10"
Cohesion: 0.2
Nodes (16): notifyApprovalRequestOutOfBand(), approvalBlocks(), buildEmailHtml(), complianceAlertBlocks(), digestBlocks(), escapeHtml(), followupEmailHtml(), genericEmailHtml() (+8 more)

### Community 11 - "Community 11"
Cohesion: 0.22
Nodes (17): computeConfidence(), extractAmounts(), extractDates(), extractGstComponents(), extractGstins(), extractHsnSac(), extractInvoiceNumber(), extractPaymentTerms() (+9 more)

### Community 12 - "Community 12"
Cohesion: 0.24
Nodes (15): baseProps(), IconChevronLeft(), IconChevronRight(), IconDatabase(), IconInfo(), IconLink(), IconLoader(), IconPaperclip() (+7 more)

### Community 13 - "Community 13"
Cohesion: 0.51
Nodes (12): assertToolOk(), baseToolPayload(), moduleAp(), moduleAr(), moduleCompliance(), moduleHelpdesk(), moduleHr(), modulePayroll() (+4 more)

### Community 14 - "Community 14"
Cohesion: 0.23
Nodes (9): buildAttachmentContext(), absUploadPath(), getUpload(), listUploads(), saveUploadedFile(), toRecord(), chatsDir(), uploadsDir() (+1 more)

### Community 15 - "Community 15"
Cohesion: 0.21
Nodes (4): handleNext(), saveCreds(), testGoogle(), verifyDatabase()

### Community 16 - "Community 16"
Cohesion: 0.42
Nodes (9): detectBankProfile(), detectMode(), normalizeDate(), parseAmount(), parseBankStatement(), parseCsv(), parseCSVStatement(), parseOFXStatement() (+1 more)

### Community 17 - "Community 17"
Cohesion: 0.28
Nodes (4): createAuditEvent(), evictOldestAuditEvents(), flushToSheets(), getAuditEvent()

### Community 18 - "Community 18"
Cohesion: 0.43
Nodes (6): bcryptHash(), day(), dt(), main(), money(), wipeAll()

### Community 19 - "Community 19"
Cohesion: 0.36
Nodes (3): isSeparatorRow(), parseGfmTable(), parseRowCells()

### Community 20 - "Community 20"
Cohesion: 0.43
Nodes (6): asNumber01(), assembleApprovalEvidence(), computeApVendorHistory(), extractSignalsFromLegacyEvidence(), fmtInr(), safeJsonParse()

### Community 21 - "Community 21"
Cohesion: 0.29
Nodes (2): bulkApprove(), load()

### Community 22 - "Community 22"
Cohesion: 0.47
Nodes (3): buildConnectorPutBody(), saveConnectors(), setFormFromConnectors()

### Community 23 - "Community 23"
Cohesion: 0.33
Nodes (0): 

### Community 24 - "Community 24"
Cohesion: 0.4
Nodes (1): handleSubmit()

### Community 25 - "Community 25"
Cohesion: 0.4
Nodes (0): 

### Community 26 - "Community 26"
Cohesion: 0.4
Nodes (0): 

### Community 27 - "Community 27"
Cohesion: 0.4
Nodes (0): 

### Community 28 - "Community 28"
Cohesion: 0.83
Nodes (3): buildWorkflowEntityStub(), inferModuleFromAgentId(), mapPolicyToEntityStatus()

### Community 29 - "Community 29"
Cohesion: 0.5
Nodes (0): 

### Community 30 - "Community 30"
Cohesion: 0.67
Nodes (2): consumeOperationsChatHandoff(), peekOperationsChatHandoff()

### Community 31 - "Community 31"
Cohesion: 0.67
Nodes (0): 

### Community 32 - "Community 32"
Cohesion: 0.67
Nodes (0): 

### Community 33 - "Community 33"
Cohesion: 0.67
Nodes (0): 

### Community 34 - "Community 34"
Cohesion: 1.0
Nodes (0): 

### Community 35 - "Community 35"
Cohesion: 1.0
Nodes (0): 

### Community 36 - "Community 36"
Cohesion: 1.0
Nodes (0): 

### Community 37 - "Community 37"
Cohesion: 1.0
Nodes (0): 

### Community 38 - "Community 38"
Cohesion: 1.0
Nodes (0): 

### Community 39 - "Community 39"
Cohesion: 1.0
Nodes (0): 

### Community 40 - "Community 40"
Cohesion: 1.0
Nodes (0): 

### Community 41 - "Community 41"
Cohesion: 1.0
Nodes (0): 

### Community 42 - "Community 42"
Cohesion: 1.0
Nodes (0): 

### Community 43 - "Community 43"
Cohesion: 1.0
Nodes (0): 

### Community 44 - "Community 44"
Cohesion: 1.0
Nodes (0): 

### Community 45 - "Community 45"
Cohesion: 1.0
Nodes (0): 

### Community 46 - "Community 46"
Cohesion: 1.0
Nodes (0): 

### Community 47 - "Community 47"
Cohesion: 1.0
Nodes (0): 

### Community 48 - "Community 48"
Cohesion: 1.0
Nodes (0): 

### Community 49 - "Community 49"
Cohesion: 1.0
Nodes (0): 

### Community 50 - "Community 50"
Cohesion: 1.0
Nodes (0): 

### Community 51 - "Community 51"
Cohesion: 1.0
Nodes (0): 

### Community 52 - "Community 52"
Cohesion: 1.0
Nodes (0): 

### Community 53 - "Community 53"
Cohesion: 1.0
Nodes (0): 

### Community 54 - "Community 54"
Cohesion: 1.0
Nodes (0): 

### Community 55 - "Community 55"
Cohesion: 1.0
Nodes (0): 

### Community 56 - "Community 56"
Cohesion: 1.0
Nodes (0): 

### Community 57 - "Community 57"
Cohesion: 1.0
Nodes (0): 

### Community 58 - "Community 58"
Cohesion: 1.0
Nodes (0): 

### Community 59 - "Community 59"
Cohesion: 1.0
Nodes (0): 

### Community 60 - "Community 60"
Cohesion: 1.0
Nodes (0): 

### Community 61 - "Community 61"
Cohesion: 1.0
Nodes (0): 

### Community 62 - "Community 62"
Cohesion: 1.0
Nodes (0): 

### Community 63 - "Community 63"
Cohesion: 1.0
Nodes (0): 

### Community 64 - "Community 64"
Cohesion: 1.0
Nodes (0): 

### Community 65 - "Community 65"
Cohesion: 1.0
Nodes (0): 

### Community 66 - "Community 66"
Cohesion: 1.0
Nodes (0): 

### Community 67 - "Community 67"
Cohesion: 1.0
Nodes (0): 

### Community 68 - "Community 68"
Cohesion: 1.0
Nodes (0): 

### Community 69 - "Community 69"
Cohesion: 1.0
Nodes (0): 

### Community 70 - "Community 70"
Cohesion: 1.0
Nodes (0): 

### Community 71 - "Community 71"
Cohesion: 1.0
Nodes (0): 

### Community 72 - "Community 72"
Cohesion: 1.0
Nodes (0): 

### Community 73 - "Community 73"
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **Thin community `Community 34`** (2 nodes): `NotFound()`, `not-found.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 35`** (2 nodes): `page.tsx`, `ChatPage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 36`** (2 nodes): `page.tsx`, `onDrop()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 37`** (2 nodes): `page.tsx`, `TeamPage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 38`** (2 nodes): `DocumentDetailPage()`, `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 39`** (2 nodes): `ApprovalsPage()`, `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 40`** (2 nodes): `page.tsx`, `ApprovalPage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 41`** (2 nodes): `onSimulate()`, `policy-copilot.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 42`** (2 nodes): `EvidenceDrawer()`, `evidence-drawer.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 43`** (2 nodes): `AuditTimeline()`, `audit-timeline.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 44`** (2 nodes): `policy-chip.tsx`, `PolicyChip()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 45`** (2 nodes): `PlanBulletLine()`, `operations-mission-briefing.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 46`** (2 nodes): `platform-health-card.tsx`, `statusTone()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 47`** (2 nodes): `onSubmit()`, `command-bar.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 48`** (2 nodes): `weekly-close-narrative.tsx`, `WeeklyCloseNarrative()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 49`** (2 nodes): `runway-tile.tsx`, `RunwayTile()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 50`** (2 nodes): `onKey()`, `help-tooltip.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 51`** (2 nodes): `session-provider.tsx`, `VeloSessionProvider()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 52`** (2 nodes): `DocumentPreview()`, `document-preview.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 53`** (2 nodes): `ExceptionCard()`, `exception-card.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 54`** (2 nodes): `ConfidenceBadge()`, `confidence-badge.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 55`** (1 nodes): `pdf-parse.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 56`** (1 nodes): `index.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 57`** (1 nodes): `index.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 58`** (1 nodes): `connector-kit.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 59`** (1 nodes): `middleware.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 60`** (1 nodes): `next.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 61`** (1 nodes): `next-env.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 62`** (1 nodes): `tailwind.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 63`** (1 nodes): `postcss.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 64`** (1 nodes): `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 65`** (1 nodes): `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 66`** (1 nodes): `route.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 67`** (1 nodes): `empty-state.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 68`** (1 nodes): `approval-card.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 69`** (1 nodes): `prisma.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 70`** (1 nodes): `chat-types.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 71`** (1 nodes): `trivial-chat.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 72`** (1 nodes): `auth.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 73`** (1 nodes): `run-events.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `POST()` connect `Community 1` to `Community 0`, `Community 2`, `Community 3`, `Community 4`, `Community 5`, `Community 6`, `Community 7`, `Community 8`, `Community 9`, `Community 10`, `Community 14`, `Community 16`?**
  _High betweenness centrality (0.297) - this node is a cross-community bridge._
- **Why does `GET()` connect `Community 0` to `Community 1`, `Community 2`, `Community 3`, `Community 5`, `Community 6`, `Community 7`, `Community 8`, `Community 9`, `Community 11`, `Community 13`, `Community 14`, `Community 17`, `Community 20`?**
  _High betweenness centrality (0.250) - this node is a cross-community bridge._
- **Why does `runAgent()` connect `Community 3` to `Community 0`, `Community 1`, `Community 5`, `Community 6`, `Community 10`, `Community 17`?**
  _High betweenness centrality (0.106) - this node is a cross-community bridge._
- **Are the 44 inferred relationships involving `GET()` (e.g. with `probeDriveFolder()` and `fetchFileBuffer()`) actually correct?**
  _`GET()` has 44 INFERRED edges - model-reasoned connections that need verification._
- **Are the 44 inferred relationships involving `POST()` (e.g. with `appendDecisionMemory()` and `runAgent()`) actually correct?**
  _`POST()` has 44 INFERRED edges - model-reasoned connections that need verification._
- **Are the 22 inferred relationships involving `runAgent()` (e.g. with `POST()` and `loadAgentConfig()`) actually correct?**
  _`runAgent()` has 22 INFERRED edges - model-reasoned connections that need verification._
- **Are the 9 inferred relationships involving `PATCH()` (e.g. with `updateChatSessionMeta()` and `findApprovalById()`) actually correct?**
  _`PATCH()` has 9 INFERRED edges - model-reasoned connections that need verification._