import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
  },
  resolve: {
    alias: [
      {
        find: /^expo-file-system\/legacy$/,
        replacement: path.resolve(__dirname, "vitest.stub.ts"),
      },
      {
        find: /^expo-file-system$/,
        replacement: path.resolve(__dirname, "vitest.file-stub.ts"),
      },
    ],
  },
});
