import { describe, it, expect, beforeEach } from 'vitest';
import { PolicyEngine } from './index.js';

// ─── Minimal test policy matching autopilot.json structure ───────────────────

const TEST_POLICY = {
  payment_auto_threshold_inr: 25000,
  filing_auto_execute: false,
  confidence_thresholds: {
    auto_execute_min: 0.85,
    request_approval_min: 0.60,
    recommend_only_min: 0.40,
    refuse_below: 0.40,
  },
  action_overrides: [
    { action_type: 'terminate_employee', policy: 'NEVER_AUTO_EXECUTE' as const },
    { action_type: 'send_legal_notice', policy: 'NEVER_AUTO_EXECUTE' as const },
    { action_type: 'file_gst_return', policy: 'REQUEST_APPROVAL' as const },
    { action_type: 'run_payroll', policy: 'REQUEST_APPROVAL' as const },
  ],
  rbac: {
    founder: ['*'],
    finance_lead: ['ap_invoice.*', 'ar_invoice.*', 'compliance.*', 'expense.*', 'vendor.*', 'approval.resolve'],
    hr_lead: ['hr.*', 'employee.*', 'leave.*', 'payroll.view'],
    employee: ['helpdesk.*', 'leave.request', 'payslip.download_own'],
  },
};

describe('PolicyEngine', () => {
  let engine: PolicyEngine;

  beforeEach(() => {
    engine = new PolicyEngine(TEST_POLICY);
  });

  // ── RBAC ───────────────────────────────────────────────────────────────────

  describe('RBAC', () => {
    it('grants founder access to any action', () => {
      const result = engine.evaluate({
        action: { tool_id: 'sheets.ap_invoices.create', parameters: {} },
        confidence: 0.9,
        actor_role: 'founder',
        agent_id: 'ap-invoice',
      });
      expect(result).not.toBe('REFUSE');
    });

    it('grants finance_lead access to ap_invoice actions', () => {
      const result = engine.evaluate({
        action: { tool_id: 'sheets.ap_invoices.create', parameters: {} },
        confidence: 0.9,
        actor_role: 'finance_lead',
        agent_id: 'ap-invoice',
      });
      expect(result).not.toBe('REFUSE');
    });

    it('refuses employee attempting to create an AP invoice', () => {
      const result = engine.evaluate({
        action: { tool_id: 'sheets.ap_invoices.create', parameters: {} },
        confidence: 0.95,
        actor_role: 'employee',
        agent_id: 'ap-invoice',
      });
      expect(result).toBe('REFUSE');
    });

    it('allows employee to use helpdesk tools', () => {
      const result = engine.evaluate({
        action: { tool_id: 'sheets.helpdesk.query', parameters: {} },
        confidence: 0.9,
        actor_role: 'employee',
        agent_id: 'helpdesk',
      });
      expect(result).not.toBe('REFUSE');
    });

    it('refuses hr_lead from running payroll action (only founder)', () => {
      // hr_lead can only view payroll, not run it
      const result = engine.evaluate({
        action: { tool_id: 'sheets.payroll.run', parameters: {} },
        confidence: 0.95,
        actor_role: 'hr_lead',
        agent_id: 'payroll',
      });
      expect(result).toBe('REFUSE');
    });

    it('allows hr_lead to access employee actions', () => {
      const result = engine.evaluate({
        action: { tool_id: 'sheets.employee.create', parameters: {} },
        confidence: 0.9,
        actor_role: 'hr_lead',
        agent_id: 'hr',
      });
      expect(result).not.toBe('REFUSE');
    });
  });

  // ── Confidence thresholds ──────────────────────────────────────────────────

  describe('confidence routing', () => {
    const baseAction = { tool_id: 'sheets.expense_entries.create', parameters: {} };
    const actor = { actor_role: 'founder', agent_id: 'ap-invoice' };

    it('auto-executes at or above auto_execute_min (0.85)', () => {
      expect(engine.evaluate({ action: baseAction, confidence: 0.85, ...actor })).toBe('AUTO_EXECUTE');
      expect(engine.evaluate({ action: baseAction, confidence: 0.95, ...actor })).toBe('AUTO_EXECUTE');
      expect(engine.evaluate({ action: baseAction, confidence: 1.0, ...actor })).toBe('AUTO_EXECUTE');
    });

    it('requests approval between request_approval_min (0.60) and auto_execute_min (0.85)', () => {
      expect(engine.evaluate({ action: baseAction, confidence: 0.60, ...actor })).toBe('REQUEST_APPROVAL');
      expect(engine.evaluate({ action: baseAction, confidence: 0.75, ...actor })).toBe('REQUEST_APPROVAL');
      expect(engine.evaluate({ action: baseAction, confidence: 0.84, ...actor })).toBe('REQUEST_APPROVAL');
    });

    it('recommends only between recommend_only_min (0.40) and request_approval_min (0.60)', () => {
      expect(engine.evaluate({ action: baseAction, confidence: 0.40, ...actor })).toBe('RECOMMEND_ONLY');
      expect(engine.evaluate({ action: baseAction, confidence: 0.50, ...actor })).toBe('RECOMMEND_ONLY');
      expect(engine.evaluate({ action: baseAction, confidence: 0.59, ...actor })).toBe('RECOMMEND_ONLY');
    });

    it('refuses below refuse_below threshold (0.40)', () => {
      expect(engine.evaluate({ action: baseAction, confidence: 0.39, ...actor })).toBe('REFUSE');
      expect(engine.evaluate({ action: baseAction, confidence: 0.20, ...actor })).toBe('REFUSE');
      expect(engine.evaluate({ action: baseAction, confidence: 0.0, ...actor })).toBe('REFUSE');
    });
  });

  // ── Action overrides ──────────────────────────────────────────────────────

  describe('action overrides', () => {
    const actor = { actor_role: 'founder', agent_id: 'hr' };

    it('NEVER_AUTO_EXECUTE returns REQUEST_APPROVAL even at max confidence', () => {
      const result = engine.evaluate({
        action: { tool_id: 'sheets.terminate_employee.execute', parameters: {} },
        confidence: 1.0,
        ...actor,
      });
      expect(result).toBe('REQUEST_APPROVAL');
    });

    it('REQUEST_APPROVAL override always returns REQUEST_APPROVAL regardless of confidence', () => {
      expect(engine.evaluate({
        action: { tool_id: 'sheets.file_gst_return.submit', parameters: {} },
        confidence: 1.0,
        ...actor,
      })).toBe('REQUEST_APPROVAL');

      expect(engine.evaluate({
        action: { tool_id: 'sheets.run_payroll.execute', parameters: {} },
        confidence: 1.0,
        ...actor,
      })).toBe('REQUEST_APPROVAL');
    });
  });

  // ── Payment threshold ──────────────────────────────────────────────────────

  describe('payment threshold', () => {
    it('auto-executes payment below ₹25,000 at high confidence', () => {
      const result = engine.evaluate({
        action: { tool_id: 'sheets.ap_invoices.create', parameters: {} },
        confidence: 0.9,
        actor_role: 'founder',
        agent_id: 'ap-invoice',
        metadata: { amount_inr: 15000, action_type: 'ap_invoices.create', module: 'ap_invoices' },
      });
      expect(result).toBe('AUTO_EXECUTE');
    });

    it('requests approval for payment above ₹25,000', () => {
      const result = engine.evaluate({
        action: { tool_id: 'sheets.ap_invoices.create', parameters: {} },
        confidence: 0.95,
        actor_role: 'founder',
        agent_id: 'ap-invoice',
        metadata: { amount_inr: 50000, action_type: 'ap_invoices.create', module: 'ap_invoices' },
      });
      expect(result).toBe('REQUEST_APPROVAL');
    });

    it('requests approval for payment exactly at ₹25,001', () => {
      const result = engine.evaluate({
        action: { tool_id: 'sheets.ap_invoices.create', parameters: {} },
        confidence: 1.0,
        actor_role: 'founder',
        agent_id: 'ap-invoice',
        metadata: { amount_inr: 25001, action_type: 'ap_invoices.create', module: 'ap_invoices' },
      });
      expect(result).toBe('REQUEST_APPROVAL');
    });
  });

  // ── Filing actions ──────────────────────────────────────────────────────────

  describe('filing actions', () => {
    it('requests approval for filing actions when filing_auto_execute=false', () => {
      const result = engine.evaluate({
        action: { tool_id: 'compliance.file_return.execute', parameters: {} },
        confidence: 0.95,
        actor_role: 'founder',
        agent_id: 'compliance',
        metadata: { is_filing_action: true, action_type: 'compliance.file_return', module: 'compliance' },
      });
      expect(result).toBe('REQUEST_APPROVAL');
    });
  });

  // ── High-impact actions ────────────────────────────────────────────────────

  describe('high-impact action defaults', () => {
    it('requests approval for payroll actions at high confidence (no override needed)', () => {
      const result = engine.evaluate({
        action: { tool_id: 'sheets.payroll_runs.create', parameters: {} },
        confidence: 0.95,
        actor_role: 'founder',
        agent_id: 'payroll',
        metadata: { action_type: 'payroll.create', module: 'payroll' },
      });
      expect(result).toBe('REQUEST_APPROVAL');
    });

    it('requests approval for bank actions at high confidence', () => {
      const result = engine.evaluate({
        action: { tool_id: 'bank.transfer.initiate', parameters: {} },
        confidence: 0.95,
        actor_role: 'founder',
        agent_id: 'payroll',
        metadata: { action_type: 'bank.transfer', module: 'bank' },
      });
      expect(result).toBe('REQUEST_APPROVAL');
    });
  });

  // ── Policy with filing_auto_execute=true ───────────────────────────────────

  describe('when filing_auto_execute is true', () => {
    it('auto-executes filing actions at high confidence', () => {
      const permissiveEngine = new PolicyEngine({
        ...TEST_POLICY,
        filing_auto_execute: true,
        action_overrides: [], // no overrides
      });
      const result = permissiveEngine.evaluate({
        action: { tool_id: 'compliance.file_return.execute', parameters: {} },
        confidence: 0.90,
        actor_role: 'founder',
        agent_id: 'compliance',
        metadata: { is_filing_action: true, action_type: 'compliance.execute', module: 'compliance' },
      });
      expect(result).toBe('AUTO_EXECUTE');
    });
  });
});
