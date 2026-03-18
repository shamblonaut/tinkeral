import "fake-indexeddb/auto";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { conversations, db, functions, settings, type AppSettings } from "..";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

describe("Database Operations", () => {
  beforeEach(async () => {
    await db.conversations.clear();
    await db.settings.clear();
    await db.functions.clear();
  });

  describe("Conversations", () => {
    it("should create and retrieve a conversation", async () => {
      const now = Date.now();
      const id = await conversations.create({
        title: "Test Conversation",
        modelId: "gemini-pro",
        createdAt: now,
        updatedAt: now,
        messages: [],
        parameters: {
          temperature: 0.7,
          maxTokens: 2048,
          topP: 0.95,
        },
      });

      const conversation = await conversations.get(id);
      expect(conversation).toBeDefined();
      expect(conversation?.title).toBe("Test Conversation");
      expect(typeof conversation?.id).toBe("string");
    });

    it("should update a conversation", async () => {
      const now = Date.now();
      const id = await conversations.create({
        title: "Old Title",
        modelId: "gemini-pro",
        createdAt: now,
        updatedAt: now,
        messages: [],
        parameters: {
          temperature: 0.7,
          maxTokens: 2048,
          topP: 0.95,
        },
      });

      await conversations.update(id, { title: "New Title" });
      const conversation = await conversations.get(id);
      expect(conversation?.title).toBe("New Title");
      expect(conversation?.updatedAt).toBeGreaterThanOrEqual(now);
    });

    it("should delete a conversation", async () => {
      const id = await conversations.create({
        title: "Delete Me",
        modelId: "gemini-pro",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messages: [],
        parameters: {
          temperature: 0.7,
          maxTokens: 2048,
          topP: 0.95,
        },
      });

      await conversations.delete(id);
      const conversation = await conversations.get(id);
      expect(conversation).toBeUndefined();
    });
  });

  describe("Settings", () => {
    it("should save and get app settings", async () => {
      const sampleSettings: AppSettings = {
        id: "app-settings",
        apiKeys: { google: "test-key" },
        defaultModel: "gemini-pro",
        defaultParameters: {
          temperature: 0.7,
          maxTokens: 2048,
          topP: 0.95,
        },
        uiPreferences: {
          theme: "dark",
          fontSize: "medium",
          codeTheme: "github-dark",
          showTokenCount: true,
          showCostEstimate: true,
        },
      };

      await settings.save(sampleSettings);
      const retrieved = await settings.get();
      expect(retrieved).toEqual(sampleSettings);
    });
  });

  describe("Functions", () => {
    it("should create and retrieve a function", async () => {
      const now = Date.now();
      const id = await functions.create({
        name: "testFn",
        description: "A test function",
        parameters: { type: "object", properties: {} },
        implementation: "return true;",
        createdAt: now,
        updatedAt: now,
      });

      const fn = await functions.get(id);
      expect(fn?.name).toBe("testFn");
      expect(typeof fn?.id).toBe("string");
    });
  });

  describe("Error Handling", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should catch QuotaExceededError and show a specific toast", async () => {
      const mockAdd = vi.spyOn(db.conversations, "add").mockRejectedValueOnce({
        name: "QuotaExceededError",
      });

      await expect(
        conversations.create({
          title: "Test",
          modelId: "gemini-pro",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          messages: [],
          parameters: { temperature: 0.7, maxTokens: 2048, topP: 0.95 },
        }),
      ).rejects.toMatchObject({ name: "QuotaExceededError" });

      expect(toast.error).toHaveBeenCalledWith(
        "Storage limit reached. Please delete old conversations or free up space.",
      );

      mockAdd.mockRestore();
    });

    it("should catch generic errors and show the fallback toast", async () => {
      const genericError = new Error("Generic DB Error");
      const mockAdd = vi
        .spyOn(db.conversations, "add")
        .mockRejectedValueOnce(genericError);

      await expect(
        conversations.create({
          title: "Test",
          modelId: "gemini-pro",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          messages: [],
          parameters: { temperature: 0.7, maxTokens: 2048, topP: 0.95 },
        }),
      ).rejects.toThrow("Generic DB Error");

      expect(toast.error).toHaveBeenCalledWith("Failed to create conversation");

      mockAdd.mockRestore();
    });
  });
});
