import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes("react-syntax-highlighter") ||
            id.includes("refractor") ||
            id.includes("prismjs")
          ) {
            return "highlighter";
          }
          if (
            id.includes("node_modules/react/") ||
            id.includes("node_modules/react-dom/") ||
            id.includes("node_modules/zustand/") ||
            id.includes("node_modules/dexie")
          ) {
            return "vendor";
          }
          if (
            id.includes("node_modules/lucide-react") ||
            id.includes("node_modules/radix-ui") ||
            id.includes("node_modules/react-markdown") ||
            id.includes("node_modules/remark-gfm")
          ) {
            return "deps";
          }
          if (id.includes("node_modules/@google/genai")) {
            return "ai";
          }
        },
      },
    },
  },
});
