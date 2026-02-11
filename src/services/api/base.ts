import type { ErrorType, NormalizedError } from "../../types/provider";

/**
 * Normalize any error to a common format.
 *
 * @param error The original error object
 * @param provider The provider id (e.g., 'google', 'openai')
 * @returns A normalized error object
 */
export function normalizeError(
  error: unknown,
  provider: string,
): NormalizedError {
  let message = "An unexpected error occurred";
  let type: ErrorType = "unknown";
  const statusCode: number | undefined = undefined; // Initialize and use const if not reassigned, or let if it will be. Actually statusCode is never reassigned here, so maybe just undefined.
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

  return {
    type,
    message,
    userMessage,
    retriable: isRetriableType(type),
    statusCode,
    provider,
    originalError,
  };
}

/**
 * Check if an error type is retriable.
 */
function isRetriableType(type: ErrorType): boolean {
  return ["network", "rate_limit", "server", "unknown"].includes(type);
}

/**
 * Check if a normalized error is retriable.
 */
export function isRetriable(error: NormalizedError): boolean {
  return error.retriable;
}

/**
 * Simple token estimation (approximation).
 * ~4 characters per token.
 */
export async function estimateTokens(text: string): Promise<number> {
  return Promise.resolve(Math.ceil(text.length / 4));
}
