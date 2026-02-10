import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Toast {
  id: string;
  type: "info" | "success" | "warning" | "error";
  message: string;
  duration?: number;
}

interface UIState {
  isSidebarOpen: boolean;
  activeModal: string | null;
  toasts: Toast[];

  // Actions
  toggleSidebar: () => void;
  setSidebarOpen: (isOpen: boolean) => void;
  openModal: (modalId: string) => void;
  closeModal: () => void;
  addToast: (toast: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      isSidebarOpen: true,
      activeModal: null,
      toasts: [],

      toggleSidebar: () =>
        set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
      setSidebarOpen: (isOpen: boolean) => set({ isSidebarOpen: isOpen }),
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
    }),
    {
      name: "ui-storage",
      partialize: (state) => ({ isSidebarOpen: state.isSidebarOpen }), // Only persist sidebar state
    },
  ),
);
