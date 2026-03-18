import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ImportExport } from "..";
import * as importExportService from "../../services";

// Mock the service
vi.mock("../../services", () => ({
  exportData: vi.fn(),
  importData: vi.fn(),
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("ImportExport Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Export Flow", () => {
    it("should export data and trigger download successfully", async () => {
      const mockData = JSON.stringify({ version: 1, data: "test" });
      vi.mocked(importExportService.exportData).mockResolvedValue(mockData);

      // Mock URL methods
      const createObjectURLMock = vi.fn().mockReturnValue("blob:test-url");
      const revokeObjectURLMock = vi.fn();
      global.URL.createObjectURL = createObjectURLMock;
      global.URL.revokeObjectURL = revokeObjectURLMock;

      // Mock link element creation and click
      const mockClick = vi.fn();

      vi.spyOn(document.body, "appendChild").mockImplementation((node) => {
        if (node instanceof HTMLAnchorElement) {
          node.click = mockClick;
        }
        return HTMLElement.prototype.appendChild.call(document.body, node);
      });
      vi.spyOn(document.body, "removeChild").mockImplementation((node) => {
        return HTMLElement.prototype.removeChild.call(document.body, node);
      });

      render(<ImportExport />);

      const user = userEvent.setup();
      const exportBtn = screen.getByRole("button", { name: /export data/i });

      await user.click(exportBtn);

      expect(importExportService.exportData).toHaveBeenCalled();
      expect(createObjectURLMock).toHaveBeenCalled();
      expect(mockClick).toHaveBeenCalled();
      expect(document.body.appendChild).toHaveBeenCalled();
      expect(document.body.removeChild).toHaveBeenCalled();
      expect(revokeObjectURLMock).toHaveBeenCalledWith("blob:test-url");

      const { toast } = await import("sonner");
      expect(toast.success).toHaveBeenCalledWith("Data exported successfully");
    });

    it("should handle export errors", async () => {
      vi.mocked(importExportService.exportData).mockRejectedValue(
        new Error("Export failed"),
      );

      render(<ImportExport />);

      const user = userEvent.setup();
      const exportBtn = screen.getByRole("button", { name: /export data/i });

      await user.click(exportBtn);

      expect(importExportService.exportData).toHaveBeenCalled();

      const { toast } = await import("sonner");
      expect(toast.error).toHaveBeenCalledWith("Failed to export data");
    });
  });

  describe("Import Flow", () => {
    it("should import data successfully when file is selected", async () => {
      vi.mocked(importExportService.importData).mockResolvedValue({
        settingsUpdated: false,
        conversationsUpdated: false,
        functionsUpdated: false,
      });

      render(<ImportExport />);

      // A setup function is a better approach, but userEvent.upload covers this well
      const user = userEvent.setup();

      // Find the hidden file input
      // We can find it by getting the import button and knowing it's a sibling,
      // or using a test-id, but we can also use querySelector
      const fileInput = document.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      expect(fileInput).not.toBeNull();
      expect(fileInput.className).toContain("hidden");

      const file = new File(["{}"], "data.json", { type: "application/json" });
      file.text = vi.fn().mockResolvedValue("{}");

      await user.upload(fileInput, file);

      expect(importExportService.importData).toHaveBeenCalledWith("{}");

      await waitFor(async () => {
        const { toast } = await import("sonner");
        expect(toast.success).toHaveBeenCalledWith(
          "Data imported successfully",
        );
      });
    });

    it("should handle import errors", async () => {
      vi.mocked(importExportService.importData).mockRejectedValue(
        new Error("Invalid format"),
      );

      render(<ImportExport />);

      const user = userEvent.setup();
      const fileInput = document.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;

      const file = new File(["invalid"], "data.json", {
        type: "application/json",
      });
      file.text = vi.fn().mockResolvedValue("invalid");

      await user.upload(fileInput, file);

      expect(importExportService.importData).toHaveBeenCalledWith("invalid");

      await waitFor(async () => {
        const { toast } = await import("sonner");
        expect(toast.error).toHaveBeenCalledWith(
          "Import failed: Invalid format",
        );
      });
    });
  });
});
