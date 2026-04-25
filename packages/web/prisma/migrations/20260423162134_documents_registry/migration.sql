-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT '',
    "title" TEXT NOT NULL DEFAULT '',
    "subject_type" TEXT NOT NULL DEFAULT '',
    "subject_id" TEXT NOT NULL DEFAULT '',
    "employee_email" TEXT NOT NULL DEFAULT '',
    "period_month" TEXT NOT NULL DEFAULT '',
    "period_year" TEXT NOT NULL DEFAULT '',
    "tags_json" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL DEFAULT '',
    "latest_version_id" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_versions" (
    "id" TEXT NOT NULL,
    "version_id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT '',
    "mime" TEXT NOT NULL DEFAULT '',
    "sha256" TEXT NOT NULL DEFAULT '',
    "size_bytes" INTEGER NOT NULL DEFAULT 0,
    "storage" TEXT NOT NULL DEFAULT '',
    "drive_file_id" TEXT NOT NULL DEFAULT '',
    "drive_web_view_url" TEXT NOT NULL DEFAULT '',
    "local_upload_id" TEXT NOT NULL DEFAULT '',
    "inline_data_url" TEXT NOT NULL DEFAULT '',
    "render_params_json" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_access_tokens" (
    "id" TEXT NOT NULL,
    "token_id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL DEFAULT '',
    "version_id" TEXT NOT NULL DEFAULT '',
    "scope" TEXT NOT NULL DEFAULT '',
    "recipient_email" TEXT NOT NULL DEFAULT '',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "document_access_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "documents_document_id_key" ON "documents"("document_id");

-- CreateIndex
CREATE INDEX "documents_type_idx" ON "documents"("type");

-- CreateIndex
CREATE INDEX "documents_employee_email_idx" ON "documents"("employee_email");

-- CreateIndex
CREATE INDEX "documents_subject_type_subject_id_idx" ON "documents"("subject_type", "subject_id");

-- CreateIndex
CREATE INDEX "documents_created_at_idx" ON "documents"("created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "document_versions_version_id_key" ON "document_versions"("version_id");

-- CreateIndex
CREATE INDEX "document_versions_document_id_idx" ON "document_versions"("document_id");

-- CreateIndex
CREATE INDEX "document_versions_created_at_idx" ON "document_versions"("created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "document_access_tokens_token_id_key" ON "document_access_tokens"("token_id");

-- CreateIndex
CREATE INDEX "document_access_tokens_document_id_idx" ON "document_access_tokens"("document_id");

-- CreateIndex
CREATE INDEX "document_access_tokens_version_id_idx" ON "document_access_tokens"("version_id");

-- CreateIndex
CREATE INDEX "document_access_tokens_expires_at_idx" ON "document_access_tokens"("expires_at");

-- AddForeignKey
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("document_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_access_tokens" ADD CONSTRAINT "document_access_tokens_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("document_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_access_tokens" ADD CONSTRAINT "document_access_tokens_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "document_versions"("version_id") ON DELETE CASCADE ON UPDATE CASCADE;
