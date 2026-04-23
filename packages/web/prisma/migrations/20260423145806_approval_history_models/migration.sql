-- CreateTable
CREATE TABLE "approval_events" (
    "id" TEXT NOT NULL,
    "approval_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL DEFAULT '',
    "actor_role" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "payload" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_evidence_items" (
    "id" TEXT NOT NULL,
    "approval_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT '',
    "label" TEXT NOT NULL DEFAULT '',
    "value" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL DEFAULT '',
    "meta" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "approval_evidence_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_signal_scores" (
    "id" TEXT NOT NULL,
    "approval_id" TEXT NOT NULL,
    "signal" TEXT NOT NULL DEFAULT '',
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "detail" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "approval_signal_scores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "approval_events_approval_id_idx" ON "approval_events"("approval_id");

-- CreateIndex
CREATE INDEX "approval_events_created_at_idx" ON "approval_events"("created_at" DESC);

-- CreateIndex
CREATE INDEX "approval_evidence_items_approval_id_idx" ON "approval_evidence_items"("approval_id");

-- CreateIndex
CREATE INDEX "approval_evidence_items_kind_idx" ON "approval_evidence_items"("kind");

-- CreateIndex
CREATE INDEX "approval_signal_scores_approval_id_idx" ON "approval_signal_scores"("approval_id");

-- CreateIndex
CREATE INDEX "approval_signal_scores_signal_idx" ON "approval_signal_scores"("signal");

-- AddForeignKey
ALTER TABLE "approval_events" ADD CONSTRAINT "approval_events_approval_id_fkey" FOREIGN KEY ("approval_id") REFERENCES "approval_requests"("approval_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_evidence_items" ADD CONSTRAINT "approval_evidence_items_approval_id_fkey" FOREIGN KEY ("approval_id") REFERENCES "approval_requests"("approval_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_signal_scores" ADD CONSTRAINT "approval_signal_scores_approval_id_fkey" FOREIGN KEY ("approval_id") REFERENCES "approval_requests"("approval_id") ON DELETE CASCADE ON UPDATE CASCADE;
