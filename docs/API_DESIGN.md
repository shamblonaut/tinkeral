# API Design

## Purpose

This document defines all TypeScript interfaces, types, and contracts used throughout the application. It serves as the single source of truth for type definitions and API contracts.

## Design Principles

1. **Type Safety**: External data validated at runtime with Zod
2. **Practical**: Only define types we actually need
3. **Extensible**: Support future enhancements without breaking changes
4. **Clear**: Self-documenting names with JSDoc where helpful

## Core Domain Types

### Message

```typescript
/**
 * Represents a single message in a conversation.
 */
interface Message {
  readonly id: string; // Immutable identifier
  role: "user" | "model" | "system";
  content: string;
  readonly timestamp: number; // Created timestamp

  // Optional metadata
  metadata?: {
    model?: string;
    tokens?: number;
    finishReason?: FinishReason;
  };

  // Function calling support (v1.1+)
  functionCall?: FunctionCall;
  functionResult?: FunctionResult;
}

/**
 * Function call requested by the model
 */
interface FunctionCall {
  name: string;
  arguments: Record<string, unknown>;
}

/**
 * Result of executing a function call
 */
interface FunctionResult {
  name: string;
  result: unknown;
  error?: string;
}
```

### Conversation

```typescript
/**
 * A complete conversation with all metadata.
 * Stored in IndexedDB.
 */
interface Conversation {
  readonly id: string;
  title: string;
  messages: Message[];
  modelId: string;
  parameters: ModelParameters;
  systemPrompt?: string;
  readonly createdAt: number;
  updatedAt: number;

  // Optional metadata
  metadata?: {
    totalTokens?: number;
    estimatedCost?: number;
  };
}

/**
 * Minimal conversation info for lists
 */
interface ConversationSummary {
  readonly id: string;
  title: string;
  modelId: string;
  lastMessage?: string;
  updatedAt: number;
  messageCount: number;
}
```

### Model Parameters

```typescript
/**
 * Parameters that control model behavior.
 * Provider-specific parameters use optional fields.
 */
interface ModelParameters {
  temperature: number; // 0.0 - 2.0 (provider dependent)
  maxTokens: number; // Max completion tokens
  topP: number; // 0.0 - 1.0
  topK?: number; // Google-specific
  frequencyPenalty?: number; // OpenAI-specific
  presencePenalty?: number; // OpenAI-specific
  stopSequences?: string[];
}

/**
 * Default parameters - safe middle-ground values
 */
const DEFAULT_PARAMETERS: ModelParameters = {
  temperature: 0.7,
  maxTokens: 2048,
  topP: 0.95,
};
```

## Provider Abstraction

### LLMProvider Interface

```typescript
/**
 * Provider-agnostic interface for LLM APIs.
 * All providers must implement this interface.
 */
interface LLMProvider {
  readonly id: string; // e.g., 'google', 'openai'
  readonly name: string; // e.g., 'Google Gemini'

  // Available models
  getModels(): Promise<ModelInfo[]>;

  /**
   * Get detailed information for a specific model.
   */
  getModel(id: string): Promise<ModelInfo>;

  /**
   * Send a chat request and get complete response.
   * Use for non-streaming scenarios.
   */
  chat(request: ChatRequest): Promise<ChatResponse>;

  /**
   * Send a chat request and stream response.
   * Returns async iterator of chunks.
   */
  streamChat(request: ChatRequest): AsyncIterableIterator<StreamChunk>;

  /**
   * Estimate token count for the contents.
   */
  countTokens(contents: string, modelId: string): Promise<number>;

  /**
   * Normalize provider-specific errors to common format.
   */
  normalizeError(error: unknown): NormalizedError;
}
```

### Model Information

