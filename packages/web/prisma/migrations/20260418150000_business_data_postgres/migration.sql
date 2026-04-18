-- CreateTable
CREATE TABLE "company_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "last_updated" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "company_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_rates" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT '',
    "subtype" TEXT NOT NULL DEFAULT '',
    "rate_pct" TEXT NOT NULL DEFAULT '',
    "state_code" TEXT NOT NULL DEFAULT '',
    "salary_min" TEXT NOT NULL DEFAULT '',
    "salary_max" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "tax_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_categories" (
    "id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "gst_rate" TEXT NOT NULL DEFAULT '',
    "itc_claimable" TEXT NOT NULL DEFAULT '',
    "itc_block_reason" TEXT NOT NULL DEFAULT '',
    "parent_category" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "expense_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_components" (
    "id" TEXT NOT NULL,
    "component_id" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL DEFAULT '',
    "pct_of_ctc" TEXT NOT NULL DEFAULT '',
    "pct_of_basic" TEXT NOT NULL DEFAULT '',
    "taxable" TEXT NOT NULL DEFAULT '',
    "pf_applicable" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "payroll_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_types" (
    "id" TEXT NOT NULL,
    "leave_type_id" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "annual_entitlement_days" TEXT NOT NULL DEFAULT '',
    "carry_forward_max" TEXT NOT NULL DEFAULT '',
    "encashable" TEXT NOT NULL DEFAULT '',
    "paid" TEXT NOT NULL DEFAULT '',
    "accrual" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "leave_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_rules" (
    "id" TEXT NOT NULL,
    "rule_id" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "frequency" TEXT NOT NULL DEFAULT '',
    "due_day_of_month" TEXT NOT NULL DEFAULT '',
    "applicable_months" TEXT NOT NULL DEFAULT '',
    "applicable_states" TEXT NOT NULL DEFAULT '',
    "portal" TEXT NOT NULL DEFAULT '',
    "penalty_notes" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "compliance_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "personal_email" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "dob" TEXT NOT NULL DEFAULT '',
    "gender" TEXT NOT NULL DEFAULT '',
    "pan" TEXT NOT NULL DEFAULT '',
    "aadhaar" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "designation" TEXT NOT NULL DEFAULT '',
    "department" TEXT NOT NULL DEFAULT '',
    "reports_to" TEXT NOT NULL DEFAULT '',
    "doj" TEXT NOT NULL DEFAULT '',
    "doe" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'active',
    "employment_type" TEXT NOT NULL DEFAULT '',
    "salary_structure_id" TEXT NOT NULL DEFAULT '',
    "ctc_annual_inr" TEXT NOT NULL DEFAULT '',
    "pf_uan" TEXT NOT NULL DEFAULT '',
    "esic_ip_number" TEXT NOT NULL DEFAULT '',
    "pt_applicable" TEXT NOT NULL DEFAULT '',
    "tds_regime" TEXT NOT NULL DEFAULT '',
    "bank_account_number" TEXT NOT NULL DEFAULT '',
    "bank_ifsc" TEXT NOT NULL DEFAULT '',
    "bank_name" TEXT NOT NULL DEFAULT '',
    "created_at" TEXT NOT NULL DEFAULT '',
    "updated_at" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_structures" (
    "id" TEXT NOT NULL,
    "structure_id" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "basic_pct_of_ctc" TEXT NOT NULL DEFAULT '',
    "hra_pct_of_basic" TEXT NOT NULL DEFAULT '',
    "lta_pct_of_ctc" TEXT NOT NULL DEFAULT '',
    "special_allowance_residual" TEXT NOT NULL DEFAULT '',
    "effective_from" TEXT NOT NULL DEFAULT '',
    "created_at" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "salary_structures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_master" (
    "id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "vendor_name" TEXT NOT NULL DEFAULT '',
    "gstin" TEXT NOT NULL DEFAULT '',
    "pan" TEXT NOT NULL DEFAULT '',
    "bank_account" TEXT NOT NULL DEFAULT '',
    "ifsc" TEXT NOT NULL DEFAULT '',
    "bank_name" TEXT NOT NULL DEFAULT '',
    "payment_terms_days" TEXT NOT NULL DEFAULT '',
    "is_payee_added" TEXT NOT NULL DEFAULT '',
    "contact_email" TEXT NOT NULL DEFAULT '',
    "contact_phone" TEXT NOT NULL DEFAULT '',
    "created_at" TEXT NOT NULL DEFAULT '',
    "updated_at" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "vendor_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_master" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "client_name" TEXT NOT NULL DEFAULT '',
    "gstin" TEXT NOT NULL DEFAULT '',
    "pan" TEXT NOT NULL DEFAULT '',
    "billing_address" TEXT NOT NULL DEFAULT '',
    "state" TEXT NOT NULL DEFAULT '',
    "contact_email" TEXT NOT NULL DEFAULT '',
    "contact_phone" TEXT NOT NULL DEFAULT '',
    "payment_terms_days" TEXT NOT NULL DEFAULT '',
    "created_at" TEXT NOT NULL DEFAULT '',
    "updated_at" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "client_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_payees" (
    "id" TEXT NOT NULL,
    "payee_id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL DEFAULT '',
    "vendor_name" TEXT NOT NULL DEFAULT '',
    "bank_account" TEXT NOT NULL DEFAULT '',
    "ifsc" TEXT NOT NULL DEFAULT '',
    "bank_name" TEXT NOT NULL DEFAULT '',
    "added_date" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "bank_payees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_transactions" (
    "id" TEXT NOT NULL,
    "txn_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL DEFAULT '',
    "date" TEXT NOT NULL DEFAULT '',
    "narration" TEXT NOT NULL DEFAULT '',
    "ref_number" TEXT NOT NULL DEFAULT '',
    "amount" TEXT NOT NULL DEFAULT '',
    "balance" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL DEFAULT '',
    "mode" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL DEFAULT '',
    "created_at" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "bank_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ap_invoices" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL DEFAULT '',
    "vendor_name" TEXT NOT NULL DEFAULT '',
    "invoice_number" TEXT NOT NULL DEFAULT '',
    "invoice_date" TEXT NOT NULL DEFAULT '',
    "due_date" TEXT NOT NULL DEFAULT '',
    "line_items_json" TEXT NOT NULL DEFAULT '',
    "subtotal" TEXT NOT NULL DEFAULT '',
    "gst_amount" TEXT NOT NULL DEFAULT '',
    "total_amount" TEXT NOT NULL DEFAULT '',
    "expense_category" TEXT NOT NULL DEFAULT '',
    "sub_category" TEXT NOT NULL DEFAULT '',
    "itc_claimable" TEXT NOT NULL DEFAULT '',
    "itc_amount" TEXT NOT NULL DEFAULT '',
    "payment_status" TEXT NOT NULL DEFAULT '',
    "payment_date" TEXT NOT NULL DEFAULT '',
    "bank_reference" TEXT NOT NULL DEFAULT '',
    "approver" TEXT NOT NULL DEFAULT '',
    "approved_at" TEXT NOT NULL DEFAULT '',
    "source_file_url" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "created_at" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "ap_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ar_invoices" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL DEFAULT '',
    "client_name" TEXT NOT NULL DEFAULT '',
    "invoice_number" TEXT NOT NULL DEFAULT '',
    "invoice_date" TEXT NOT NULL DEFAULT '',
    "due_date" TEXT NOT NULL DEFAULT '',
    "service_description" TEXT NOT NULL DEFAULT '',
    "subtotal" TEXT NOT NULL DEFAULT '',
    "igst" TEXT NOT NULL DEFAULT '',
    "cgst" TEXT NOT NULL DEFAULT '',
    "sgst" TEXT NOT NULL DEFAULT '',
    "total_amount" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT '',
    "payment_received_date" TEXT NOT NULL DEFAULT '',
    "bank_reference" TEXT NOT NULL DEFAULT '',
    "followup_count" TEXT NOT NULL DEFAULT '0',
    "last_followup_date" TEXT NOT NULL DEFAULT '',
    "invoice_pdf_url" TEXT NOT NULL DEFAULT '',
    "created_at" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "ar_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_runs" (
    "id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "month" TEXT NOT NULL DEFAULT '',
    "year" TEXT NOT NULL DEFAULT '',
    "employee_count" TEXT NOT NULL DEFAULT '',
    "total_gross" TEXT NOT NULL DEFAULT '',
    "total_deductions" TEXT NOT NULL DEFAULT '',
    "total_net" TEXT NOT NULL DEFAULT '',
    "pf_employer_total" TEXT NOT NULL DEFAULT '',
    "esic_employer_total" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT '',
    "approved_by" TEXT NOT NULL DEFAULT '',
    "approved_at" TEXT NOT NULL DEFAULT '',
    "created_at" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "payroll_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_slips" (
    "id" TEXT NOT NULL,
    "slip_id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL DEFAULT '',
    "employee_id" TEXT NOT NULL DEFAULT '',
    "employee_name" TEXT NOT NULL DEFAULT '',
    "month" TEXT NOT NULL DEFAULT '',
    "year" TEXT NOT NULL DEFAULT '',
    "basic" TEXT NOT NULL DEFAULT '',
    "hra" TEXT NOT NULL DEFAULT '',
    "lta" TEXT NOT NULL DEFAULT '',
    "special_allowance" TEXT NOT NULL DEFAULT '',
    "gross_salary" TEXT NOT NULL DEFAULT '',
    "pf_employee" TEXT NOT NULL DEFAULT '',
    "esic_employee" TEXT NOT NULL DEFAULT '',
    "pt" TEXT NOT NULL DEFAULT '',
    "tds" TEXT NOT NULL DEFAULT '',
    "lop_deduction" TEXT NOT NULL DEFAULT '',
    "total_deductions" TEXT NOT NULL DEFAULT '',
    "net_salary" TEXT NOT NULL DEFAULT '',
    "working_days" TEXT NOT NULL DEFAULT '',
    "lop_days" TEXT NOT NULL DEFAULT '',
    "drive_url" TEXT NOT NULL DEFAULT '',
    "created_at" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "salary_slips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_records" (
    "id" TEXT NOT NULL,
    "record_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL DEFAULT '',
    "employee_name" TEXT NOT NULL DEFAULT '',
    "leave_type" TEXT NOT NULL DEFAULT '',
    "from_date" TEXT NOT NULL DEFAULT '',
    "to_date" TEXT NOT NULL DEFAULT '',
    "days" TEXT NOT NULL DEFAULT '',
    "reason" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT '',
    "approver" TEXT NOT NULL DEFAULT '',
    "approved_at" TEXT NOT NULL DEFAULT '',
    "created_at" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "leave_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_balances" (
    "id" TEXT NOT NULL,
    "balance_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL DEFAULT '',
    "leave_type" TEXT NOT NULL DEFAULT '',
    "year" TEXT NOT NULL DEFAULT '',
    "opening_balance" TEXT NOT NULL DEFAULT '',
    "accrued" TEXT NOT NULL DEFAULT '',
    "used" TEXT NOT NULL DEFAULT '',
    "closing_balance" TEXT NOT NULL DEFAULT '',
    "last_updated" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "leave_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance" (
    "id" TEXT NOT NULL,
    "record_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL DEFAULT '',
    "month" TEXT NOT NULL DEFAULT '',
    "year" TEXT NOT NULL DEFAULT '',
    "working_days_in_month" TEXT NOT NULL DEFAULT '',
    "days_present" TEXT NOT NULL DEFAULT '',
    "days_absent" TEXT NOT NULL DEFAULT '',
    "lop_days" TEXT NOT NULL DEFAULT '',
    "wfh_days" TEXT NOT NULL DEFAULT '',
    "updated_at" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_requests" (
    "id" TEXT NOT NULL,
    "approval_id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL DEFAULT '',
    "action_type" TEXT NOT NULL DEFAULT '',
    "action_payload_json" TEXT NOT NULL DEFAULT '{}',
    "confidence_score" TEXT NOT NULL DEFAULT '',
    "evidence_json" TEXT NOT NULL DEFAULT '[]',
    "proposed_action_text" TEXT NOT NULL DEFAULT '',
    "created_at" TEXT NOT NULL DEFAULT '',
    "expires_at" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "approver_role" TEXT NOT NULL DEFAULT '',
    "resolved_by" TEXT NOT NULL DEFAULT '',
    "resolved_at" TEXT NOT NULL DEFAULT '',
    "resolution_notes" TEXT NOT NULL DEFAULT '',
    "attachment_drive_urls_json" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_tasks" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL DEFAULT '',
    "task_type" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "due_date" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT '',
    "completed_at" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "primary_drive_url" TEXT NOT NULL DEFAULT '',
    "primary_drive_file_id" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "hr_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_entries" (
    "id" TEXT NOT NULL,
    "entry_id" TEXT NOT NULL,
    "date" TEXT NOT NULL DEFAULT '',
    "source_ap_invoice_id" TEXT NOT NULL DEFAULT '',
    "vendor_name" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT '',
    "sub_category" TEXT NOT NULL DEFAULT '',
    "amount" TEXT NOT NULL DEFAULT '',
    "gst_amount" TEXT NOT NULL DEFAULT '',
    "gst_rate" TEXT NOT NULL DEFAULT '',
    "itc_claimable" TEXT NOT NULL DEFAULT '',
    "itc_amount" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "created_at" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "expense_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gst_input_ledger" (
    "id" TEXT NOT NULL,
    "ledger_id" TEXT NOT NULL,
    "ap_invoice_id" TEXT NOT NULL DEFAULT '',
    "vendor_name" TEXT NOT NULL DEFAULT '',
    "invoice_date" TEXT NOT NULL DEFAULT '',
    "period_month" TEXT NOT NULL DEFAULT '',
    "period_year" TEXT NOT NULL DEFAULT '',
    "invoice_amount" TEXT NOT NULL DEFAULT '',
    "gst_amount" TEXT NOT NULL DEFAULT '',
    "gst_rate" TEXT NOT NULL DEFAULT '',
    "itc_claimable" TEXT NOT NULL DEFAULT '',
    "itc_claimed" TEXT NOT NULL DEFAULT '',
    "itc_amount" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT '',
    "created_at" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "gst_input_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gst_output_ledger" (
    "id" TEXT NOT NULL,
    "ledger_id" TEXT NOT NULL,
    "ar_invoice_id" TEXT NOT NULL DEFAULT '',
    "client_name" TEXT NOT NULL DEFAULT '',
    "invoice_date" TEXT NOT NULL DEFAULT '',
    "period_month" TEXT NOT NULL DEFAULT '',
    "period_year" TEXT NOT NULL DEFAULT '',
    "taxable_amount" TEXT NOT NULL DEFAULT '',
    "igst" TEXT NOT NULL DEFAULT '',
    "cgst" TEXT NOT NULL DEFAULT '',
    "sgst" TEXT NOT NULL DEFAULT '',
    "total_gst" TEXT NOT NULL DEFAULT '',
    "created_at" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "gst_output_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_calendar" (
    "id" TEXT NOT NULL,
    "calendar_id" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT '',
    "label" TEXT NOT NULL DEFAULT '',
    "period_month" TEXT NOT NULL DEFAULT '',
    "period_year" TEXT NOT NULL DEFAULT '',
    "due_date" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT '',
    "alert_sent_7d" TEXT NOT NULL DEFAULT '',
    "alert_sent_2d" TEXT NOT NULL DEFAULT '',
    "completed_date" TEXT NOT NULL DEFAULT '',
    "filing_reference" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "compliance_calendar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_obligations" (
    "id" TEXT NOT NULL,
    "obligation_id" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT '',
    "period_month" TEXT NOT NULL DEFAULT '',
    "period_year" TEXT NOT NULL DEFAULT '',
    "due_date" TEXT NOT NULL DEFAULT '',
    "amount_inr" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT '',
    "paid_date" TEXT NOT NULL DEFAULT '',
    "payment_reference" TEXT NOT NULL DEFAULT '',
    "payroll_run_id" TEXT NOT NULL DEFAULT '',
    "created_at" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "tax_obligations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tds_records" (
    "id" TEXT NOT NULL,
    "record_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL DEFAULT '',
    "employee_name" TEXT NOT NULL DEFAULT '',
    "period_month" TEXT NOT NULL DEFAULT '',
    "period_year" TEXT NOT NULL DEFAULT '',
    "taxable_income_ytd" TEXT NOT NULL DEFAULT '',
    "tds_deducted" TEXT NOT NULL DEFAULT '',
    "tds_deposited" TEXT NOT NULL DEFAULT '',
    "quarter" TEXT NOT NULL DEFAULT '',
    "challan_reference" TEXT NOT NULL DEFAULT '',
    "created_at" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "tds_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "filing_history" (
    "id" TEXT NOT NULL,
    "filing_id" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT '',
    "period" TEXT NOT NULL DEFAULT '',
    "filed_date" TEXT NOT NULL DEFAULT '',
    "acknowledgement_number" TEXT NOT NULL DEFAULT '',
    "filed_by" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "filing_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_trail" (
    "id" TEXT NOT NULL,
    "entry_id" TEXT NOT NULL,
    "timestamp" TEXT NOT NULL DEFAULT '',
    "actor_id" TEXT NOT NULL DEFAULT '',
    "actor_role" TEXT NOT NULL DEFAULT '',
    "agent_id" TEXT NOT NULL DEFAULT '',
    "action_type" TEXT NOT NULL DEFAULT '',
    "module" TEXT NOT NULL DEFAULT '',
    "record_id" TEXT NOT NULL DEFAULT '',
    "old_value_json" TEXT NOT NULL DEFAULT '',
    "new_value_json" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT '',
    "session_id" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "audit_trail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_log" (
    "id" TEXT NOT NULL,
    "log_id" TEXT NOT NULL,
    "timestamp" TEXT NOT NULL DEFAULT '',
    "session_id" TEXT NOT NULL DEFAULT '',
    "actor_id" TEXT NOT NULL DEFAULT '',
    "actor_role" TEXT NOT NULL DEFAULT '',
    "user_message" TEXT NOT NULL DEFAULT '',
    "ai_response" TEXT NOT NULL DEFAULT '',
    "agent_routed_to" TEXT NOT NULL DEFAULT '',
    "action_taken" TEXT NOT NULL DEFAULT '',
    "action_status" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "chat_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_run_log" (
    "id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "timestamp" TEXT NOT NULL DEFAULT '',
    "agent_id" TEXT NOT NULL DEFAULT '',
    "session_id" TEXT NOT NULL DEFAULT '',
    "input_json" TEXT NOT NULL DEFAULT '',
    "output_json" TEXT NOT NULL DEFAULT '',
    "iterations" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT '',
    "confidence_score" TEXT NOT NULL DEFAULT '',
    "policy_result" TEXT NOT NULL DEFAULT '',
    "duration_ms" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "agent_run_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policy_decisions" (
    "id" TEXT NOT NULL,
    "decision_id" TEXT NOT NULL,
    "timestamp" TEXT NOT NULL DEFAULT '',
    "agent_id" TEXT NOT NULL DEFAULT '',
    "action_type" TEXT NOT NULL DEFAULT '',
    "confidence_score" TEXT NOT NULL DEFAULT '',
    "actor_role" TEXT NOT NULL DEFAULT '',
    "policy_result" TEXT NOT NULL DEFAULT '',
    "override_applied" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "policy_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policy_documents" (
    "id" TEXT NOT NULL,
    "doc_id" TEXT NOT NULL,
    "doc_type" TEXT NOT NULL DEFAULT '',
    "version" TEXT NOT NULL DEFAULT '',
    "generated_at" TEXT NOT NULL DEFAULT '',
    "generated_by" TEXT NOT NULL DEFAULT '',
    "content_markdown" TEXT NOT NULL DEFAULT '',
    "gdrive_url" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "policy_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_log" (
    "id" TEXT NOT NULL,
    "notification_id" TEXT NOT NULL,
    "timestamp" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL DEFAULT '',
    "channel" TEXT NOT NULL DEFAULT '',
    "recipient" TEXT NOT NULL DEFAULT '',
    "subject" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT '',
    "related_record_id" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "notification_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_links" (
    "id" TEXT NOT NULL,
    "link_id" TEXT NOT NULL,
    "scope_table" TEXT NOT NULL DEFAULT '',
    "scope_record_id" TEXT NOT NULL DEFAULT '',
    "role" TEXT NOT NULL DEFAULT '',
    "drive_file_id" TEXT NOT NULL DEFAULT '',
    "drive_web_view_url" TEXT NOT NULL DEFAULT '',
    "mime" TEXT NOT NULL DEFAULT '',
    "filename" TEXT NOT NULL DEFAULT '',
    "local_upload_id" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL DEFAULT '',
    "meta_json" TEXT NOT NULL DEFAULT '',
    "created_at" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "file_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "company_settings_key_key" ON "company_settings"("key");

-- CreateIndex
CREATE UNIQUE INDEX "expense_categories_category_id_key" ON "expense_categories"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_components_component_id_key" ON "payroll_components"("component_id");

-- CreateIndex
CREATE UNIQUE INDEX "leave_types_leave_type_id_key" ON "leave_types"("leave_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "compliance_rules_rule_id_key" ON "compliance_rules"("rule_id");

-- CreateIndex
CREATE UNIQUE INDEX "employees_employee_id_key" ON "employees"("employee_id");

-- CreateIndex
CREATE INDEX "employees_status_idx" ON "employees"("status");

-- CreateIndex
CREATE UNIQUE INDEX "salary_structures_structure_id_key" ON "salary_structures"("structure_id");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_master_vendor_id_key" ON "vendor_master"("vendor_id");

-- CreateIndex
CREATE UNIQUE INDEX "client_master_client_id_key" ON "client_master"("client_id");

-- CreateIndex
CREATE UNIQUE INDEX "bank_payees_payee_id_key" ON "bank_payees"("payee_id");

-- CreateIndex
CREATE UNIQUE INDEX "bank_transactions_txn_id_key" ON "bank_transactions"("txn_id");

-- CreateIndex
CREATE INDEX "bank_transactions_date_idx" ON "bank_transactions"("date");

-- CreateIndex
CREATE INDEX "bank_transactions_company_id_idx" ON "bank_transactions"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "ap_invoices_invoice_id_key" ON "ap_invoices"("invoice_id");

-- CreateIndex
CREATE INDEX "ap_invoices_payment_status_idx" ON "ap_invoices"("payment_status");

-- CreateIndex
CREATE UNIQUE INDEX "ar_invoices_invoice_id_key" ON "ar_invoices"("invoice_id");

-- CreateIndex
CREATE INDEX "ar_invoices_status_idx" ON "ar_invoices"("status");

-- CreateIndex
CREATE INDEX "ar_invoices_due_date_idx" ON "ar_invoices"("due_date");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_runs_run_id_key" ON "payroll_runs"("run_id");

-- CreateIndex
CREATE UNIQUE INDEX "salary_slips_slip_id_key" ON "salary_slips"("slip_id");

-- CreateIndex
CREATE INDEX "salary_slips_employee_id_idx" ON "salary_slips"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "leave_records_record_id_key" ON "leave_records"("record_id");

-- CreateIndex
CREATE UNIQUE INDEX "leave_balances_balance_id_key" ON "leave_balances"("balance_id");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_record_id_key" ON "attendance"("record_id");

-- CreateIndex
CREATE UNIQUE INDEX "approval_requests_approval_id_key" ON "approval_requests"("approval_id");

-- CreateIndex
CREATE INDEX "approval_requests_status_idx" ON "approval_requests"("status");

-- CreateIndex
CREATE UNIQUE INDEX "hr_tasks_task_id_key" ON "hr_tasks"("task_id");

-- CreateIndex
CREATE INDEX "hr_tasks_status_idx" ON "hr_tasks"("status");

-- CreateIndex
CREATE UNIQUE INDEX "expense_entries_entry_id_key" ON "expense_entries"("entry_id");

-- CreateIndex
CREATE UNIQUE INDEX "gst_input_ledger_ledger_id_key" ON "gst_input_ledger"("ledger_id");

-- CreateIndex
CREATE UNIQUE INDEX "gst_output_ledger_ledger_id_key" ON "gst_output_ledger"("ledger_id");

-- CreateIndex
CREATE UNIQUE INDEX "compliance_calendar_calendar_id_key" ON "compliance_calendar"("calendar_id");

-- CreateIndex
CREATE INDEX "compliance_calendar_due_date_idx" ON "compliance_calendar"("due_date");

-- CreateIndex
CREATE UNIQUE INDEX "tax_obligations_obligation_id_key" ON "tax_obligations"("obligation_id");

-- CreateIndex
CREATE UNIQUE INDEX "tds_records_record_id_key" ON "tds_records"("record_id");

-- CreateIndex
CREATE UNIQUE INDEX "filing_history_filing_id_key" ON "filing_history"("filing_id");

-- CreateIndex
CREATE UNIQUE INDEX "audit_trail_entry_id_key" ON "audit_trail"("entry_id");

-- CreateIndex
CREATE INDEX "audit_trail_session_id_idx" ON "audit_trail"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "chat_log_log_id_key" ON "chat_log"("log_id");

-- CreateIndex
CREATE UNIQUE INDEX "agent_run_log_run_id_key" ON "agent_run_log"("run_id");

-- CreateIndex
CREATE UNIQUE INDEX "policy_decisions_decision_id_key" ON "policy_decisions"("decision_id");

-- CreateIndex
CREATE UNIQUE INDEX "policy_documents_doc_id_key" ON "policy_documents"("doc_id");

-- CreateIndex
CREATE UNIQUE INDEX "notification_log_notification_id_key" ON "notification_log"("notification_id");

-- CreateIndex
CREATE UNIQUE INDEX "file_links_link_id_key" ON "file_links"("link_id");

-- CreateIndex
CREATE INDEX "file_links_scope_table_scope_record_id_idx" ON "file_links"("scope_table", "scope_record_id");
