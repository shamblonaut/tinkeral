import "@testing-library/jest-dom";
import { cleanup } from "@testing-library/react";
import "fake-indexeddb/auto";
import { afterEach, beforeEach, vi } from "vitest";

import { createLocalStorageMock, createMatchMediaMock } from "@/test";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
});

Object.defineProperty(window, "localStorage", {
  value: createLocalStorageMock(),
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: createMatchMediaMock(),
});
