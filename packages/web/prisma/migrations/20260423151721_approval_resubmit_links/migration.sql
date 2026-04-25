-- AlterTable
ALTER TABLE "approval_requests" ADD COLUMN     "resubmitted_from_approval_id" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "superseded_by_approval_id" TEXT NOT NULL DEFAULT '';
