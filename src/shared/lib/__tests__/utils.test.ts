import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { formatRelativeTime, formatSmartDate } from "../utils";

describe("formatRelativeTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Pin "now" to a fixed point
    vi.setSystemTime(new Date("2024-06-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const now = () => new Date("2024-06-15T12:00:00Z").getTime();

  it("should return 'just now' for differences under 1 minute", () => {
    expect(formatRelativeTime(now() - 30_000)).toBe("just now");
    expect(formatRelativeTime(now() - 0)).toBe("just now");
  });

  it("should return '1 minute ago' for exactly 1 minute", () => {
    expect(formatRelativeTime(now() - 60_000)).toBe("1 minute ago");
  });

  it("should return plural 'X minutes ago' for > 1 minute", () => {
    expect(formatRelativeTime(now() - 5 * 60_000)).toBe("5 minutes ago");
  });

  it("should return '1 hour ago' for exactly 1 hour", () => {
    expect(formatRelativeTime(now() - 60 * 60_000)).toBe("1 hour ago");
  });

  it("should return plural 'X hours ago' for > 1 hour", () => {
    expect(formatRelativeTime(now() - 3 * 60 * 60_000)).toBe("3 hours ago");
  });

  it("should return '1 day ago' for exactly 1 day", () => {
    expect(formatRelativeTime(now() - 24 * 60 * 60_000)).toBe("1 day ago");
  });

  it("should return plural 'X days ago' for > 1 day and < 7 days", () => {
    expect(formatRelativeTime(now() - 3 * 24 * 60 * 60_000)).toBe("3 days ago");
  });

  it("should return a locale date string for 7+ days ago", () => {
    const old =
      new Date("2024-06-15T12:00:00Z").getTime() - 7 * 24 * 60 * 60_000;
    const result = formatRelativeTime(old);
    // Should fall through to toLocaleDateString, not a relative string
    expect(result).not.toContain("ago");
    expect(result).not.toBe("just now");
  });

  it("should accept a Date object as input", () => {
    expect(formatRelativeTime(new Date(now() - 45_000))).toBe("just now");
  });
});

describe("formatSmartDate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should return a time string for a date on the same day", () => {
    const sameDay = new Date("2024-06-15T08:30:00Z");
    const result = formatSmartDate(sameDay);
    // Should look like a time, e.g. "08:30" or "8:30 AM"
    expect(result).toMatch(/\d{1,2}:\d{2}/);
  });

  it("should return a date string for a date on a different day", () => {
    const differentDay = new Date("2024-06-14T08:30:00Z");
    const result = formatSmartDate(differentDay);
    // Should not look like just a time — should contain a date component
    expect(result).not.toMatch(/^\d{1,2}:\d{2}( AM| PM)?$/);
  });

  it("should accept a timestamp number as input", () => {
    const ts = new Date("2024-06-15T09:00:00Z").getTime();
    const result = formatSmartDate(ts);
    expect(result).toMatch(/\d{1,2}:\d{2}/);
  });
});
