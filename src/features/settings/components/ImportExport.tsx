import { Download, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { useConversationStore } from "@/features/chat";
import { useFunctionsStore } from "@/features/functions";
import { Button } from "@/shared/components/ui";

import { exportData, importData } from "../services";
import { useSettingsStore } from "../store";

export function ImportExport() {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const loadSettings = useSettingsStore((state) => state.loadSettings);
  const loadConversations = useConversationStore(
    (state) => state.loadConversations,
  );
  const ensureActiveConversation = useConversationStore(
    (state) => state.ensureActiveConversation,
  );
  const ensureFunctionsLoaded = useFunctionsStore(
    (state) => state.ensureFunctionsLoaded,
  );

  const handleExport = async () => {
    try {
      setIsExporting(true);
      const data = await exportData();
      const blob = new Blob([data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tinkeral-backup-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Data exported successfully");
    } catch {
      toast.error("Failed to export data");
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsImporting(true);
      const text = await file.text();
      const result = await importData(text);

      if (result.settingsUpdated) {
        await loadSettings();
      }

      if (result.functionsUpdated) {
        await ensureFunctionsLoaded(true);
      }

      if (result.conversationsUpdated) {
        await loadConversations();
        await ensureActiveConversation();
      }

      toast.success("Data imported successfully");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      toast.error(`Import failed: ${msg}`);
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="flex flex-wrap gap-4 pt-2">
      <Button
        variant="outline"
        onClick={handleExport}
        disabled={isExporting || isImporting}
        className="flex-1"
      >
        <Download className="mr-2 h-4 w-4" />
        Export Data
      </Button>
      <Button
        variant="outline"
        onClick={handleImportClick}
        disabled={isExporting || isImporting}
        className="flex-1"
      >
        <Upload className="mr-2 h-4 w-4" />
        Import Data
      </Button>
      <input
        type="file"
        accept=".json"
        className="hidden"
        ref={fileInputRef}
        onChange={handleFileChange}
      />
    </div>
  );
}
