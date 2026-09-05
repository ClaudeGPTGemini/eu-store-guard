import js from "@eslint/js";
import globals from "globals";
export default [
  { ignores: ["**/node_modules/**", "**/dist/**", "**/.wrangler/**"] },
  js.configs.recommended,
  { files: ["**/*.js", "**/*.mjs"], languageOptions: { ecmaVersion: 2023, sourceType: "module", globals: { ...globals.node, ...globals.browser, Response: "readonly", Request: "readonly", URL: "readonly", crypto: "readonly" } },
    rules: { "no-unused-vars": ["error", { args: "none" }], "no-console": "off" } },
];
