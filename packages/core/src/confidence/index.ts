// ConfidenceScorer — pure function, zero LLM calls.
// Scores the confidence of a proposed action based on weighted signals.
// Weights are configurable (not hardcoded).

import type { ConfidenceScore } from '../types/agent.js';

interface ScoringWeights {
  extraction_completeness: number;
  entity_match_quality: number;
  category_match_quality: number;
  historical_pattern_match: number;
  data_freshness: number;
}

const DEFAULT_WEIGHTS: ScoringWeights = {
  extraction_completeness: 0.30,
  entity_match_quality: 0.20,
  category_match_quality: 0.20,
  historical_pattern_match: 0.15,
  data_freshness: 0.15,
};

export interface ScoringInputs {
  // 0–1: fraction of required fields successfully extracted
  extraction_completeness: number;
  // 0–1: 1.0 = exact match, 0.7 = fuzzy match, 0 = no match
  entity_match_quality: number;
  // 0–1: 1.0 = exact category match, 0.5 = ambiguous, 0 = unclassified
  category_match_quality: number;
  // 0–1: 1.0 = identical action taken before, 0.5 = similar, 0 = novel
  historical_pattern_match: number;
  // 0–1: 1.0 = real-time data, 0.5 = <24h old, 0 = >72h old
  data_freshness: number;
}

export interface ConfidenceSignals {
  required_fields?: string[];
  extracted_fields?: Record<string, unknown>;
  entity_match_confidence?: number;
  category_match_confidence?: number;
  historical_match_confidence?: number;
  data_age_hours?: number;
}

export function deriveScoringInputs(signals: ConfidenceSignals): ScoringInputs {
  const required = signals.required_fields ?? [];
  const extracted = signals.extracted_fields ?? {};
  const extractedCount = required.filter((field) => {
    const value = extracted[field];
    return value !== undefined && value !== null && value !== '';
  }).length;

  const completeness =
    required.length === 0 ? 0.9 : extractedCount / required.length;

  const hours = signals.data_age_hours ?? 6;
  const freshness =
    hours <= 1 ? 1 : hours <= 24 ? 0.7 : hours <= 72 ? 0.4 : 0.2;

  return {
    extraction_completeness: completeness,
    entity_match_quality: signals.entity_match_confidence ?? 0.65,
    category_match_quality: signals.category_match_confidence ?? 0.65,
    historical_pattern_match: signals.historical_match_confidence ?? 0.55,
    data_freshness: freshness,
  };
}

export function scoreConfidence(
  inputs: ScoringInputs,
  weights: ScoringWeights = DEFAULT_WEIGHTS
): ConfidenceScore {
  const breakdown = {
    extraction_completeness: clamp(inputs.extraction_completeness),
    entity_match_quality: clamp(inputs.entity_match_quality),
    category_match_quality: clamp(inputs.category_match_quality),
    historical_pattern_match: clamp(inputs.historical_pattern_match),
    data_freshness: clamp(inputs.data_freshness),
  };

  const overall =
    breakdown.extraction_completeness * weights.extraction_completeness +
    breakdown.entity_match_quality * weights.entity_match_quality +
    breakdown.category_match_quality * weights.category_match_quality +
    breakdown.historical_pattern_match * weights.historical_pattern_match +
    breakdown.data_freshness * weights.data_freshness;

  return {
    overall: Math.round(overall * 100) / 100,
    breakdown,
  };
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}
