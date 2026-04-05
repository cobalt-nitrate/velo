import { describe, it, expect } from 'vitest';
import { deriveScoringInputs, scoreConfidence } from './index.js';
import type { ScoringInputs } from './index.js';

describe('scoreConfidence', () => {
  // ── Basic bounds ────────────────────────────────────────────────────────────

  it('returns 1.0 when all signals are perfect', () => {
    const inputs: ScoringInputs = {
      extraction_completeness: 1.0,
      entity_match_quality: 1.0,
      category_match_quality: 1.0,
      historical_pattern_match: 1.0,
      data_freshness: 1.0,
    };
    const result = scoreConfidence(inputs);
    expect(result.overall).toBe(1.0);
  });

  it('returns 0.0 when all signals are zero', () => {
    const inputs: ScoringInputs = {
      extraction_completeness: 0,
      entity_match_quality: 0,
      category_match_quality: 0,
      historical_pattern_match: 0,
      data_freshness: 0,
    };
    const result = scoreConfidence(inputs);
    expect(result.overall).toBe(0.0);
  });

  it('clamps values above 1.0 to 1.0', () => {
    const inputs: ScoringInputs = {
      extraction_completeness: 2.0,
      entity_match_quality: 1.5,
      category_match_quality: 1.2,
      historical_pattern_match: 1.1,
      data_freshness: 1.9,
    };
    const result = scoreConfidence(inputs);
    expect(result.overall).toBe(1.0);
  });

  it('clamps values below 0 to 0', () => {
    const inputs: ScoringInputs = {
      extraction_completeness: -0.5,
      entity_match_quality: -1.0,
      category_match_quality: -0.1,
      historical_pattern_match: -0.3,
      data_freshness: -0.9,
    };
    const result = scoreConfidence(inputs);
    expect(result.overall).toBe(0.0);
  });

  // ── Weight calculation ──────────────────────────────────────────────────────

  it('calculates weighted overall correctly (default weights)', () => {
    const inputs: ScoringInputs = {
      extraction_completeness: 1.0,   // weight 0.30 → 0.30
      entity_match_quality: 0.0,      // weight 0.20 → 0.00
      category_match_quality: 0.0,    // weight 0.20 → 0.00
      historical_pattern_match: 0.0,  // weight 0.15 → 0.00
      data_freshness: 0.0,            // weight 0.15 → 0.00
    };
    const result = scoreConfidence(inputs);
    expect(result.overall).toBeCloseTo(0.30, 2);
  });

  it('calculates weighted overall correctly when entity match is perfect', () => {
    const inputs: ScoringInputs = {
      extraction_completeness: 0.0,  // 0.30 → 0
      entity_match_quality: 1.0,     // 0.20 → 0.20
      category_match_quality: 0.0,
      historical_pattern_match: 0.0,
      data_freshness: 0.0,
    };
    const result = scoreConfidence(inputs);
    expect(result.overall).toBeCloseTo(0.20, 2);
  });

  it('all weights sum to 1.0 (default weights)', () => {
    // Verify the default weights are normalized: each signal at 1.0 should give exactly 1.0
    const inputs: ScoringInputs = {
      extraction_completeness: 1.0,
      entity_match_quality: 1.0,
      category_match_quality: 1.0,
      historical_pattern_match: 1.0,
      data_freshness: 1.0,
    };
    const result = scoreConfidence(inputs);
    // Default weights: 0.30 + 0.20 + 0.20 + 0.15 + 0.15 = 1.00
    expect(result.overall).toBe(1.0);
  });

  it('supports custom weights', () => {
    const inputs: ScoringInputs = {
      extraction_completeness: 1.0,
      entity_match_quality: 0.0,
      category_match_quality: 0.0,
      historical_pattern_match: 0.0,
      data_freshness: 0.0,
    };
    // Custom: all weight on extraction
    const result = scoreConfidence(inputs, {
      extraction_completeness: 1.0,
      entity_match_quality: 0.0,
      category_match_quality: 0.0,
      historical_pattern_match: 0.0,
      data_freshness: 0.0,
    });
    expect(result.overall).toBe(1.0);
  });

  // ── Breakdown ──────────────────────────────────────────────────────────────

  it('returns clamped breakdown values', () => {
    const inputs: ScoringInputs = {
      extraction_completeness: 0.75,
      entity_match_quality: 0.90,
      category_match_quality: 0.60,
      historical_pattern_match: 0.50,
      data_freshness: 0.80,
    };
    const result = scoreConfidence(inputs);
    expect(result.breakdown.extraction_completeness).toBe(0.75);
    expect(result.breakdown.entity_match_quality).toBe(0.90);
    expect(result.breakdown.category_match_quality).toBe(0.60);
    expect(result.breakdown.historical_pattern_match).toBe(0.50);
    expect(result.breakdown.data_freshness).toBe(0.80);
  });

  it('rounds overall to 2 decimal places', () => {
    const inputs: ScoringInputs = {
      extraction_completeness: 0.33,
      entity_match_quality: 0.33,
      category_match_quality: 0.33,
      historical_pattern_match: 0.33,
      data_freshness: 0.33,
    };
    const result = scoreConfidence(inputs);
    // Should be a clean 2dp number, not a floating point artifact
    expect(result.overall).toBe(Math.round(result.overall * 100) / 100);
  });

  // ── Realistic AP invoice scenarios ──────────────────────────────────────────

  it('high confidence scenario: full extraction, known vendor, clear category', () => {
    const result = scoreConfidence({
      extraction_completeness: 1.0,    // all fields extracted
      entity_match_quality: 0.98,      // vendor in master (GSTIN match)
      category_match_quality: 0.92,    // clear SaaS category
      historical_pattern_match: 0.85,  // vendor seen many times
      data_freshness: 1.0,             // fresh data
    });
    // Expected: well above auto-execute threshold of 0.85
    expect(result.overall).toBeGreaterThan(0.85);
  });

  it('low confidence scenario: partial extraction, unknown vendor, novel category', () => {
    const result = scoreConfidence({
      extraction_completeness: 0.5,   // missing date or amount
      entity_match_quality: 0.2,      // vendor not found in master
      category_match_quality: 0.3,    // ambiguous category
      historical_pattern_match: 0.0,  // never seen this vendor
      data_freshness: 0.7,
    });
    // Expected: below request_approval threshold of 0.60
    expect(result.overall).toBeLessThan(0.60);
  });

  it('medium confidence scenario: good extraction, fuzzy vendor match', () => {
    const result = scoreConfidence({
      extraction_completeness: 0.90,   // most fields extracted
      entity_match_quality: 0.70,      // fuzzy name match, no GSTIN
      category_match_quality: 0.75,    // reasonable category
      historical_pattern_match: 0.60,  // similar vendor seen before
      data_freshness: 0.70,
    });
    // Expected: between 0.60 and 0.85 (REQUEST_APPROVAL range)
    expect(result.overall).toBeGreaterThanOrEqual(0.60);
    expect(result.overall).toBeLessThan(0.85);
  });
});

