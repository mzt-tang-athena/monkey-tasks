import { defineConfig } from "vitest/config";
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
        replacement: `${src}/testing/expo-file-system-stub.ts`,
      },
    ],
  },
  test: {
    projects: [
      {
        extends: true,
        resolve: {
          // Node cannot load either package. The motion tokens need only
          // Reanimated's easing module, which imports nothing else.
          alias: [
            {
              find: /^react-native-reanimated$/,
              replacement: path.resolve(
                import.meta.dirname,
                "node_modules/react-native-reanimated/lib/module/Easing.js",
              ),
            },
            {
              find: /^react-native-worklets$/,
              replacement: `${src}/testing/worklets-stub.ts`,
            },
          ],
        },
        test: {
          name: "unit",
          environment: "node",
          include: [
            "src/**/*.test.ts",
            "scripts/**/*.test.ts",
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
          setupFiles: ["src/testing/dom-setup.ts"],
          // Reanimated and worklets ship extensionless ESM imports and
          // `.web` files, which only Vite's resolver follows.
          server: {
            deps: { inline: ["react-native-reanimated", "react-native-worklets"] },
          },
        },
      },
    ],
  },
});
