import "@testing-library/jest-dom";
import { cleanup } from "@testing-library/react";
import "fake-indexeddb/auto";
import { afterEach } from "vitest";

import { createLocalStorageMock, createMatchMediaMock } from "@/test";

// Automatically cleanup DOM after each test to prevent side effects
afterEach(() => {
  cleanup();
});

Object.defineProperty(window, "localStorage", {
  value: createLocalStorageMock(),
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: createMatchMediaMock(),
});