describe('deriveScoringInputs', () => {
  // ── Extraction completeness ────────────────────────────────────────────────

  it('returns 0.9 completeness when no required fields specified', () => {
    const result = deriveScoringInputs({
      required_fields: [],
      extracted_fields: {},
    });
    expect(result.extraction_completeness).toBe(0.9);
  });

  it('returns 1.0 when all required fields are present', () => {
    const result = deriveScoringInputs({
      required_fields: ['amount', 'vendor_name', 'invoice_date'],
      extracted_fields: { amount: 5000, vendor_name: 'Acme', invoice_date: '2025-03-01' },
    });
    expect(result.extraction_completeness).toBe(1.0);
  });

  it('returns fractional completeness for partial extraction', () => {
    const result = deriveScoringInputs({
      required_fields: ['amount', 'vendor_name', 'invoice_date'],
      extracted_fields: { amount: 5000 }, // only 1 of 3 fields
    });
    expect(result.extraction_completeness).toBeCloseTo(1 / 3, 5);
  });

  it('treats null and empty string as missing', () => {
    const result = deriveScoringInputs({
      required_fields: ['amount', 'vendor_name'],
      extracted_fields: { amount: null, vendor_name: '' },
    });
    expect(result.extraction_completeness).toBe(0);
  });

  it('treats undefined field as missing', () => {
    const result = deriveScoringInputs({
      required_fields: ['amount', 'vendor_name'],
      extracted_fields: { amount: 5000 }, // vendor_name undefined
    });
    expect(result.extraction_completeness).toBe(0.5);
  });

  // ── Data freshness ──────────────────────────────────────────────────────────

  it('returns freshness 1.0 for data ≤ 1 hour old', () => {
    const result = deriveScoringInputs({ data_age_hours: 0 });
    expect(result.data_freshness).toBe(1);

    const result2 = deriveScoringInputs({ data_age_hours: 1 });
    expect(result2.data_freshness).toBe(1);
  });

  it('returns freshness 0.7 for data 2–24 hours old', () => {
    const result = deriveScoringInputs({ data_age_hours: 12 });
    expect(result.data_freshness).toBe(0.7);

    const result2 = deriveScoringInputs({ data_age_hours: 24 });
    expect(result2.data_freshness).toBe(0.7);
  });

  it('returns freshness 0.4 for data 25–72 hours old', () => {
    const result = deriveScoringInputs({ data_age_hours: 48 });
    expect(result.data_freshness).toBe(0.4);

    const result2 = deriveScoringInputs({ data_age_hours: 72 });
    expect(result2.data_freshness).toBe(0.4);
  });

  it('returns freshness 0.2 for data >72 hours old', () => {
    const result = deriveScoringInputs({ data_age_hours: 100 });
    expect(result.data_freshness).toBe(0.2);
  });

  it('defaults to 6h freshness when data_age_hours not provided', () => {
    const result = deriveScoringInputs({});
    // 6h falls in the 2–24h bucket → 0.7
    expect(result.data_freshness).toBe(0.7);
  });

  // ── Pass-through signals ───────────────────────────────────────────────────

  it('passes through entity/category/historical confidence values', () => {
    const result = deriveScoringInputs({
      entity_match_confidence: 0.88,
      category_match_confidence: 0.72,
      historical_match_confidence: 0.55,
    });
    expect(result.entity_match_quality).toBe(0.88);
    expect(result.category_match_quality).toBe(0.72);
    expect(result.historical_pattern_match).toBe(0.55);
  });

  it('uses defaults when entity/category/historical not provided', () => {
    const result = deriveScoringInputs({});
    expect(result.entity_match_quality).toBe(0.65);
    expect(result.category_match_quality).toBe(0.65);
    expect(result.historical_pattern_match).toBe(0.55);
  });
});
