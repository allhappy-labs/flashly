import { Rating } from "ts-fsrs";
import type { FsrsState } from "../types/models";

export type TimeGradingConfig = {
  enabled: boolean;
  baseTargetMs: Record<FsrsState, number>;
  thresholds: {
    easy: number;
    good: number;
  };
  adaptWeight: number;
  clampMs: {
    min: number;
    max: number;
  };
  emaAlpha: number;
};

export type TimeGradingResult = {
  rating: Rating;
  effectiveMs: number;
  targetMs: number;
  normalized: number;
};

export const DEFAULT_TIME_GRADING_CONFIG: TimeGradingConfig = {
  enabled: true,
  baseTargetMs: {
    new: 6000,
    learning: 6000,
    relearning: 7000,
    review: 3500,
  },
  thresholds: {
    easy: 0.6,
    good: 1.2,
  },
  adaptWeight: 0.35,
  clampMs: {
    min: 300,
    max: 30000,
  },
  emaAlpha: 0.2,
};

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}

function sanitizeThreshold(value: unknown, fallback: number) {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return Math.max(0.1, Math.min(4, value));
}

function sanitizeMs(value: unknown, fallback: number) {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return Math.max(100, value);
}

export function normalizeTimeGradingConfig(input?: Partial<TimeGradingConfig> | null): TimeGradingConfig {
  const baseTarget: Partial<Record<FsrsState, number>> = input?.baseTargetMs ?? {};
  const thresholds: Partial<TimeGradingConfig["thresholds"]> = input?.thresholds ?? {};
  const clampMs: Partial<TimeGradingConfig["clampMs"]> = input?.clampMs ?? {};
  return {
    enabled: true,
    baseTargetMs: {
      new: sanitizeMs(baseTarget.new, DEFAULT_TIME_GRADING_CONFIG.baseTargetMs.new),
      learning: sanitizeMs(baseTarget.learning, DEFAULT_TIME_GRADING_CONFIG.baseTargetMs.learning),
      review: sanitizeMs(baseTarget.review, DEFAULT_TIME_GRADING_CONFIG.baseTargetMs.review),
      relearning: sanitizeMs(baseTarget.relearning, DEFAULT_TIME_GRADING_CONFIG.baseTargetMs.relearning),
    },
    thresholds: {
      easy: sanitizeThreshold(thresholds.easy, DEFAULT_TIME_GRADING_CONFIG.thresholds.easy),
      good: sanitizeThreshold(thresholds.good, DEFAULT_TIME_GRADING_CONFIG.thresholds.good),
    },
    adaptWeight: clampNumber(
      typeof input?.adaptWeight === "number" ? input.adaptWeight : DEFAULT_TIME_GRADING_CONFIG.adaptWeight,
      0,
      1,
    ),
    clampMs: {
      min: sanitizeMs(clampMs.min, DEFAULT_TIME_GRADING_CONFIG.clampMs.min),
      max: sanitizeMs(clampMs.max, DEFAULT_TIME_GRADING_CONFIG.clampMs.max),
    },
    emaAlpha: clampNumber(
      typeof input?.emaAlpha === "number" ? input.emaAlpha : DEFAULT_TIME_GRADING_CONFIG.emaAlpha,
      0.05,
      0.8,
    ),
  };
}

export function computeTimeGradingResult(params: {
  cardState: FsrsState;
  answerTimeMs: number;
  deckEmaMs?: number | null;
  config: TimeGradingConfig;
}): TimeGradingResult {
  const baseTargetMs = params.config.baseTargetMs[params.cardState] ?? params.config.baseTargetMs.review;
  const effectiveMs = clampNumber(params.answerTimeMs, params.config.clampMs.min, params.config.clampMs.max);
  const deckEmaMs = params.deckEmaMs ?? null;
  const adaptWeight = params.config.adaptWeight;
  const targetMs =
    deckEmaMs && Number.isFinite(deckEmaMs)
      ? baseTargetMs * (1 - adaptWeight) + deckEmaMs * adaptWeight
      : baseTargetMs;
  const normalized = effectiveMs / Math.max(1, targetMs);
  const rating =
    normalized <= params.config.thresholds.easy
      ? Rating.Easy
      : normalized <= params.config.thresholds.good
        ? Rating.Good
        : Rating.Hard;
  return {
    rating,
    effectiveMs,
    targetMs,
    normalized,
  };
}

export function updateTimeEmaMs(prevEmaMs: number | null | undefined, sampleMs: number, alpha: number) {
  if (!Number.isFinite(sampleMs)) return prevEmaMs ?? null;
  if (!prevEmaMs || !Number.isFinite(prevEmaMs)) return sampleMs;
  return prevEmaMs * (1 - alpha) + sampleMs * alpha;
}
