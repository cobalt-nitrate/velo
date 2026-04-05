/**
 * Retry wrapper for Google Sheets API calls that hit per-minute quotas or transient errors.
 */

export function isSheetsQuotaError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    /quota|Quota exceeded|429|503|rate limit|RATE_LIMIT|RESOURCE_EXHAUSTED|ECONNRESET|ETIMEDOUT|try again later/i.test(
      msg
    ) || (typeof err === 'object' && err !== null && 'code' in err && Number((err as { code?: number }).code) === 429)
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export type SheetsRetryOptions = {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
};

const DEFAULT_OPTS: Required<SheetsRetryOptions> = {
  maxAttempts: 6,
  baseDelayMs: 2500,
  maxDelayMs: 120_000,
};

/**
 * Runs `fn` with exponential backoff on quota / transient errors.
 */
export async function withGoogleSheetsRetry<T>(
  label: string,
  fn: () => Promise<T>,
  options?: SheetsRetryOptions
): Promise<T> {
  const { maxAttempts, baseDelayMs, maxDelayMs } = { ...DEFAULT_OPTS, ...options };
  let delay = baseDelayMs;
  let lastErr: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const retryable = isSheetsQuotaError(err);
      if (!retryable || attempt >= maxAttempts) {
        throw err;
      }
      console.warn(
        `[sheets-retry] ${label} attempt ${attempt}/${maxAttempts} failed — waiting ${delay}ms`
      );
      await sleep(delay);
      delay = Math.min(delay * 2, maxDelayMs);
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}
