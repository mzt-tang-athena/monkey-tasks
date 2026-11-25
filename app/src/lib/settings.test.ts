import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const platform = vi.hoisted(() => ({ os: "web" }));
const storage = vi.hoisted(() => {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
    clear: () => values.clear(),
  };
});

vi.mock("react-native", () => ({
  Platform: {
    get OS() {
      return platform.os;
    },
    select: (options: Record<string, unknown>) =>
      options[platform.os] ?? options.default,
  },
}));
vi.mock("expo-file-system", async () => {
  const { sharedFakeAppFiles } = await import("@/testing/fake-app-files");
  return {
    File: sharedFakeAppFiles.File,
    Paths: { document: sharedFakeAppFiles.document },
  };
});

import { sharedFakeAppFiles } from "@/testing/fake-app-files";
import { loadSettings, saveSetting } from "./settings";

const SORT_KEY = "monkey-tasks.sort-mode";

beforeEach(() => {
  sharedFakeAppFiles.reset();
  platform.os = "web";
  storage.clear();
  vi.stubGlobal("localStorage", storage);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the lists order a phone starts with", () => {
  it("is My order on a fresh install", () => {
    expect(loadSettings().sortMode).toBe("manual");
  });

  it("is the Due date a phone saved before the default moved", () => {
    storage.setItem(SORT_KEY, "due");

    expect(loadSettings().sortMode).toBe("due");
  });

  it("keeps a saved choice across a load and a save of another setting", () => {
    storage.setItem(SORT_KEY, "due");

    saveSetting("taskForm", "pills");

    expect(loadSettings().sortMode).toBe("due");
    expect(loadSettings().taskForm).toBe("pills");
  });

  it("falls back to My order for a value it cannot read", () => {
    storage.setItem(SORT_KEY, "soonest");

    expect(loadSettings().sortMode).toBe("manual");
  });

  it("reads the saved choice from the native file too", () => {
    platform.os = "android";
    sharedFakeAppFiles.files.set(
      "file:///documents/monkey-tasks-settings.json",
      JSON.stringify({ sortMode: "due" }),
    );

    expect(loadSettings().sortMode).toBe("due");
  });
});
