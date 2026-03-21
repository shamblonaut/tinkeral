import {
  type FunctionDefinition,
  FunctionExecutor,
} from "@/features/functions";
import { GoogleAPIClient, ProviderError } from "@/shared/services/api";
import type {
  FinishReason,
  FunctionCall,
  FunctionCallingMode,
  FunctionResult,
  JSONSchema,
  JSONSchemaProperty,
  Message,
  ModelParameters,
  ChatRequest as ProviderChatRequest,
  TokenUsage,
} from "@/shared/types";

const MAX_FUNCTION_RESULT_BYTES = 100 * 1024;
const FUNCTION_RESULT_PREVIEW_BYTES = 16 * 1024;

/**
 * Service-level chat request.
 *
 * Extends the provider `ChatRequest` semantics but adds `apiKey`
 * (needed to construct the client) and uses `modelId` for clarity.
 */
export interface ChatServiceRequest {
  messages: Message[];
  modelId: string;
  parameters: ModelParameters;
  systemPrompt?: string;
  apiKey: string;
  functions?: FunctionDefinition[];
  functionCallingMode?: FunctionCallingMode;
}

export interface ChatCallbacks {
  onChunk: (content: string) => void;
  onFinish: (finalContent: string, metadata: ChatMetadata) => void;
  onError: (error: string | ProviderError, partialContent?: string) => void;
  onFunctionCall?: (functionCall: FunctionCall) => void | Promise<void>;
  onFunctionResult?: (functionResult: FunctionResult) => void | Promise<void>;
}

export interface ChatMetadata {
  finishReason?: FinishReason;
  usage?: TokenUsage;
}

export class ChatService {
  static async executeChat(
    request: ChatServiceRequest,
    callbacks: ChatCallbacks,
    abortSignal?: AbortSignal,
  ): Promise<void> {
    const {
      messages,
      modelId,
      parameters,
      systemPrompt,
      apiKey,
      functions,
      functionCallingMode,
    } = request;
    const { onChunk, onFinish, onError, onFunctionCall, onFunctionResult } =
      callbacks;
    const maxFunctionCallIterations = 10;

    let fullContent = "";
    const workingMessages = [...messages];
    const executor = new FunctionExecutor();

    try {
      if (!apiKey) {
        throw new Error("API key not found for Google provider");
      }

      const client = await GoogleAPIClient.createClient(apiKey);
      let loopCount = 0;
      let shouldContinueFunctionLoop = true;
      const lastMetadata: ChatMetadata = {};

      while (shouldContinueFunctionLoop) {
        loopCount += 1;
        if (loopCount > maxFunctionCallIterations) {
          throw new Error(
            `Exceeded maximum function-call iterations (${maxFunctionCallIterations})`,
          );
        }

        const providerRequest: ProviderChatRequest = {
          messages: workingMessages,
          model: modelId,
          parameters,
          systemPrompt,
          ...(functions?.length ? { functions, functionCallingMode } : {}),
        };

        const stream = client.streamChat(providerRequest, abortSignal);
        let turnContent = "";
        fullContent = ""; // Reset fullContent for each turn
        let turnFunctionCall: FunctionCall | undefined;
        let lastUpdate = Date.now();

        for await (const chunk of stream) {
          if (abortSignal?.aborted) {
            throw new DOMException("Aborted", "AbortError");
          }

          turnContent += chunk.delta;
          fullContent = turnContent;

          if (chunk.functionCall?.name) {
            const isNewFunctionCall = !turnFunctionCall;
            turnFunctionCall = {
              id: chunk.functionCall.id,
              name: chunk.functionCall.name,
              arguments: chunk.functionCall.arguments || {},
            };

            if (isNewFunctionCall) {
              onFunctionCall?.(turnFunctionCall);
            }
          }

          if (chunk.finishReason) {
            lastMetadata.finishReason = chunk.finishReason as FinishReason;
          }

          if (chunk.usage) {
            const lastUsage = lastMetadata.usage || {};
            lastMetadata.usage = {
              inputTokens:
                Math.max(
                  chunk.usage.inputTokens || 0,
                  lastUsage.inputTokens || 0,
                ) || undefined,
              outputTokens:
                Math.max(
                  chunk.usage.outputTokens || 0,
                  lastUsage.outputTokens || 0,
                ) || undefined,
              totalTokens:
                Math.max(
                  chunk.usage.totalTokens || 0,
                  lastUsage.totalTokens || 0,
                ) || undefined,
              thinkingTokens:
                Math.max(
                  chunk.usage.thinkingTokens || 0,
                  lastUsage.thinkingTokens || 0,
                ) || undefined,
              cachedTokens:
                Math.max(
                  chunk.usage.cachedTokens || 0,
                  lastUsage.cachedTokens || 0,
                ) || undefined,
            };
          }

          const now = Date.now();
          if (process.env.NODE_ENV === "test" || now - lastUpdate >= 16) {
            onChunk(turnContent);
            lastUpdate = now;
          }
        }

        fullContent = turnContent;

        if (
          turnFunctionCall &&
          (lastMetadata.finishReason === "function_call" ||
            lastMetadata.finishReason === "stop")
        ) {
          await onFunctionCall?.(turnFunctionCall);

          const functionResult = await this.executeFunctionCall(
            turnFunctionCall,
            functions,
            executor,
            abortSignal,
          );
          await onFunctionResult?.(functionResult);

          workingMessages.push(
            {
              id: crypto.randomUUID(),
              role: "model",
              content: turnContent,
              timestamp: Date.now(),
              functionCall: turnFunctionCall,
              metadata: {
                model: modelId,
                finishReason: "function_call",
              },
            },
            {
              id: crypto.randomUUID(),
              role: "user",
              content: this.serializeFunctionResult(functionResult),
              timestamp: Date.now(),
              functionResult,
            },
          );

          continue;
        }

        shouldContinueFunctionLoop = false;
      }

      if (!fullContent && workingMessages.length > messages.length) {
        throw new ProviderError({
          type: "unknown",
          provider: "google",
          message:
            "Model failed to provide a final response after function calls.",
          retriable: false,
        });
      }

      await onFinish(fullContent, lastMetadata);
    } catch (error) {
      if (
        abortSignal?.aborted ||
        (error instanceof DOMException && error.name === "AbortError")
      ) {
        onError(error as ProviderError | string, fullContent);
        return;
      }

      onError(error as ProviderError | string, fullContent);
    } finally {
      executor.terminate();
    }
  }

