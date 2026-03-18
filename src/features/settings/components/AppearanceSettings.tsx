import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { Button, Label } from "@/shared/components/ui";

export function AppearanceSettings() {
  const { theme, setTheme } = useTheme();
  // Prevent hydration mismatch
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);

  if (!mounted) return null;

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">Theme</Label>
      <div className="grid grid-cols-3 gap-2">
        <Button
          variant={theme === "system" ? "default" : "outline"}
          className="flex h-auto flex-col gap-2 py-4"
          onClick={() => setTheme("system")}
        >
          <Monitor className="h-5 w-5" />
          <span className="text-xs">System</span>
        </Button>
        <Button
          variant={theme === "light" ? "default" : "outline"}
          className="flex h-auto flex-col gap-2 py-4"
          onClick={() => setTheme("light")}
        >
          <Sun className="h-5 w-5" />
          <span className="text-xs">Light</span>
        </Button>
        <Button
          variant={theme === "dark" ? "default" : "outline"}
          className="flex h-auto flex-col gap-2 py-4"
          onClick={() => setTheme("dark")}
        >
          <Moon className="h-5 w-5" />
          <span className="text-xs">Dark</span>
        </Button>
      </div>
    </div>
  );
}
