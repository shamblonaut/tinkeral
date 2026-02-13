import type { ErrorType } from "@/types";

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
      const statusCode: number | undefined = undefined;
      const originalError = error;

      if (error instanceof Error) {
        message = error.message;
      }

      // Basic heuristic for network errors
      if (error instanceof TypeError && message.includes("fetch")) {
        type = "network";
      }

      // Default user message
      let userMessage = "Something went wrong. Please try again.";

      // Map types to user messages
      switch (type as ErrorType) {
        case "network":
          userMessage =
            "Network connection failed. Please check your internet connection.";
          break;
        case "auth":
          userMessage = "Authentication failed. Please check your API key.";
          break;
        case "rate_limit":
          userMessage = "Rate limit exceeded. Please try again later.";
          break;
        case "model_unavailable":
          userMessage = "The selected model is currently unavailable.";
          break;
        case "server":
          userMessage =
            "The AI provider is experiencing issues. Please try again later.";
          break;
      }

      params = {
        type,
        message,
        userMessage,
        retriable: ProviderError.isRetriableType(type),
        statusCode,
        provider,
        originalError,
      };
    }

    super(params.message);
    this.name = "ProviderError";
    this.type = params.type;
    this.userMessage =
      params.userMessage || "Something went wrong. Please try again.";
    this.retriable = params.retriable;
    this.statusCode = params.statusCode;
    this.provider = params.provider;
    this.originalError = params.originalError;
    this.retryAfter = params.retryAfter;

    // Restore prototype chain for proper instanceof checks
    Object.setPrototypeOf(this, ProviderError.prototype);
  }

  static isRetriableType(type: ErrorType): boolean {
    return ["network", "rate_limit", "server", "unknown"].includes(type);
  }
}

/**
 * Simple token estimation (approximation).
 * ~4 characters per token.
 */
export async function estimateTokens(text: string): Promise<number> {
  return Promise.resolve(Math.ceil(text.length / 4));
}
