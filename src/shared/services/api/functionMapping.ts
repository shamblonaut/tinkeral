import {
  FunctionCallingConfigMode,
  type FunctionDeclaration,
  FunctionResponse,
  type Schema,
  type Tool,
  type ToolConfig,
  Type,
} from "@google/genai";

import type { FunctionDefinition } from "@/db";
import type {
  FunctionCallingMode,
  FunctionResult,
  JSONSchema,
  JSONSchemaProperty,
} from "@/shared/types";

const JSON_SCHEMA_TYPE_TO_GOOGLE_TYPE: Record<string, Type> = {
  string: Type.STRING,
  number: Type.NUMBER,
  integer: Type.INTEGER,
  boolean: Type.BOOLEAN,
  array: Type.ARRAY,
  object: Type.OBJECT,
};

const FUNCTION_CALLING_MODE_TO_GOOGLE_MODE: Record<
  FunctionCallingMode,
  FunctionCallingConfigMode
> = {
  AUTO: FunctionCallingConfigMode.AUTO,
  ANY: FunctionCallingConfigMode.ANY,
  NONE: FunctionCallingConfigMode.NONE,
};

export function mapJSONSchemaPropertyToGoogleSchema(
  property: JSONSchemaProperty,
): Schema {
  const mappedSchema: Schema = {
    type: JSON_SCHEMA_TYPE_TO_GOOGLE_TYPE[property.type],
    description: property.description,
    enum: Array.isArray(property.enum)
      ? property.enum.map((value) => String(value))
      : undefined,
  };

  if (property.items) {
    mappedSchema.items = mapJSONSchemaPropertyToGoogleSchema(property.items);
  }

  if (property.properties) {
    mappedSchema.properties = Object.fromEntries(
      Object.entries(property.properties).map(([key, value]) => [
        key,
        mapJSONSchemaPropertyToGoogleSchema(value),
      ]),
    );
  }

  if (property.required?.length) {
    mappedSchema.required = property.required;
  }

  return mappedSchema;
}

export function mapJSONSchemaToGoogleSchema(
  schema: JSONSchema,
): Schema | undefined {
  const properties = schema.properties || {};
  const hasProperties = Object.keys(properties).length > 0;
  const hasRequired = !!schema.required?.length;

  if (!hasProperties && !hasRequired) {
    return undefined;
  }

  const result: Schema = {
    type: Type.OBJECT,
  };

  if (hasProperties) {
    result.properties = Object.fromEntries(
      Object.entries(properties).map(([key, value]) => [
        key,
        mapJSONSchemaPropertyToGoogleSchema(value),
      ]),
    );
  }

  if (hasRequired) {
    result.required = schema.required;
  }

  return result;
}

export function mapFunctionDefinitionToGoogleDeclaration(
  functionDefinition: FunctionDefinition,
): FunctionDeclaration {
  const result: FunctionDeclaration = {
    name: functionDefinition.name,
    description: functionDefinition.description,
  };

  const parameters = mapJSONSchemaToGoogleSchema(functionDefinition.parameters);
  if (parameters) {
    result.parameters = parameters;
  }

  return result;
}

export function mapFunctionResultToGoogleResponse(
  functionResult: FunctionResult,
): FunctionResponse {
  // Always wrap in an object (Struct) to satisfy API requirements
  const response: Record<string, unknown> = functionResult.error
    ? { error: functionResult.error }
    : { output: functionResult.result };

  return {
    id: functionResult.id,
    name: functionResult.name,
    response,
  } as FunctionResponse;
}

export function mapFunctionsToGoogleTools(
  functionDefinitions: FunctionDefinition[],
): Tool[] {
  return [
    {
      functionDeclarations: functionDefinitions.map(
        mapFunctionDefinitionToGoogleDeclaration,
      ),
    },
  ];
}

export function mapFunctionCallingModeToGoogleToolConfig(
  functionCallingMode: FunctionCallingMode = "AUTO",
): ToolConfig {
  return {
    functionCallingConfig: {
      mode: FUNCTION_CALLING_MODE_TO_GOOGLE_MODE[functionCallingMode],
    },
  };
}
