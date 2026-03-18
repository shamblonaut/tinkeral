import { describe, expect, it } from "vitest";

import { ProviderError } from "../api";
import { RateLimiter } from "../rateLimiter";

describe("RateLimiter", () => {
  it("should initialize with default options", () => {
    const limiter = new RateLimiter();
    expect(limiter.attemptCount).toBe(0);
  });

  it("should return null for non-retriable errors", () => {
    const limiter = new RateLimiter();
    const error = new ProviderError({
      type: "auth",
      message: "Bad key",
      retriable: false,
      originalError: null,
    });

    expect(limiter.getRetryDelay(error)).toBe(null);
  });

  it("should calculate exponential backoff delay", () => {
    const limiter = new RateLimiter({
      initialDelay: 1000,
      maxDelay: 10000,
    });
    const error = new ProviderError({
      type: "rate_limit",
      message: "Too fast",
      retriable: true,
      originalError: null,
    });

    // First attempt -> delay = 1000 * 2^0 = 1000
    expect(limiter.getRetryDelay(error)).toBe(1000);
    expect(limiter.attemptCount).toBe(1);

    // Second attempt -> delay = 1000 * 2^1 = 2000
    expect(limiter.getRetryDelay(error)).toBe(2000);
    expect(limiter.attemptCount).toBe(2);

    // Third attempt -> delay = 1000 * 2^2 = 4000
    expect(limiter.getRetryDelay(error)).toBe(4000);
    expect(limiter.attemptCount).toBe(3);
  });

  it("should respect maxRetries", () => {
    const limiter = new RateLimiter({ maxRetries: 2 });
    const error = new Error("Generic error");

    expect(limiter.getRetryDelay(error)).not.toBe(null); // attempt 1
    expect(limiter.getRetryDelay(error)).not.toBe(null); // attempt 2
    expect(limiter.getRetryDelay(error)).toBe(null); // attempt 3 (exceeds max)
  });

  it("should respect maxDelay", () => {
    const limiter = new RateLimiter({
      initialDelay: 1000,
      maxDelay: 1500,
    });
    const error = new Error("Generic error");

    expect(limiter.getRetryDelay(error)).toBe(1000); // 1000 * 2^0 = 1000
    expect(limiter.getRetryDelay(error)).toBe(1500); // 1000 * 2^1 = 2000, but capped at 1500
  });

  it("should use retryAfter from error if provided", () => {
    const limiter = new RateLimiter();
    const error = new ProviderError({
      type: "rate_limit",
      message: "Wait 10s",
      retriable: true,
      originalError: null,
      retryAfter: 10, // 10 seconds
    });

    expect(limiter.getRetryDelay(error)).toBe(10000); // 10 * 1000ms
  });

  it("reset should clear attempts", () => {
    const limiter = new RateLimiter();
    limiter.getRetryDelay(new Error());
    expect(limiter.attemptCount).toBe(1);
    limiter.reset();
    expect(limiter.attemptCount).toBe(0);
  });
});
