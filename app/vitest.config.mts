import { createRequire } from "node:module";
import path from "node:path";
import type { Plugin, Rollup } from "vite";
import { defineConfig } from "vitest/config";

const src = path.resolve(import.meta.dirname, "src");

// Expo brings Babel, which ships no types.
const { transformAsync } = createRequire(import.meta.url)("@babel/core") as {
  transformAsync: (
    code: string,
    options: object,
  ) => Promise<{ code?: string | null; map?: Rollup.SourceMapInput } | null>;
};

// Metro runs the worklets Babel plugin through babel-preset-expo.
// Component tests run the same plugin on the app's own files, so a
// surface renders here as it does in the bundle.
const worklets: Plugin = {
  name: "worklets",
  enforce: "pre",
  async transform(code, id) {
    if (!id.startsWith(src) || !/\.tsx?$/.test(id) || !/worklet|Animated|Gesture/.test(code)) {
      return null;
    }
    const out = await transformAsync(code, {
      filename: id,
      babelrc: false,
      configFile: false,
      sourceMaps: true,
      plugins: [
        ["@babel/plugin-syntax-typescript", { isTSX: id.endsWith(".tsx") }],
        "react-native-worklets/plugin",
      ],
    });
    return out?.code == null ? null : { code: out.code, map: out.map };
  },
};

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
        plugins: [worklets],
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
