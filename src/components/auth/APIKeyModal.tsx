import { useState } from "react";
import { toast } from "sonner";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Input,
} from "@/components/ui";
import { GoogleAPIClient } from "@/services/api/google";
import { useSettingsStore } from "@/stores";

export function APIKeyModal() {
  const [apiKey, setApiKey] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const setStoreApiKey = useSettingsStore((state) => state.setApiKey);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!apiKey.trim()) {
      toast.error("Please enter an API key");
      return;
    }

    setIsValidating(true);

    try {
      const isValid = await GoogleAPIClient.validateKey(apiKey);

      if (isValid) {
        await setStoreApiKey("google", apiKey);
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
    <div className="bg-background/80 fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm">
      <Card className="max-w-80vw md:w-sm">
        <CardHeader>
          <CardTitle className="my-4 space-y-4 text-center">
            <div className="text-5xl">🧩</div>
            <h3>Welcome to Tinkeral</h3>
          </CardTitle>
          <CardDescription>
            To get started, please provide your Google Gemini API key. Your key
            is stored locally in your browser.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="Enter your Google API Key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                disabled={isValidating}
              />
              <p className="text-muted-foreground text-xs">
                You can get a key from{" "}
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
          </CardContent>
          <CardFooter className="mt-4">
            <Button
              type="submit"
              className="w-full"
              disabled={isValidating || !apiKey.trim()}
            >
              {isValidating ? "Validating..." : "Start Chatting"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
