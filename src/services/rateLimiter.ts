import { ProviderError } from "./api/base";

export interface RetryOptions {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
};

export class RateLimiter {
  private attempts: number = 0;
  private options: RetryOptions;

  constructor(options: Partial<RetryOptions> = {}) {
    this.options = { ...DEFAULT_RETRY_OPTIONS, ...options };
  }

  /**
   * Calculate delay for the next retry attempt using exponential backoff.
   * @param error The error that occurred
   * @returns Delay in milliseconds, or null if no more retries should be attempted
   */
  getRetryDelay(error: unknown): number | null {
    if (this.attempts >= this.options.maxRetries) {
      return null;
    }

    let isRetriable = false;
    let retryAfter: number | undefined;

    if (error instanceof ProviderError) {
      isRetriable = error.retriable;
      retryAfter = error.retryAfter;
    } else if (error instanceof Error) {
      // Basic heuristic for generic errors
      isRetriable = true;
    }

    if (!isRetriable) {
      return null;
    }

    // Use retry-after header if provided by API
    if (retryAfter !== undefined) {
      return retryAfter * 1000;
    }

    // Exponential backoff: initialDelay * 2^attempts
    const delay = Math.min(
      this.options.initialDelay * Math.pow(2, this.attempts),
      this.options.maxDelay,
    );

    this.attempts++;
    return delay;
  }

  reset() {
    this.attempts = 0;
  }

  get attemptCount() {
    return this.attempts;
  }
}
