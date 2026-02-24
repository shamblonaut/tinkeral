import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useUIStore } from "@/stores";

describe("UIStore", () => {
  beforeEach(() => {
    useUIStore.setState({
      isSidebarOpen: true,
      isChatSettingsOpen: false,
      activeModal: null,
      toasts: [],
    });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should toggle sidebar", () => {
    const store = useUIStore.getState();

    store.toggleSidebar();
    expect(useUIStore.getState().isSidebarOpen).toBe(false);

    store.toggleSidebar();
    expect(useUIStore.getState().isSidebarOpen).toBe(true);
  });

  it("should set sidebar open state", () => {
    const store = useUIStore.getState();

    store.setSidebarOpen(false);
    expect(useUIStore.getState().isSidebarOpen).toBe(false);
  });

  it("should manage modals", () => {
    const store = useUIStore.getState();

    store.openModal("settings");
    expect(useUIStore.getState().activeModal).toBe("settings");

    store.closeModal();
    expect(useUIStore.getState().activeModal).toBeNull();
  });

  it("should add and remove toasts", () => {
    const store = useUIStore.getState();

    store.addToast({
      type: "info",
      message: "Test Toast",
    });

    expect(useUIStore.getState().toasts.length).toBe(1);
    expect(useUIStore.getState().toasts[0].message).toBe("Test Toast");

    const toastId = useUIStore.getState().toasts[0].id;
    store.removeToast(toastId);

    expect(useUIStore.getState().toasts.length).toBe(0);
  });

  it("should auto-dismiss toasts", () => {
    const store = useUIStore.getState();

    store.addToast({
      type: "success",
      message: "Auto Dismiss",
      duration: 1000,
    });

    expect(useUIStore.getState().toasts.length).toBe(1);

    // Fast-forward time
    vi.advanceTimersByTime(1000);

    expect(useUIStore.getState().toasts.length).toBe(0);
  });

  it("should NOT auto-dismiss toasts with duration 0 (persistent)", () => {
    const store = useUIStore.getState();

    store.addToast({
      type: "info",
      message: "Persistent Toast",
      duration: 0,
    });

    expect(useUIStore.getState().toasts.length).toBe(1);

    // Even after a very long time, toast should still be there
    vi.advanceTimersByTime(60000);

    expect(useUIStore.getState().toasts.length).toBe(1);
    expect(useUIStore.getState().toasts[0].message).toBe("Persistent Toast");
  });

  it("should toggle chat settings", () => {
    const store = useUIStore.getState();

    // Reset to known state (might default to true/false depending on environment)
    store.setChatSettingsOpen(false);
    expect(useUIStore.getState().isChatSettingsOpen).toBe(false);

    store.toggleChatSettings();
    expect(useUIStore.getState().isChatSettingsOpen).toBe(true);

    store.toggleChatSettings();
    expect(useUIStore.getState().isChatSettingsOpen).toBe(false);
  });

  it("should set chat settings open state", () => {
    const store = useUIStore.getState();

    store.setChatSettingsOpen(true);
    expect(useUIStore.getState().isChatSettingsOpen).toBe(true);
  });
});
