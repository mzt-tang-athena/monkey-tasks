import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
  },
  resolve: {
    alias: {
      "expo-file-system/legacy": path.resolve(__dirname, "vitest.stub.ts"),
    },
  },
});