  private static async executeFunctionCall(
    functionCall: FunctionCall,
    functions: FunctionDefinition[] | undefined,
    executor: FunctionExecutor,
    abortSignal?: AbortSignal,
  ): Promise<FunctionResult> {
    const functionDefinition = functions?.find(
      (func) => func.name === functionCall.name,
    );

    if (!functionDefinition) {
      return {
        id: functionCall.id,
        name: functionCall.name,
        result: null,
        error: `Function not found: ${functionCall.name}`,
      };
    }

    const argsValidationError = this.validateFunctionCallArguments(
      functionDefinition.parameters,
      functionCall.arguments,
    );
    if (argsValidationError) {
      return {
        id: functionCall.id,
        name: functionCall.name,
        result: null,
        error: argsValidationError,
      };
    }

    if (abortSignal?.aborted) {
      executor.terminate();
      throw new DOMException("Aborted", "AbortError");
    }

    const executionPromise = executor.execute(
      functionDefinition,
      functionCall.arguments,
    );

    let execution: Awaited<typeof executionPromise>;
    if (!abortSignal) {
      execution = await executionPromise;
    } else {
      execution = await new Promise<Awaited<typeof executionPromise>>(
        (resolve, reject) => {
          const handleAbort = () => {
            executor.terminate();
            reject(new DOMException("Aborted", "AbortError"));
          };

          abortSignal.addEventListener("abort", handleAbort, { once: true });

          executionPromise
            .then(resolve)
            .catch(reject)
            .finally(() => {
              abortSignal.removeEventListener("abort", handleAbort);
            });
        },
      );
    }

    if (!execution.success) {
      return {
        id: functionCall.id,
        name: functionCall.name,
        result: null,
        error: this.truncateErrorMessage(
          execution.error?.message || "Function execution failed",
        ),
        executionTime: execution.executionTime,
      };
    }

    const normalizedResult = this.normalizeFunctionResultData(execution.data);

    return {
      id: functionCall.id,
      name: functionCall.name,
      result: normalizedResult,
      executionTime: execution.executionTime,
    };
  }

