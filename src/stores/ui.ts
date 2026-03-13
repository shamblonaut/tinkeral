import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Toast {
  id: string;
  type: "info" | "success" | "warning" | "error";
  message: string;
  duration?: number;
}

export type PlatformView = "chat" | "functions";

interface UIState {
  platformView: PlatformView;
  isSidebarOpen: boolean;
  isChatSettingsOpen: boolean;
  activeModal: string | null;
  toasts: Toast[];

  selectedFunctionId: string | null;

  setPlatformView: (view: PlatformView) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (isOpen: boolean) => void;
  toggleChatSettings: () => void;
  setChatSettingsOpen: (isOpen: boolean) => void;
  openModal: (modalId: string) => void;
  closeModal: () => void;
  addToast: (toast: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;
  selectFunction: (id: string | null) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      platformView: "chat",
      isSidebarOpen: true,
      isChatSettingsOpen:
        typeof window !== "undefined" ? window.innerWidth >= 768 : true,
      activeModal: null,
      toasts: [],

      selectedFunctionId: null,

      setPlatformView: (view: PlatformView) => set({ platformView: view }),
      toggleSidebar: () =>
        set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
      setSidebarOpen: (isOpen: boolean) => set({ isSidebarOpen: isOpen }),
      toggleChatSettings: () =>
        set((state) => ({
          isChatSettingsOpen: !state.isChatSettingsOpen,
        })),
      setChatSettingsOpen: (isOpen: boolean) =>
        set({ isChatSettingsOpen: isOpen }),
      openModal: (modalId: string) => set({ activeModal: modalId }),
      closeModal: () => set({ activeModal: null }),
      addToast: (toast) => {
        const id = crypto.randomUUID();
        const newToast = { ...toast, id };
        set((state) => ({ toasts: [...state.toasts, newToast] }));
        if (toast.duration !== 0) {
          setTimeout(() => {
            get().removeToast(id);
          }, toast.duration || 3000);
        }
      },
      removeToast: (id: string) => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }));
      },
      selectFunction: (id: string | null) => set({ selectedFunctionId: id }),
    }),
    {
      name: "ui-storage",
      partialize: (state) => ({
        platformView: state.platformView,
        isSidebarOpen: state.isSidebarOpen,
      }),
    },
  ),
);
