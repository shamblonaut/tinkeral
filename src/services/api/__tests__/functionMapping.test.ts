import { FunctionCallingConfigMode, Type } from "@google/genai";
import { describe, expect, it } from "vitest";

import type { FunctionDefinition, FunctionResult } from "@/types";
import {
  mapFunctionCallingModeToGoogleToolConfig,
  mapFunctionDefinitionToGoogleDeclaration,
  mapFunctionResultToGoogleResponse,
  mapFunctionsToGoogleTools,
  mapJSONSchemaToGoogleSchema,
} from "../functionMapping";

describe("functionMapping", () => {
  const now = Date.now();

  const sampleFunction: FunctionDefinition = {
    id: "fn-1",
    name: "get_weather",
    description: "Get weather by city",
    parameters: {
      type: "object",
      properties: {
        city: {
          type: "string",
          description: "City name",
        },
        units: {
          type: "string",
          enum: ["metric", "imperial"],
        },
        days: {
          type: "array",
          items: {
            type: "integer",
          },
        },
        filters: {
          type: "object",
          properties: {
            includeWind: {
              type: "boolean",
            },
          },
          required: ["includeWind"],
        },
      },
      required: ["city"],
      additionalProperties: false,
    },
    implementation: "return { city: args.city };",
    createdAt: now,
    updatedAt: now,
  };

  it("maps JSON schema to Google schema types", () => {
    const schema = mapJSONSchemaToGoogleSchema(sampleFunction.parameters);

    expect(schema.type).toBe(Type.OBJECT);
    expect(schema.required).toEqual(["city"]);
    expect(schema.properties?.city).toEqual(
      expect.objectContaining({
        type: Type.STRING,
        description: "City name",
      }),
    );
    expect(schema.properties?.units?.enum).toEqual(["metric", "imperial"]);
    expect(schema.properties?.days?.type).toBe(Type.ARRAY);
    expect(schema.properties?.days?.items?.type).toBe(Type.INTEGER);
    expect(schema.properties?.filters?.type).toBe(Type.OBJECT);
    expect(schema.properties?.filters?.required).toEqual(["includeWind"]);
  });

  it("maps FunctionDefinition to Google FunctionDeclaration", () => {
    const declaration =
      mapFunctionDefinitionToGoogleDeclaration(sampleFunction);

    expect(declaration.name).toBe("get_weather");
    expect(declaration.description).toBe("Get weather by city");
    expect(declaration.parameters?.type).toBe(Type.OBJECT);
    expect(declaration.parameters?.properties?.city?.type).toBe(Type.STRING);
  });

  it("maps FunctionResult to Google FunctionResponse", () => {
    const successResult: FunctionResult = {
      name: "get_weather",
      result: { temp: 21 },
    };

    const errorResult: FunctionResult = {
      name: "get_weather",
      result: null,
      error: "Weather API unavailable",
    };

    const mappedSuccess = mapFunctionResultToGoogleResponse(successResult);
    const mappedError = mapFunctionResultToGoogleResponse(errorResult);

    expect(mappedSuccess.name).toBe("get_weather");
    expect(mappedSuccess.response).toEqual({ output: { temp: 21 } });
    expect(mappedError.response).toEqual({ error: "Weather API unavailable" });
  });

  it("maps function list to Google tools", () => {
    const tools = mapFunctionsToGoogleTools([sampleFunction]);

    expect(tools).toHaveLength(1);
    expect(tools[0].functionDeclarations).toHaveLength(1);
    expect(tools[0].functionDeclarations?.[0]?.name).toBe("get_weather");
  });

  it("maps function calling mode to tool config", () => {
    expect(
      mapFunctionCallingModeToGoogleToolConfig().functionCallingConfig?.mode,
    ).toBe(FunctionCallingConfigMode.AUTO);
    expect(
      mapFunctionCallingModeToGoogleToolConfig("ANY").functionCallingConfig
        ?.mode,
    ).toBe(FunctionCallingConfigMode.ANY);
    expect(
      mapFunctionCallingModeToGoogleToolConfig("NONE").functionCallingConfig
        ?.mode,
    ).toBe(FunctionCallingConfigMode.NONE);
  });
});
