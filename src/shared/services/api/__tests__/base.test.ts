import { describe, expect, it } from "vitest";

import type { ErrorType } from "@/shared/types";

import { ProviderError } from "../base";

describe("ProviderError", () => {
  it("should create a ProviderError from a string/generic error", () => {
    const error = new Error("Generic failure");
    const providerError = new ProviderError(error, "test-provider");

    expect(providerError.message).toBe("Generic failure");
    expect(providerError.provider).toBe("test-provider");
    expect(providerError.type).toBe("unknown");
    expect(providerError.retriable).toBe(true); // unknown defaults to retriable
    expect(providerError.userMessage).toBe(
      "Something went wrong. Please try again.",
    );
  });

  it("should classify network errors", () => {
    const error = new TypeError("Failed to fetch");
    const providerError = new ProviderError(error);

    expect(providerError.type).toBe("network");
    expect(providerError.retriable).toBe(true);
    expect(providerError.userMessage).toContain("Network connection failed");
  });

  it("should create from ProviderErrorParams", () => {
    const providerError = new ProviderError({
      type: "auth",
      message: "Invalid API key",
      retriable: false,
      originalError: null,
      provider: "test",
      userMessage: "Bad key",
      statusCode: 401,
      retryAfter: 60,
    });

    expect(providerError.type).toBe("auth");
    expect(providerError.message).toBe("Invalid API key");
    expect(providerError.retriable).toBe(false);
    expect(providerError.userMessage).toBe("Bad key");
    expect(providerError.statusCode).toBe(401);
    expect(providerError.retryAfter).toBe(60);
  });

  it("isRetriableType should correctly identify retriable types", () => {
    expect(ProviderError.isRetriableType("network")).toBe(true);
    expect(ProviderError.isRetriableType("rate_limit")).toBe(true);
    expect(ProviderError.isRetriableType("server")).toBe(true);
    expect(ProviderError.isRetriableType("quota")).toBe(true);
    expect(ProviderError.isRetriableType("unknown")).toBe(true);

    expect(ProviderError.isRetriableType("auth")).toBe(false);
    expect(ProviderError.isRetriableType("content_filter")).toBe(false);
    expect(ProviderError.isRetriableType("context_length")).toBe(false);
    expect(ProviderError.isRetriableType("validation")).toBe(false);
  });

  it("should provide appropriate user messages for common types", () => {
    const types = [
      "auth",
      "rate_limit",
      "quota",
      "model_unavailable",
      "server",
      "content_filter",
      "context_length",
      "validation",
    ];

    types.forEach((type) => {
      const providerError = new ProviderError({
        type: type as ErrorType,
        message: "Internal error",
        retriable: ProviderError.isRetriableType(type as ErrorType),
        originalError: null,
      });

      // Simple check that it's not the default "Something went wrong"
      expect(providerError.userMessage).not.toBe(
        "Something went wrong. Please try again.",
      );
      expect(providerError.userMessage.length).toBeGreaterThan(10);
    });
  });

  it("should create an empty response error", () => {
    const error = new ProviderError({
      message: "Empty response from model",
      type: "empty_response",
      retriable: false,
      originalError: null,
    });
    expect(error.message).toBe("Empty response from model");
    expect(error.type).toBe("empty_response");
  });
});
