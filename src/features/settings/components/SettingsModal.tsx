import { Settings } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/shared/components/ui";
import { useUIStore } from "@/shared/store/ui";

import { AppearanceSettings } from "./AppearanceSettings";
import { GeneralSettingsTab } from "./GeneralSettingsTab";
import { ImportExport } from "./ImportExport";

export function SettingsModal() {
  const { activeModal, closeModal } = useUIStore();

  const isOpen = activeModal === "settings";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeModal()}>
      <DialogContent className="flex h-120 max-h-[85vh] flex-col overflow-hidden sm:max-w-150">
        <DialogHeader className="shrink-0 pb-4">
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Settings
          </DialogTitle>
        </DialogHeader>

        <Tabs
          defaultValue="general"
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <TabsList className="flex w-full shrink-0 justify-start overflow-x-auto">
            <TabsTrigger className="min-w-fit flex-1" value="general">
              General
            </TabsTrigger>
            <TabsTrigger className="min-w-fit flex-1" value="data">
              Data Management
            </TabsTrigger>
          </TabsList>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pt-4">
            <TabsContent value="general" className="mt-0">
              <div className="mb-4 rounded-lg border p-4">
                <div className="mb-4 space-y-2">
                  <h3 className="font-medium">Appearance</h3>
                  <p className="text-muted-foreground text-sm">
                    Customize the look and feel of the application.
                  </p>
                </div>
                <AppearanceSettings />
              </div>
              <div className="rounded-lg border p-4">
                <div className="mb-4 space-y-2">
                  <h3 className="font-medium">Authentication</h3>
                  <p className="text-muted-foreground text-sm">
                    Configure your provider API keys to enable access to AI
                    models.
                  </p>
                </div>
                <GeneralSettingsTab />
              </div>
            </TabsContent>

            <TabsContent value="data" className="mt-0">
              <div className="rounded-lg border p-4">
                <div className="mb-4 space-y-2">
                  <h3 className="font-medium">Backup & Restore</h3>
                  <p className="text-muted-foreground text-sm">
                    Export saves your API keys, application preferences, and all
                    conversations. Importing a previously saved backup file will
                    merge these elements into your current session.
                  </p>
                </div>
                <ImportExport />
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
