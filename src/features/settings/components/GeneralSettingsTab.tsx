import { useState } from "react";
import { toast } from "sonner";

import { Button, Input, Label } from "@/shared/components/ui";
import { GoogleAPIClient } from "@/shared/services/api";

import { useSettingsStore } from "../store";

export function GeneralSettingsTab() {
  const { settings, setApiKey } = useSettingsStore();
  const [apiKey, setLocalApiKey] = useState(settings?.apiKeys?.google || "");
  const [isValidating, setIsValidating] = useState(false);

  const handleSaveToken = async () => {
    if (!apiKey.trim()) {
      toast.error("Please enter an API key");
      return;
    }

    setIsValidating(true);
    try {
      const isValid = await GoogleAPIClient.validateKey(apiKey);
      if (isValid) {
        await setApiKey("google", apiKey.trim());
        toast.success("API key saved successfully");
      } else {
        toast.error("Invalid API key. Please check and try again.");
      }
    } catch (error) {
      console.error("Failed to validate key:", error);
      toast.error("Failed to validate API key");
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div className="space-y-3">
      <Label htmlFor="google-api-key" className="text-xs">
        Google Gemini API Key
      </Label>
      <div className="flex flex-col gap-2">
        <Input
          id="google-api-key"
          type="password"
          placeholder="Enter key"
          value={apiKey}
          onChange={(e) => setLocalApiKey(e.target.value)}
          disabled={isValidating}
          className="w-full"
        />
        <Button
          onClick={handleSaveToken}
          disabled={
            isValidating ||
            !apiKey.trim() ||
            apiKey === settings?.apiKeys?.google
          }
          className="w-full"
        >
          {isValidating ? "Validating..." : "Save"}
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">
        Keys are stored locally. Get one from{" "}
        <a
          href="https://aistudio.google.com/app/apikey"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-primary underline"
        >
          Google AI Studio
        </a>
        .
      </p>
    </div>
  );
}
