import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
  globalIgnores(["dist", "src/components/ui"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["src/components/chat/**/*.{ts,tsx}"],
    ignores: ["src/components/chat/**/__tests__/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/components/chat",
              message:
                "Avoid intra-domain barrel imports inside chat components. Import directly via a relative path instead.",
            },
            {
              name: "@/components/chat/index",
              message:
                "Avoid intra-domain barrel imports inside chat components. Import directly via a relative path instead.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/stores/**/*.{ts,tsx}"],
    ignores: ["src/stores/**/__tests__/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/stores",
              message:
                "Store internals must import concrete store modules (e.g. '@/stores/settings') instead of the '@/stores' barrel.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/types/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/services",
                "@/services/*",
                "../services",
                "../services/*",
              ],
              message:
                "Types layer must not depend on services. Move shared shapes to '@/types' and import from there.",
            },
            {
              group: ["@/db", "@/db/*", "../db", "../db/*"],
              message:
                "Types layer must not depend on db modules. Move shared shapes to '@/types' and import from there.",
            },
          ],
        },
      ],
    },
  },
]);
