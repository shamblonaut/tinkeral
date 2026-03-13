import { describe, expect, test } from "vitest";
import { functionTemplates, getTemplates } from "../functionTemplates";

describe("Function Templates", () => {
  test("should return templates with unique IDs", () => {
    const templates = getTemplates();
    expect(templates).toHaveLength(functionTemplates.length);

    // Check they have IDs and timestamps
    for (const template of templates) {
      expect(template.id).toBeDefined();
      expect(template.createdAt).toBeDefined();
      expect(template.updatedAt).toBeDefined();
    }
  });

  describe("Template Logic Execution (mocked)", () => {
    // Helper to evaluate without worker for simple logic
    const evaluateTemplate = async (
      templateName: string,
      args: Record<string, unknown>,
    ) => {
      const template = functionTemplates.find((t) => t.name === templateName)!;
      // We assume returning a promise by wrapping it in an async IIFE
      const AsyncFunction = Object.getPrototypeOf(
        async function () {},
      ).constructor;
      const fn = new AsyncFunction("args", template.implementation);
      return await fn(args);
    };

    test("calculateExpression template logic works", async () => {
      const result = await evaluateTemplate("calculateExpression", {
        expression: "2 + 2",
      });
      expect(result).toEqual({ expression: "2 + 2", result: 4, success: true });

      const errorResult = await evaluateTemplate("calculateExpression", {
        expression: "invalid + expression",
      });
      expect(errorResult.success).toBe(false);
      expect(errorResult.error).toBeDefined();
    });

    test("formatDate template logic works", async () => {
      const dateStr = "2024-01-01T12:00:00Z";
      const result = await evaluateTemplate("formatDate", {
        date: dateStr,
        format: "short",
      });
      expect(result).toEqual({ result: "2024-01-01" });

      const longResult = await evaluateTemplate("formatDate", {
        date: dateStr,
        format: "long",
      });
      expect(longResult.result).toContain("January");
      expect(longResult.result).toContain("1");
      expect(longResult.result).toContain("2024");
    });

    test("searchDatabase template logic works", async () => {
      const result = await evaluateTemplate("searchDatabase", {
        query: "Admin",
      });
      expect(result.count).toBe(2);
      expect(result.results.length).toBe(2);
      expect(result.query).toBe("Admin");
    });
  });
});
