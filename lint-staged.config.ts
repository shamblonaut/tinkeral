export default {
  "**/*.{js,jsx,ts,tsx}": [
    "eslint --fix",
    "prettier --write",
    "vitest related --run --passWithNoTests",
  ],
  "**/*.{json,html,css,md}": ["prettier --write"],
};