```typescript
/**
 * Information about a specific model
 */
interface ModelInfo {
  readonly id: string; // e.g., 'gemini-pro'
  readonly name: string; // Display name
  readonly provider: string; // Provider id
  description?: string; // Brief description

  readonly contextWindow: number;
  readonly maxOutputTokens: number;
  capabilities: ModelCapabilities;
  isRecommended?: boolean; // Show in "popular" list
}

/**
 * Model capabilities - what features it supports
 */
interface ModelCapabilities {
  streaming: boolean;
  functionCalling: boolean;
  systemPrompt: boolean;
  vision: boolean;

  // Parameter ranges
  temperatureRange: [number, number];
  topPRange: [number, number];
  supportsTopK: boolean;
}
```

### Request/Response Types

```typescript
/**
 * Request to send to LLM provider
 */
interface ChatRequest {
  messages: Message[];
  model: string;
  parameters: ModelParameters;
  systemPrompt?: string;
  functions?: FunctionDefinition[];
  stream?: boolean;
}

type FinishReason =
  | "stop"
  | "length"
  | "function_call"
  | "content_filter"
  | "unknown";

/**
 * Complete response from LLM provider
 */
interface ChatResponse {
  message: Message;
  usage: TokenUsage;
  model: string;
  finishReason: FinishReason;
}

/**
 * Single chunk in a streaming response
 */
interface StreamChunk {
  delta: string; // New text content
  finishReason?: FinishReason;
  usage?: TokenUsage; // Only in final chunk
  functionCall?: Partial<FunctionCall>;
}

/**
 * Token usage information
 */
interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}
```

## Error Handling

### Error Types

```typescript
/**
 * Normalized error structure across all providers
 */
interface NormalizedError {
  type: ErrorType;
  message: string; // Technical message (for logs)
  userMessage: string; // User-friendly message (for UI)
  retriable: boolean; // Can user retry?
  statusCode?: number; // HTTP status if applicable
  provider?: string; // Which provider
  originalError: unknown; // Original error object
  retryAfter?: number; // Seconds to wait before retry
}

/**
 * Error classification
 */
type ErrorType =
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
```

## Storage & Persistence

### Storage Service

```typescript
/**
 * Abstraction over IndexedDB storage
 */
interface StorageService {
  // Initialization
  initialize(): Promise<void>;
  isAvailable(): boolean;
  getStorageType(): "indexeddb" | "memory";

  // Conversation operations
  saveConversation(conversation: Conversation): Promise<void>;
  getConversation(id: string): Promise<Conversation | null>;
  getAllConversations(): Promise<ConversationSummary[]>;
  deleteConversation(id: string): Promise<void>;

  // Settings operations
  saveSettings(settings: AppSettings): Promise<void>;
  getSettings(): Promise<AppSettings | null>;

  // Function operations (v1.1+)
  saveFunction(func: FunctionDefinition): Promise<void>;
  getFunction(id: string): Promise<FunctionDefinition | null>;
  getAllFunctions(): Promise<FunctionDefinition[]>;
  deleteFunction(id: string): Promise<void>;

  // Import/Export
  exportData(): Promise<ExportData>;
  importData(data: ExportData): Promise<ImportResult>;

  // Cleanup
  clearAllData(): Promise<void>;
}
```

### App Settings

```typescript
/**
 * Application settings stored in IndexedDB
 */
interface AppSettings {
  readonly id: "app-settings"; // Always this value
  apiKeys: Record<string, string>; // provider -> key
  defaultModel: string;
  defaultParameters: ModelParameters;
  uiPreferences: UIPreferences;
}

/**
 * UI preferences
 */
interface UIPreferences {
  theme: "light" | "dark" | "system";
  fontSize: "small" | "medium" | "large";
  codeTheme: string;
  showTokenCount: boolean;
  showCostEstimate: boolean;
}
```

### Import/Export

