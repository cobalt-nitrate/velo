-- CreateTable
CREATE TABLE "company_memory" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "updated_at" TEXT NOT NULL DEFAULT '',
    "bank_balance" TEXT NOT NULL DEFAULT '',
    "runway_months" TEXT NOT NULL DEFAULT '',
    "headcount" TEXT NOT NULL DEFAULT '',
    "pending_approvals_count" TEXT NOT NULL DEFAULT '0',
    "snapshot_json" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "company_memory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_cache" (
    "id" TEXT NOT NULL,
    "skill_id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL DEFAULT '',
    "intent_patterns" TEXT NOT NULL DEFAULT '',
    "tool_sequence_json" TEXT NOT NULL DEFAULT '',
    "success_count" INTEGER NOT NULL DEFAULT 0,
    "fail_count" INTEGER NOT NULL DEFAULT 0,
    "last_used_at" TEXT NOT NULL DEFAULT '',
    "created_at" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "skill_cache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "company_memory_company_id_key" ON "company_memory"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "skill_cache_skill_id_key" ON "skill_cache"("skill_id");
