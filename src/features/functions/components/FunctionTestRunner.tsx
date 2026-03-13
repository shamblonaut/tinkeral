import { Play } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  Button,
  Checkbox,
  Input,
  Label,
  ScrollArea,
  Textarea,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import { FunctionExecutor, type ExecutionResult } from "@/services/executor";
import type {
  FunctionDefinition,
  JSONSchema,
  JSONSchemaProperty,
} from "@/types";

interface FunctionTestRunnerProps {
  name: string;
  schema: JSONSchema;
  implementation: string;
  timeout: number;
  allowedAPIs?: string[];
  disabled?: boolean;
}

type InputValue = string | boolean;

function getDefaultValueForType(property: JSONSchemaProperty): InputValue {
  if (property.type === "boolean") {
    return false;
  }
  return "";
}

function createInitialInputs(schema: JSONSchema): Record<string, InputValue> {
  return Object.entries(schema.properties).reduce<Record<string, InputValue>>(
    (accumulator, [key, property]) => {
      accumulator[key] = getDefaultValueForType(property);
      return accumulator;
    },
    {},
  );
}

function stringifyPretty(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function parsePropertyValue(
  rawValue: InputValue,
  property: JSONSchemaProperty,
  required: boolean,
): { hasValue: boolean; value?: unknown; error?: string } {
  if (property.type === "boolean") {
    return { hasValue: true, value: rawValue === true };
  }

  const textValue =
    typeof rawValue === "string" ? rawValue.trim() : String(rawValue);

  if (!textValue) {
    if (required) {
      return { hasValue: false, error: "This field is required." };
    }
    return { hasValue: false };
  }

  if (property.type === "string") {
    return { hasValue: true, value: textValue };
  }

  if (property.type === "number" || property.type === "integer") {
    const parsed = Number(textValue);
    if (Number.isNaN(parsed) || !Number.isFinite(parsed)) {
      return {
        hasValue: false,
        error: `Expected a valid ${property.type}.`,
      };
    }
    if (property.type === "integer" && !Number.isInteger(parsed)) {
      return { hasValue: false, error: "Expected an integer." };
    }
    return { hasValue: true, value: parsed };
  }

  if (property.type === "array" || property.type === "object") {
    try {
      const parsed = JSON.parse(textValue);
      if (property.type === "array" && !Array.isArray(parsed)) {
        return { hasValue: false, error: "Expected a JSON array." };
      }
      if (
        property.type === "object" &&
        (parsed === null || Array.isArray(parsed) || typeof parsed !== "object")
      ) {
        return { hasValue: false, error: "Expected a JSON object." };
      }
      return { hasValue: true, value: parsed };
    } catch {
      return {
        hasValue: false,
        error: `Invalid JSON ${property.type}.`,
      };
    }
  }

  return { hasValue: true, value: textValue };
}

export function FunctionTestRunner({
  name,
  schema,
  implementation,
  timeout,
  allowedAPIs,
  disabled = false,
}: FunctionTestRunnerProps) {
  const executor = useMemo(() => new FunctionExecutor(), []);
  const [inputs, setInputs] = useState<Record<string, InputValue>>(() =>
    createInitialInputs(schema),
  );
  const [inputErrors, setInputErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    setInputs((prev) => {
      const next: Record<string, InputValue> = {};
      for (const [key, property] of Object.entries(schema.properties)) {
        next[key] = prev[key] ?? getDefaultValueForType(property);
      }
      return next;
    });
    setInputErrors({});
  }, [schema]);

  useEffect(() => {
    return () => {
      executor.terminate();
    };
  }, [executor]);

  const hasParameters = Object.keys(schema.properties).length > 0;

  const runTest = async () => {
    const syntax = executor.validate(implementation);
    if (!syntax.valid) {
      setResult({
        success: false,
        error: {
          name: "SyntaxError",
          message: syntax.error ?? "Implementation contains syntax errors.",
        },
        executionTime: 0,
        consoleLogs: [],
      });
      return;
    }

    const required = new Set(schema.required ?? []);
    const nextArgs: Record<string, unknown> = {};
    const nextErrors: Record<string, string> = {};

    for (const [key, property] of Object.entries(schema.properties)) {
      const parsed = parsePropertyValue(
        inputs[key],
        property,
        required.has(key),
      );
      if (parsed.error) {
        nextErrors[key] = parsed.error;
      } else if (parsed.hasValue) {
        nextArgs[key] = parsed.value;
      }
    }

    setInputErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setResult(null);
      return;
    }

    const testFunction: FunctionDefinition = {
      id: "__test__",
      name: name.trim() || "test_function",
      description: "Function test runner execution",
      parameters: schema,
      implementation,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      timeout,
      allowedAPIs,
    };

    setIsRunning(true);
    try {
      const execution = await executor.execute(testFunction, nextArgs);
      setResult(execution);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="space-y-3 border-b p-4">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-xs font-semibold">Test Runner</h4>
          <Button
            size="sm"
            onClick={() => void runTest()}
            disabled={disabled || isRunning}
            className="gap-1.5"
          >
            <Play className="h-3.5 w-3.5" />
            {isRunning ? "Running…" : "Run"}
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">
          Provide test inputs, run in the sandbox worker, and inspect result +
          logs.
        </p>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-4 p-4">
          <div className="space-y-3">
            <h5 className="text-xs font-semibold">Inputs</h5>

            {!hasParameters && (
              <p className="text-muted-foreground rounded-md border px-3 py-2 text-xs">
                This function has no parameters.
              </p>
            )}

            {Object.entries(schema.properties).map(([key, property]) => {
              const value = inputs[key] ?? getDefaultValueForType(property);
              const required = (schema.required ?? []).includes(key);
              const label = `${key}${required ? " *" : ""}`;

              return (
                <div key={key} className="space-y-1.5">
                  <Label className="text-xs">
                    {label}
                    <span className="text-muted-foreground ml-1 font-normal">
                      ({property.type})
                    </span>
                  </Label>

                  {property.type === "boolean" ? (
                    <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                      <Checkbox
                        checked={value === true}
                        onCheckedChange={(checked) => {
                          setInputs((prev) => ({
                            ...prev,
                            [key]: checked === true,
                          }));
                          setInputErrors((prev) => ({ ...prev, [key]: "" }));
                        }}
                        disabled={disabled || isRunning}
                      />
                      <span className="text-sm">
                        {value === true ? "true" : "false"}
                      </span>
                    </div>
                  ) : property.type === "array" ||
                    property.type === "object" ? (
                    <Textarea
                      value={String(value)}
                      onChange={(event) => {
                        setInputs((prev) => ({
                          ...prev,
                          [key]: event.target.value,
                        }));
                        setInputErrors((prev) => ({ ...prev, [key]: "" }));
                      }}
                      disabled={disabled || isRunning}
                      placeholder={
                        property.type === "array"
                          ? '["item-1", "item-2"]'
                          : '{"key": "value"}'
                      }
                      className="min-h-24 font-mono text-xs"
                    />
                  ) : (
                    <Input
                      value={String(value)}
                      type={
                        property.type === "number" ||
                        property.type === "integer"
                          ? "number"
                          : "text"
                      }
                      step={property.type === "integer" ? 1 : "any"}
                      onChange={(event) => {
                        setInputs((prev) => ({
                          ...prev,
                          [key]: event.target.value,
                        }));
                        setInputErrors((prev) => ({ ...prev, [key]: "" }));
                      }}
                      disabled={disabled || isRunning}
                      placeholder={
                        property.type === "number" ||
                        property.type === "integer"
                          ? "0"
                          : "Enter value"
                      }
                    />
                  )}

                  {inputErrors[key] && (
                    <p className="text-destructive text-xs">
                      {inputErrors[key]}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {result && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h5 className="text-xs font-semibold">Output</h5>
                <span className="text-muted-foreground text-xs">
                  {result.executionTime.toFixed(1)}ms
                </span>
              </div>

              <div
                className={cn(
                  "rounded-md border p-3",
                  result.success
                    ? "border-emerald-500/40 bg-emerald-500/5"
                    : "border-destructive/40 bg-destructive/5",
                )}
              >
                <p
                  className={cn(
                    "mb-2 text-xs font-medium",
                    result.success ? "text-emerald-600" : "text-destructive",
                  )}
                >
                  {result.success
                    ? "Success"
                    : `${result.error?.name ?? "Error"}`}
                </p>
                <pre className="bg-muted/40 overflow-x-auto rounded border p-2 font-mono text-xs whitespace-pre-wrap">
                  {result.success
                    ? stringifyPretty(result.data)
                    : stringifyPretty({
                        message: result.error?.message,
                        stack: result.error?.stack,
                      })}
                </pre>
              </div>

              <div className="space-y-2">
                <h5 className="text-xs font-semibold">Console Output</h5>
                {result.consoleLogs.length === 0 ? (
                  <p className="text-muted-foreground rounded-md border px-3 py-2 text-xs">
                    No console output.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {result.consoleLogs.map((entry, index) => (
                      <div
                        key={`${entry.timestamp}-${index}`}
                        className="rounded-md border p-2"
                      >
                        <p className="text-muted-foreground mb-1 text-[11px] uppercase">
                          {entry.level}
                        </p>
                        <pre className="overflow-x-auto font-mono text-xs whitespace-pre-wrap">
                          {stringifyPretty(entry.args)}
                        </pre>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