```typescript
/**
 * Export data structure
 */
interface ExportData {
  version: string; // Schema version (e.g., '1.0.0')
  exportedAt: number; // Timestamp
  type: "full" | "conversations" | "settings";
  conversations?: Conversation[];
  settings?: AppSettings;
  functions?: FunctionDefinition[];
}

/**
 * Import result
 */
interface ImportResult {
  success: boolean;
  conversationsImported: number;
  settingsImported: boolean;
  functionsImported: number;
  errors: string[];
}
```

## Function Calling (v1.1+)

### Function Definition

```typescript
/**
 * User-defined function that can be called by the model
 */
interface FunctionDefinition {
  readonly id: string;
  name: string; // Function name (for model)
  description: string; // What function does
  parameters: JSONSchema; // Parameter schema
  implementation: string; // JavaScript code
  readonly createdAt: number;
  updatedAt: number;

  // Execution settings
  timeout?: number; // Max execution time (ms)
  allowedAPIs?: string[]; // Whitelist of allowed APIs
}

/**
 * JSON Schema for function parameters
 */
interface JSONSchema {
  type: "object";
  properties: Record<string, JSONSchemaProperty>;
  required?: string[];
  additionalProperties?: boolean;
}

interface JSONSchemaProperty {
  type: "string" | "number" | "boolean" | "array" | "object";
  description?: string;
  enum?: any[];
  items?: JSONSchemaProperty;
  properties?: Record<string, JSONSchemaProperty>;
}
```

### Function Executor

```typescript
/**
 * Service for executing user-defined functions safely
 */
interface FunctionExecutor {
  /**
   * Execute a function in a Web Worker
   */
  execute(
    func: FunctionDefinition,
    args: Record<string, unknown>,
    options?: ExecutionOptions,
  ): Promise<unknown>;

  /**
   * Validate function code (syntax check)
   */
  validate(code: string): ValidationResult;

  /**
   * Terminate any running execution
   */
  terminate(): void;
}

interface ExecutionOptions {
  timeout?: number;
  onProgress?: (progress: ExecutionProgress) => void;
}

interface ExecutionProgress {
  percentage: number;
  message?: string;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
}
```

## State Management (Zustand)

### Conversation Store

```typescript
/**
 * Manages conversations and messages
 */
interface ConversationStore {
  // State
  conversations: ConversationSummary[];
  activeConversationId: string | null;
  activeConversation: Conversation | null;
  isStreaming: boolean;

  // Conversation operations
  createConversation(model: string): Promise<string>;
  loadConversation(id: string): Promise<void>;
  deleteConversation(id: string): Promise<void>;
  renameConversation(id: string, title: string): Promise<void>;

  // Message operations
  sendMessage(content: string): Promise<void>;
  editMessage(messageId: string, newContent: string): Promise<void>;
  retryMessage(messageId: string): Promise<void>;
  deleteMessage(messageId: string): Promise<void>;

  // Configuration
  setModel(modelId: string): void;
  setParameters(params: Partial<ModelParameters>): void;
  setSystemPrompt(prompt: string): void;

  // Streaming
  startStreaming(): void;
  appendStreamChunk(chunk: string): void;
  finishStreaming(usage?: TokenUsage): void;

  // Persistence
  syncToStorage(): Promise<void>;
}
```

### Settings Store

```typescript
/**
 * Manages global application settings
 */
interface SettingsStore {
  // State
  settings: AppSettings;

  // Actions
  setApiKey(provider: string, key: string): Promise<void>;
  removeApiKey(provider: string): Promise<void>;
  setDefaultModel(modelId: string): Promise<void>;
  setDefaultParameters(params: ModelParameters): Promise<void>;
  setUIPreference<K extends keyof UIPreferences>(
    key: K,
    value: UIPreferences[K],
  ): Promise<void>;

  // Persistence
  loadSettings(): Promise<void>;
  saveSettings(): Promise<void>;
}
```

### UI Store

