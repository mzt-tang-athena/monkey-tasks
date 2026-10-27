import { configDefaults, defineConfig } from "vitest/config";
import path from "node:path";

const src = path.resolve(import.meta.dirname, "src");

// Two projects (ADR 0038). Logic tests run in node. Component tests
// render through React Native Web in jsdom. The include lists name
// src and scripts only, so the Playwright suite in e2e/ stays out.
export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\//, replacement: `${src}/` },
      {
        find: "expo-file-system/legacy",
        replacement: path.resolve(import.meta.dirname, "vitest.stub.ts"),
      },
    ],
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: [
            "src/**/*.test.ts",
            "scripts/**/*.test.ts",
            // Store tests drive the provider in node, with their own
            // react-native mock. Tickets 0051 and 0052 rewrite them.
            "src/store/**/*.test.tsx",
            "src/testing/repro/**/*.test.tsx",
          ],
        },
      },
      {
        extends: true,
        resolve: {
          alias: [{ find: /^react-native$/, replacement: "react-native-web" }],
          // Metro's web build picks a `.web` file over its sibling.
          // The component project resolves the same way, so a library
          // with a web build (gesture handler, safe area) loads it.
          extensions: [
            ".web.tsx",
            ".web.ts",
            ".web.mjs",
            ".web.js",
            ".tsx",
            ".ts",
            ".mjs",
            ".js",
            ".jsx",
            ".json",
          ],
        },
        test: {
          name: "component",
          environment: "jsdom",
          include: ["src/**/*.test.tsx"],
          exclude: [
            ...configDefaults.exclude,
            "src/store/**",
            "src/testing/repro/**",
          ],
          setupFiles: ["src/testing/dom-setup.ts"],
        },
      },
    ],
  },
});
