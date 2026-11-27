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

describe("the built-in lists", () => {
  const TODAY_KEY = "monkey-tasks.today-list";

  it("shows Today on a fresh install", () => {
    expect(loadSettings().todayList).toBe("on");
  });

  it("keeps Today off once the switch turns it off", () => {
    saveSetting("todayList", "off");

    expect(loadSettings().todayList).toBe("off");
    expect(storage.getItem(TODAY_KEY)).toBe("off");
  });

  it("turns Today back on", () => {
    saveSetting("todayList", "off");
    saveSetting("todayList", "on");

    expect(loadSettings().todayList).toBe("on");
    expect(storage.getItem(TODAY_KEY)).toBe("on");
  });

  it("falls back to on for a value it cannot read", () => {
    storage.setItem(TODAY_KEY, "maybe");

    expect(loadSettings().todayList).toBe("on");
  });

  it("reads the saved switch from the native file too", () => {
    platform.os = "android";
    sharedFakeAppFiles.files.set(
      "file:///documents/monkey-tasks-settings.json",
      JSON.stringify({ todayList: "off" }),
    );

    expect(loadSettings().todayList).toBe("off");
  });
});

describe("the planner's task half", () => {
  const KEY = "monkey-tasks.planner-tasks";

  it("shows the task half on a fresh install", () => {
    expect(loadSettings().plannerTasks).toBe("on");
  });

  it("keeps the half hidden once it is hidden, and shows it again", () => {
    saveSetting("plannerTasks", "off");

    expect(loadSettings().plannerTasks).toBe("off");
    expect(storage.getItem(KEY)).toBe("off");

    saveSetting("plannerTasks", "on");

    expect(loadSettings().plannerTasks).toBe("on");
  });

  it("falls back to shown for a value it cannot read", () => {
    storage.setItem(KEY, "maybe");

    expect(loadSettings().plannerTasks).toBe("on");
  });

  it("reads the choice from the native file too", () => {
    platform.os = "android";
    sharedFakeAppFiles.files.set(
      "file:///documents/monkey-tasks-settings.json",
      JSON.stringify({ plannerTasks: "off" }),
    );

    expect(loadSettings().plannerTasks).toBe("off");
  });
});

describe("the Inbox columns", () => {
  const COLUMNS_KEY = "monkey-tasks.inbox-columns";

  it("starts with two columns", () => {
    expect(loadSettings().inboxColumns).toBe("two");
  });

  it("keeps the choice of one column", () => {
    saveSetting("inboxColumns", "one");

    expect(loadSettings().inboxColumns).toBe("one");
    expect(storage.getItem(COLUMNS_KEY)).toBe("one");
  });

  it("falls back to two for a value it cannot read", () => {
    storage.setItem(COLUMNS_KEY, "three");

    expect(loadSettings().inboxColumns).toBe("two");
  });

  it("reads the saved choice from the native file too", () => {
    platform.os = "android";
    sharedFakeAppFiles.files.set(
      "file:///documents/monkey-tasks-settings.json",
      JSON.stringify({ inboxColumns: "one" }),
    );

    expect(loadSettings().inboxColumns).toBe("one");
  });
});