```typescript
/**
 * Manages transient UI state
 */
interface UIStore {
  // State
  isParametersPanelOpen: boolean;
  isConversationListOpen: boolean;
  activeModal: ModalType | null;
  notifications: Notification[];

  // Actions
  toggleParametersPanel(): void;
  toggleConversationList(): void;
  openModal(type: ModalType): void;
  closeModal(): void;
  showNotification(notification: Omit<Notification, "id">): void;
  dismissNotification(id: string): void;
}

type ModalType =
  | "settings"
  | "import-export"
  | "function-editor"
  | "model-info"
  | "confirmation";

interface Notification {
  readonly id: string;
  type: "info" | "success" | "warning" | "error";
  message: string;
  duration?: number; // Auto-dismiss after ms (null = manual)
  action?: NotificationAction;
}

interface NotificationAction {
  label: string;
  onClick: () => void;
}
```

## Custom Hooks

### Chat Hook

```typescript
/**
 * Hook for chat operations in active conversation
 */
interface UseChatResult {
  messages: Message[];
  isStreaming: boolean;
  sendMessage: (content: string) => Promise<void>;
  editMessage: (id: string, content: string) => Promise<void>;
  retryMessage: (id: string) => Promise<void>;
  deleteMessage: (id: string) => Promise<void>;
}
```

### Model Hook

```typescript
/**
 * Hook for model capabilities and validation
 */
interface UseModelResult {
  currentModel: ModelInfo | null;
  capabilities: ModelCapabilities | null;
  canUseParameter: (param: keyof ModelParameters) => boolean;
  validateParameters: (params: ModelParameters) => ValidationResult;
}
```

### Streaming Hook

```typescript
/**
 * Hook for streaming response handling
 */
interface UseStreamingResult {
  isStreaming: boolean;
  streamingMessage: string;
  startStream: () => void;
  appendChunk: (chunk: string) => void;
  finishStream: () => void;
  cancelStream: () => void;
}
```

## Utility Functions

### Token Estimation

```typescript
/**
 * Estimate token count for text (approximation: ~4 chars per token).
 */
function estimateTokens(text: string): number;

/**
 * Estimate total tokens in messages array.
 */
function estimateMessageTokens(messages: Message[]): number;

/**
 * Check if messages fit in context window.
 */
function fitsInContext(messages: Message[], contextWindow: number): boolean;
```

### Error Handling

```typescript
/**
 * Check if error is retriable.
 */
function isRetriable(error: NormalizedError): boolean;

/**
 * Normalize any error to common format.
 */
function normalizeError(error: unknown, provider: string): NormalizedError;
```

## Runtime Validation (Zod)

### Schema Definitions

