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
  | "unknown"; // Unexpected error
