import { describe, expect, it } from 'vitest';
import {
  computeStableDocumentId,
  deriveDocumentType,
  deriveSubject,
} from './registry.js';

describe('documents.registry', () => {
  it('computeStableDocumentId is stable for same inputs', () => {
    const a = computeStableDocumentId({
      type: 'salary_slip',
      subjectType: 'employee',
      subjectId: 'EMP001',
      periodMonth: '04',
      periodYear: '2026',
    });
    const b = computeStableDocumentId({
      type: 'salary_slip',
      subjectType: 'employee',
      subjectId: 'EMP001',
      periodMonth: '04',
      periodYear: '2026',
    });
    expect(a).toBe(b);
    expect(a.startsWith('doc_')).toBe(true);
  });

  it('deriveDocumentType maps tool ids', () => {
    expect(deriveDocumentType('documents.drive.generate_salary_slip')).toBe('salary_slip');
    expect(deriveDocumentType('documents.drive.generate_offer_letter')).toBe('offer_letter');
    expect(deriveDocumentType('documents.pdf_generator.generate_invoice')).toBe('ar_invoice');
    expect(deriveDocumentType('documents.drive.upload_invoice')).toBe('ap_invoice_source');
  });

  it('deriveSubject uses employee_id for salary slips', () => {
    const subj = deriveSubject(
      { employee_id: 'EMP9', employee_email: 'a@b.com', month: 'Apr', year: '2026' },
      'salary_slip'
    );
    expect(subj.subjectType).toBe('employee');
    expect(subj.subjectId).toBe('EMP9');
    expect(subj.employeeEmail).toBe('a@b.com');
  });
});

