import type { ErrorType } from "@/types/error";

/**
 * Normalize any error to a common format.
 *
 * @param error The original error object
 * @param provider The provider id (e.g., 'google', 'openai')
 * @returns A normalized error object
 */
export interface ProviderErrorParams {
  type: ErrorType;
  provider?: string;
  message: string;
  retriable: boolean;
  originalError: unknown;
  userMessage?: string;
  statusCode?: number;
  retryAfter?: number;
}

function isProviderErrorParams(error: unknown): error is ProviderErrorParams {
  return (
    typeof error === "object" &&
    error !== null &&
    "type" in error &&
    "message" in error &&
    "retriable" in error
  );
}

export class ProviderError extends Error {
  type: ErrorType;
  provider?: string;
  retriable: boolean;
  statusCode?: number;
  userMessage: string;
  originalError: unknown;
  retryAfter?: number;

  constructor(error: ProviderErrorParams | unknown, provider?: string) {
    let params: ProviderErrorParams;

    if (isProviderErrorParams(error)) {
      params = error;
    } else {
      let message = "An unexpected error occurred";
      let type: ErrorType = "unknown";
      const originalError = error;

      if (error instanceof Error) {
        message = error.message;
      }

      // Basic heuristic for network errors
      if (error instanceof TypeError && message.includes("fetch")) {
        type = "network";
      }

      params = {
        type,
        message,
        retriable: ProviderError.isRetriableType(type),
        provider,
        originalError,
      };
    }

    super(params.message);
    this.name = "ProviderError";
    this.type = params.type;
    this.retriable = params.retriable;
    this.statusCode = params.statusCode;
    this.provider = params.provider;
    this.originalError = params.originalError;
    this.retryAfter = params.retryAfter;

    // Apply specialized user message if not already provided
    this.userMessage =
      params.userMessage ||
      ProviderError.getUserMessage(this.type) ||
      "Something went wrong. Please try again.";

    // Restore prototype chain for proper instanceof checks
    Object.setPrototypeOf(this, ProviderError.prototype);
  }

  static isRetriableType(type: ErrorType): boolean {
    return ["network", "rate_limit", "server", "unknown", "quota"].includes(
      type,
    );
  }

  static getUserMessage(type: ErrorType): string | null {
    switch (type as string) {
      case "network":
        return "Network connection failed. Please check your internet connection.";
      case "auth":
        return "Authentication failed. Please check your API key.";
      case "rate_limit":
        return "Rate limit exceeded. Please try again later.";
      case "quota":
        return "Project quota exceeded. Please try again later or check your billing status.";
      case "model_unavailable":
        return "The selected model is currently unavailable or doesn't exist.";
      case "server":
        return "The AI provider is experiencing issues. Please try again later.";
      case "content_filter":
        return "The request was blocked by the safety filters.";
      case "context_length":
        return "The conversation is too long for this model's context window.";
      case "validation":
        return "The request contains invalid parameters.";
      default:
        return null;
    }
  }
}

/**
 * Simple token estimation (approximation).
 * ~4 characters per token.
 */
export async function estimateTokens(text: string): Promise<number> {
  return Promise.resolve(Math.ceil(text.length / 4));
}
