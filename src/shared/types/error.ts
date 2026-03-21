/**
 * Error classification for LLM providers
 */
export type ErrorType =
  | "network" // Connection failed, timeout
  | "auth" // Invalid API key, permission denied
  | "rate_limit" // Too many requests
  | "validation" // Invalid request parameters
  | "server" // Provider server error (5xx)
  | "quota" // Quota exceeded
  | "model_unavailable" // Model doesn't exist or is disabled
  | "content_filter" // Content policy violation
  | "context_length" // Context too long
  | "empty_response" // Provider returned no content
  | "unknown"; // Unexpected error

/**
 * Provider-normalized error shape used by the type layer.
 */
export interface ProviderErrorLike extends Error {
  type: ErrorType;
  provider?: string;
  retriable: boolean;
  statusCode?: number;
  userMessage: string;
  originalError: unknown;
  retryAfter?: number;
}
