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
} from "@/types";

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

export function mapJSONSchemaToGoogleSchema(schema: JSONSchema): Schema {
    return {
        type: Type.OBJECT,
        properties: Object.fromEntries(
            Object.entries(schema.properties).map(([key, value]) => [
                key,
                mapJSONSchemaPropertyToGoogleSchema(value),
            ]),
        ),
        required: schema.required,
    };
}

export function mapFunctionDefinitionToGoogleDeclaration(
    functionDefinition: FunctionDefinition,
): FunctionDeclaration {
    return {
        name: functionDefinition.name,
        description: functionDefinition.description,
        parameters: mapJSONSchemaToGoogleSchema(functionDefinition.parameters),
    };
}

export function mapFunctionResultToGoogleResponse(
    functionResult: FunctionResult,
): FunctionResponse {
    const mappedResponse = new FunctionResponse();

    mappedResponse.name = functionResult.name;
    mappedResponse.response = functionResult.error
        ? {
            error: functionResult.error,
        }
        : {
            output: functionResult.result,
        };

    return mappedResponse;
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
