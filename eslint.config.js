import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import tseslint from "typescript-eslint";

const ROOT_DIR = path.dirname(fileURLToPath(import.meta.url));

const FEATURE_FOLDERS = readdirSync(path.join(ROOT_DIR, "src/features"), {
  withFileTypes: true,
})
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

const intraFeatureRelativeImportRules = FEATURE_FOLDERS.map((feature) => ({
  files: [`src/features/${feature}/**/*.{ts,tsx}`],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: [`@/features/${feature}`, `@/features/${feature}/*`],
            message: `Inside the ${feature} feature, use relative imports for ${feature} modules.`,
          },
          ...FEATURE_FOLDERS.filter((otherFeature) => otherFeature !== feature)
            .sort()
            .map((otherFeature) => ({
              group: [`@/features/${otherFeature}/*`],
              message: `External ${otherFeature} imports must use the top-level feature barrel: '@/features/${otherFeature}'.`,
            })),
        ],
      },
    ],
  },
}));

const externalFeatureBarrelImportRule = {
  files: ["**/*.{ts,tsx}"],
  ignores: ["src/features/**/*.{ts,tsx}"],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: FEATURE_FOLDERS.map((feature) => ({
          group: [`@/features/${feature}/*`],
          message: `External ${feature} imports must use the top-level feature barrel: '@/features/${feature}'.`,
        })),
      },
    ],
  },
};

export default defineConfig([
  globalIgnores(["dist", "src/shared/components/ui"]),
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
  ...intraFeatureRelativeImportRules,
  externalFeatureBarrelImportRule,
]);
