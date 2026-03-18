import { beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/db";

import { exportData, importData } from "../importExport";

// Mock Dexie db
vi.mock("@/db", () => ({
  db: {
    settings: {
      get: vi.fn(),
      put: vi.fn(),
    },
    conversations: {
      toArray: vi.fn(),
      bulkPut: vi.fn(),
      clear: vi.fn(),
    },
    functions: {
      toArray: vi.fn(),
      bulkPut: vi.fn(),
      clear: vi.fn(),
    },
    transaction: vi.fn(async (...args) => {
      // The last argument is always the callback in Dexie.transaction
      const callback = args[args.length - 1];
      if (typeof callback === "function") {
        await callback();
      }
    }),
  },
}));

describe("Import/Export Service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("exportData", () => {
    it("should export settings, conversations, and functions in correct JSON format", async () => {
      const mockSettings = { id: "app-settings", theme: "dark" };
      const mockConversations = [{ id: "conv-1", title: "Test" }];
      const mockFunctions = [
        { id: "func-1", name: "testFn", implementation: "return true;" },
      ];

      vi.mocked(db.settings.get).mockResolvedValue(mockSettings as never);
      vi.mocked(db.conversations.toArray).mockResolvedValue(
        mockConversations as never,
      );
      vi.mocked(db.functions.toArray).mockResolvedValue(mockFunctions as never);

      const result = await exportData();
      const parsed = JSON.parse(result);

      expect(parsed.version).toBe(1);
      expect(parsed.timestamp).toBeTypeOf("number");
      expect(parsed.settings).toEqual(mockSettings);
      expect(parsed.conversations).toEqual(mockConversations);
      expect(parsed.functions).toEqual(mockFunctions);
    });
  });

  describe("importData", () => {
    it("should reject invalid JSON", async () => {
      await expect(importData("not json")).rejects.toThrow("Invalid JSON file");
    });

    it("should reject invalid object format", async () => {
      await expect(importData('"string"')).rejects.toThrow(
        "Invalid backup format",
      );
    });

    it("should reject JSON missing settings, conversations, and functions", async () => {
      await expect(importData('{"foo": "bar"}')).rejects.toThrow(
        "No settings, conversations, or functions found in backup",
      );
    });

    it("should reject corrupted conversations array", async () => {
      const payload = JSON.stringify({
        conversations: "not-an-array",
      });
      await expect(importData(payload)).rejects.toThrow(
        "Corrupted backup: conversations should be an array",
      );
    });

    it("should reject conversations missing IDs", async () => {
      const payload = JSON.stringify({
        conversations: [{ title: "No ID" }],
      });
      await expect(importData(payload)).rejects.toThrow(
        "Corrupted backup: conversation missing ID",
      );
    });

    it("should reject corrupted functions array", async () => {
      const payload = JSON.stringify({
        functions: "not-an-array",
      });
      await expect(importData(payload)).rejects.toThrow(
        "Corrupted backup: functions should be an array",
      );
    });

    it("should reject functions missing required fields", async () => {
      const payload = JSON.stringify({
        functions: [{ id: "func-1", name: "testFn" }], // missing implementation
      });
      await expect(importData(payload)).rejects.toThrow(
        "Corrupted backup: function missing required fields or invalid format",
      );
    });

    it("should import data successfully", async () => {
      vi.mocked(db.functions.toArray).mockResolvedValue([] as never);

      const payload = JSON.stringify({
        settings: { id: "app-settings", theme: "light" },
        conversations: [{ id: "conv-1", title: "Restored" }],
        functions: [
          { id: "func-1", name: "testFn", implementation: "return true;" },
        ],
      });

      const result = await importData(payload);

      expect(db.settings.put).toHaveBeenCalledWith({
        id: "app-settings",
        theme: "light",
      });
      expect(db.conversations.bulkPut).toHaveBeenCalledWith([
        { id: "conv-1", title: "Restored" },
      ]);
      expect(db.functions.bulkPut).toHaveBeenCalledWith([
        { id: "func-1", name: "testFn", implementation: "return true;" },
      ]);

      expect(result).toEqual({
        settingsUpdated: true,
        conversationsUpdated: true,
        functionsUpdated: true,
      });
    });

    it("should return granular update flags for partial imports", async () => {
      const payload = JSON.stringify({
        settings: { id: "app-settings", theme: "light" },
      });

      const result = await importData(payload);

      expect(result).toEqual({
        settingsUpdated: true,
        conversationsUpdated: false,
        functionsUpdated: false,
      });
    });
  });
});