```typescript
import { z } from "zod";

// Message schema
export const MessageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "model", "system"]),
  content: z.string(),
  timestamp: z.number(),
  metadata: z
    .object({
      model: z.string().optional(),
      tokens: z.number().optional(),
      finishReason: z
        .enum(["stop", "length", "function_call", "content_filter"])
        .optional(),
    })
    .optional(),
  functionCall: z
    .object({
      name: z.string(),
      arguments: z.record(z.unknown()),
    })
    .optional(),
  functionResult: z
    .object({
      name: z.string(),
      result: z.unknown(),
      error: z.string().optional(),
    })
    .optional(),
});

// Conversation schema
export const ConversationSchema = z.object({
  id: z.string(),
  title: z.string(),
  messages: z.array(MessageSchema),
  modelId: z.string(),
  parameters: z.object({
    temperature: z.number().min(0).max(2),
    maxTokens: z.number().int().positive(),
    topP: z.number().min(0).max(1),
    topK: z.number().int().positive().optional(),
    frequencyPenalty: z.number().optional(),
    presencePenalty: z.number().optional(),
    stopSequences: z.array(z.string()).optional(),
  }),
  systemPrompt: z.string().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
  metadata: z
    .object({
      totalTokens: z.number().optional(),
      estimatedCost: z.number().optional(),
    })
    .optional(),
});

// App settings schema
export const AppSettingsSchema = z.object({
  id: z.literal("app-settings"),
  apiKeys: z.record(z.string()),
  defaultModel: z.string(),
  defaultParameters: z.object({
    temperature: z.number().min(0).max(2),
    maxTokens: z.number().int().positive(),
    topP: z.number().min(0).max(1),
    topK: z.number().int().positive().optional(),
    frequencyPenalty: z.number().optional(),
    presencePenalty: z.number().optional(),
    stopSequences: z.array(z.string()).optional(),
  }),
  uiPreferences: z.object({
    theme: z.enum(["light", "dark", "system"]),
    fontSize: z.enum(["small", "medium", "large"]),
    codeTheme: z.string(),
    showTokenCount: z.boolean(),
    showCostEstimate: z.boolean(),
  }),
});

// Function definition schema
export const FunctionDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  parameters: z.object({
    type: z.literal("object"),
    properties: z.record(z.any()), // JSONSchema is complex, z.any() acceptable here
    required: z.array(z.string()).optional(),
    additionalProperties: z.boolean().optional(),
  }),
  implementation: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
  timeout: z.number().optional(),
  allowedAPIs: z.array(z.string()).optional(),
});

// Export data schema
export const ExportDataSchema = z.object({
  version: z.string(),
  exportedAt: z.number(),
  type: z.enum(["full", "conversations", "settings"]),
  conversations: z.array(ConversationSchema).optional(),
  settings: AppSettingsSchema.optional(),
  functions: z.array(FunctionDefinitionSchema).optional(),
});

// Usage
const result = ConversationSchema.safeParse(data);
if (result.success) {
  const conversation = result.data;
} else {
  console.error(result.error);
}
```

## Constants

### Default Values

```typescript
export const DEFAULTS = {
  PARAMETERS: {
    temperature: 0.7,
    maxTokens: 2048,
    topP: 0.95,
  },

  TIMEOUTS: {
    apiRequest: 30000, // 30s
    streamChunk: 5000, // 5s between chunks
    functionExecution: 5000, // 5s
  },

  LIMITS: {
    maxConversations: 1000,
    maxMessagesPerConversation: 10000,
    maxFunctions: 100,
    maxMessageLength: 100000,
  },

  UI: {
    notificationDuration: 5000,
    debounceDelay: 500,
    streamingDebounce: 16, // 60fps
  },
} as const;
```

### Error Messages

```typescript
export const ERROR_MESSAGES = {
  NETWORK: "Could not connect to the API. Check your internet connection.",
  AUTH: "Invalid API key. Please check your settings.",
  RATE_LIMIT: "Rate limit reached. Please wait before trying again.",
  CONTEXT_LENGTH:
    "Message too long. Try a shorter message or start a new conversation.",
  QUOTA: "API quota exceeded. Check your provider dashboard.",
  UNKNOWN: "An unexpected error occurred. Please try again.",
} as const;
```

## Usage Examples

### Creating a Conversation

```typescript
const conversation: Conversation = {
  id: nanoid(),
  title: "New Chat",
  messages: [],
  modelId: "gemini-pro",
  parameters: DEFAULTS.PARAMETERS,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};
```

### Validating API Response

```typescript
const response = await fetch(apiUrl);
const data = await response.json();

const result = MessageSchema.safeParse(data);
if (!result.success) {
  throw new Error(`Invalid response: ${result.error.message}`);
}

const message = result.data;
```

### Normalizing Errors

```typescript
try {
  await apiClient.chat(request);
} catch (error) {
  const normalized = normalizeError(error, "google");

  if (normalized.retriable) {
    // Show retry button
  }

  toast.error(normalized.userMessage);
}
```

## Related Documentation

- **ARCHITECTURE.md** - System design and patterns
- **IMPLEMENTATION_GUIDE.md** - Development roadmap
- **DATABASE.md** - IndexedDB schema details
- **SECURITY.md** - Security considerations

---

**Note**: Use Zod's `.safeParse()` for runtime validation. Don't recreate wrapper functions.
