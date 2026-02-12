import "@testing-library/jest-dom";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { createLocalStorageMock, createMatchMediaMock } from "./mocks";

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