  private static validateFunctionCallArguments(
    schema: JSONSchema,
    rawArgs: unknown,
  ): string | null {
    if (!rawArgs || typeof rawArgs !== "object" || Array.isArray(rawArgs)) {
      return "Invalid function arguments: expected an object.";
    }

    const args = rawArgs as Record<string, unknown>;
    const required = schema.required || [];
    for (const key of required) {
      if (!(key in args) || args[key] === undefined) {
        return `Invalid function arguments: missing required parameter "${key}".`;
      }
    }

    if (schema.additionalProperties === false) {
      for (const key of Object.keys(args)) {
        if (!(key in schema.properties)) {
          return `Invalid function arguments: unexpected parameter "${key}".`;
        }
      }
    }

    for (const [key, value] of Object.entries(args)) {
      const property = schema.properties[key];
      if (!property) continue;

      const mismatch = this.validateSchemaProperty(property, value, key);
      if (mismatch) {
        return `Invalid function arguments: ${mismatch}`;
      }
    }

    return null;
  }

  private static validateSchemaProperty(
    property: JSONSchemaProperty,
    value: unknown,
    path: string,
  ): string | null {
    if (value === undefined) return null;

    switch (property.type) {
      case "string":
        return typeof value === "string"
          ? null
          : `parameter "${path}" must be a string.`;
      case "number":
        return typeof value === "number" && Number.isFinite(value)
          ? null
          : `parameter "${path}" must be a number.`;
      case "integer":
        return typeof value === "number" && Number.isInteger(value)
          ? null
          : `parameter "${path}" must be an integer.`;
      case "boolean":
        return typeof value === "boolean"
          ? null
          : `parameter "${path}" must be a boolean.`;
      case "array": {
        if (!Array.isArray(value)) {
          return `parameter "${path}" must be an array.`;
        }

        if (!property.items) return null;
        for (let index = 0; index < value.length; index += 1) {
          const itemMismatch = this.validateSchemaProperty(
            property.items,
            value[index],
            `${path}[${index}]`,
          );
          if (itemMismatch) {
            return itemMismatch;
          }
        }
        return null;
      }
      case "object": {
        if (!value || typeof value !== "object" || Array.isArray(value)) {
          return `parameter "${path}" must be an object.`;
        }

        const nestedObject = value as Record<string, unknown>;
        const nestedRequired = property.required || [];
        for (const requiredKey of nestedRequired) {
          if (
            !(requiredKey in nestedObject) ||
            nestedObject[requiredKey] === undefined
          ) {
            return `parameter "${path}.${requiredKey}" is required.`;
          }
        }

        if (!property.properties) return null;
        for (const [nestedKey, nestedValue] of Object.entries(nestedObject)) {
          const nestedSchema = property.properties[nestedKey];
          if (!nestedSchema) continue;

          const nestedMismatch = this.validateSchemaProperty(
            nestedSchema,
            nestedValue,
            `${path}.${nestedKey}`,
          );
          if (nestedMismatch) {
            return nestedMismatch;
          }
        }

        return null;
      }
      default:
        return null;
    }
  }

  private static normalizeFunctionResultData(data: unknown): unknown {
    if (data === undefined) {
      return null;
    }

    const serialized = this.safeStringify(data);
    if (!serialized) {
      return data;
    }

    const sizeBytes = this.getByteLength(serialized);
    if (sizeBytes <= MAX_FUNCTION_RESULT_BYTES) {
      return data;
    }

    const preview = serialized.slice(0, FUNCTION_RESULT_PREVIEW_BYTES);
    return {
      truncated: true,
      reason: "Function result exceeded maximum size and was truncated",
      originalSizeBytes: sizeBytes,
      preview,
    };
  }

  private static truncateErrorMessage(error: string): string {
    const maxErrorLength = 2048;
    if (error.length <= maxErrorLength) {
      return error;
    }

    return `${error.slice(0, maxErrorLength)}… (truncated)`;
  }

  private static safeStringify(value: unknown): string | null {
    try {
      return JSON.stringify(value);
    } catch {
      return null;
    }
  }

  private static getByteLength(value: string): number {
    return new TextEncoder().encode(value).length;
  }

  private static serializeFunctionResult(
    functionResult: FunctionResult,
  ): string {
    return JSON.stringify(
      {
        name: functionResult.name,
        result: functionResult.result,
        error: functionResult.error,
      },
      null,
      2,
    );
  }
}
