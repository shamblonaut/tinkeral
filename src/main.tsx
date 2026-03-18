import "./styles/globals.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { ErrorBoundary } from "@/shared/components";

import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
