import type { ProviderError } from "@/services/api/base";
import { GoogleAPIClient } from "@/services/api/google";
import { FunctionExecutor } from "@/services/executor";
import { RateLimiter } from "@/services/rateLimiter";
import type {
  FinishReason,
  FunctionCall,
  FunctionCallingMode,
  FunctionDefinition,
  FunctionResult,
  Message,
  ModelParameters,
  ChatRequest as ProviderChatRequest,
  TokenUsage,
} from "@/types";

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
    const rateLimiter = new RateLimiter();
    const maxFunctionCallIterations = 10;

    const attempt = async (): Promise<void> => {
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

        await onFinish(fullContent, lastMetadata);
      } catch (error) {
        if (
          abortSignal?.aborted ||
          (error instanceof DOMException && error.name === "AbortError")
        ) {
          onError(error as ProviderError | string, fullContent);
          return;
        }

        const delay = rateLimiter.getRetryDelay(error);
        if (delay !== null) {
          await new Promise((resolve) => setTimeout(resolve, delay));
          return attempt();
        }

        onError(error as ProviderError | string, fullContent);
      } finally {
        executor.terminate();
      }
    };

    return attempt();
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
        name: functionCall.name,
        result: null,
        error: `Function not found: ${functionCall.name}`,
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
        name: functionCall.name,
        result: null,
        error: execution.error?.message || "Function execution failed",
        executionTime: execution.executionTime,
      };
    }

    return {
      name: functionCall.name,
      result: execution.data || null,
      executionTime: execution.executionTime,
    };
  }

  private static serializeFunctionResult(
    functionResult: FunctionResult,
  ): string {
    return JSON.stringify(
      {
        name: functionResult.name,
        output: functionResult.result,
        error: functionResult.error,
      },
      null,
      2,
    );
  }
}
