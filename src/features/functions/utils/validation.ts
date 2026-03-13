import type { JSONSchema } from "@/types";

const NAME_REGEX = /^[a-zA-Z0-9_.-]{1,64}$/;

export function validateName(name: string): string | undefined {
  if (!name.trim()) return "Function name is required.";
  if (name.length > 64) return "Name must be 64 characters or less.";
  if (!NAME_REGEX.test(name))
    return "Only letters, digits, underscores, dots, and hyphens allowed.";
}

export function validateParameters(schema: JSONSchema): string | undefined {
  if (schema.type !== "object") return "Root schema must be an object.";

  const hasEmptyProperty = Object.entries(schema.properties).some(
    ([key]) => !key.trim(),
  );

  if (hasEmptyProperty) {
    return "All properties must have a valid name.";
  }
}

export function validateTimeout(value: number): string | undefined {
  if (isNaN(value)) return "Timeout must be a valid number.";
  if (value < 100) return "Minimum timeout is 100ms.";
  if (value > 60000) return "Maximum timeout is 60000ms (60 seconds).";
}

import { FunctionExecutor } from "@/services/executor";

export function validateImplementation(code: string): string | undefined {
  if (!code.trim()) return "Implementation is required.";
  const executor = new FunctionExecutor();
  const result = executor.validate(code);
  if (!result.valid) return `Syntax error: ${result.error}`;
  return undefined;
}
