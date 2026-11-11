import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const platform = vi.hoisted(() => ({ os: "android" }));
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
  },
}));
vi.mock("expo-file-system", async () => {
  const { sharedFakeAppFiles } = await import("@/testing/fake-app-files");
  return {
    File: sharedFakeAppFiles.File,
    Paths: { document: sharedFakeAppFiles.document },
  };
});
vi.mock("expo-constants", () => ({
  default: { expoConfig: { version: "1.0.0" } },
}));

import {
  CRASH_LOG_FILE,
  CRASH_LOG_MAX_BYTES,
  CRASH_LOG_OLD_FILE,
  crashCount,
  formatCrashEntry,
  latestCrashEntry,
  planAppend,
  readCrashLog,
  reportCrash,
  utf8Bytes,
} from "./crash-log";
import { recordBreadcrumb, resetBreadcrumbs } from "./breadcrumbs";
import { sharedFakeAppFiles } from "@/testing/fake-app-files";

const AT = new Date("2026-11-11T10:00:00.000Z");
const DOCUMENT = "file:///documents";

function nativePath(name: string): string {
  return `${DOCUMENT}/${name}`;
}

function context(overrides: Partial<Parameters<typeof formatCrashEntry>[1]> = {}) {
  return {
    at: AT,
    version: "1.0.0",
    channel: "production",
    platform: "android",
    breadcrumbs: [],
    ...overrides,
  };
}

beforeEach(() => {
  sharedFakeAppFiles.reset();
  resetBreadcrumbs();
  platform.os = "android";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("formatCrashEntry", () => {
  it("carries the time, version, channel, platform, message and 30 stack lines", () => {
    const stack = Array.from({ length: 40 }, (_, i) => `    at frame ${i + 1}`).join("\n");
    const entry = formatCrashEntry(
      { kind: "js", message: "Cannot read property 'x' of undefined", stack, fatal: true },
      context(),
    );

    expect(entry).toContain(
      "=== crash 2026-11-11T10:00:00.000Z app=1.0.0 channel=production platform=android kind=js fatal=yes",
    );
    expect(entry).toContain("message: Cannot read property 'x' of undefined");
    expect(entry).toContain("  at frame 30");
    expect(entry).not.toContain("at frame 31");
  });

  it("names the screen label of a render error and no fatal flag", () => {
    const entry = formatCrashEntry(
      { kind: "render", label: "Settings", message: "boom", stack: "Error: boom" },
      context(),
    );

    expect(entry).toContain("kind=render label=Settings");
    expect(entry).not.toContain("fatal=");
  });

  it("writes every breadcrumb it is given", () => {
    const entry = formatCrashEntry(
      { message: "boom", stack: "Error: boom" },
      context({
        breadcrumbs: [
          { at: "2026-11-11T09:59:59.000Z", kind: "tick", detail: "Water the plants" },
          { at: "2026-11-11T09:59:59.500Z", kind: "drag-start" },
        ],
      }),
    );

    expect(entry).toContain(
      "2026-11-11T09:59:59.000Z tick Water the plants",
    );
    expect(entry).toContain("2026-11-11T09:59:59.500Z drag-start");
  });
});

describe("planAppend", () => {
  it("appends while the entry fits", () => {
    expect(planAppend(10, "entry", 100)).toEqual({ text: "entry", rotate: false });
  });

  it("rotates when the entry would pass the cap", () => {
    expect(planAppend(95, "0123456789", 100)).toEqual({
      text: "0123456789",
      rotate: true,
    });
  });

  it("clips an entry larger than the whole cap", () => {
    const plan = planAppend(0, "x".repeat(300), 100);
    expect(plan.rotate).toBe(false);
    expect(utf8Bytes(plan.text)).toBeLessThanOrEqual(100);
  });
});

describe("reportCrash", () => {
  it("writes one entry for a forced JS error", () => {
    reportCrash({
      kind: "js",
      message: "boom",
      stack: "Error: boom\n    at handler (app.js:1:1)",
      fatal: true,
      at: AT,
    });

    const text = readCrashLog();
    expect(crashCount(text)).toBe(1);
    expect(text).toContain("=== crash 2026-11-11T10:00:00.000Z");
    expect(text).toContain("app=1.0.0");
    expect(text).toContain("channel=production");
    expect(text).toContain("platform=android");
    expect(text).toContain("message: boom");
    expect(text).toContain("at handler (app.js:1:1)");
    expect(sharedFakeAppFiles.writes).toEqual([nativePath(CRASH_LOG_FILE)]);
  });

  it("writes a render error with its screen label", () => {
    reportCrash({
      kind: "render",
      label: "Settings",
      message: "render boom",
      stack: "Error: render boom",
      at: AT,
    });

    const text = readCrashLog();
    expect(crashCount(text)).toBe(1);
    expect(text).toContain("kind=render label=Settings");
    expect(text).toContain("message: render boom");
  });

  it("appends the last 20 actions and no older one", () => {
    for (let i = 1; i <= 21; i += 1) {
      recordBreadcrumb("tick", `crumb-${String(i).padStart(2, "0")}`);
    }

    reportCrash({ message: "boom", stack: "Error: boom", at: AT });

    const text = readCrashLog();
    expect(text).toContain("tick crumb-02");
    expect(text).toContain("tick crumb-21");
    expect(text).not.toContain("crumb-01");
  });

  it("appends two entries under the cap", () => {
    reportCrash({ message: "one", stack: "Error: one", at: AT });
    reportCrash({ message: "two", stack: "Error: two", at: AT });

    const text = readCrashLog();
    expect(crashCount(text)).toBe(2);
    expect(sharedFakeAppFiles.files.has(nativePath(CRASH_LOG_OLD_FILE))).toBe(false);
  });

  it("moves the full file aside and starts again at 200 KB", () => {
    const near = "x".repeat(CRASH_LOG_MAX_BYTES - 10);
    sharedFakeAppFiles.files.set(nativePath(CRASH_LOG_FILE), near);

    reportCrash({ message: "boom", stack: "Error: boom", at: AT });

    const text = readCrashLog();
    expect(utf8Bytes(text)).toBeLessThanOrEqual(CRASH_LOG_MAX_BYTES);
    expect(crashCount(text)).toBe(1);
    expect(text).toContain("message: boom");
    expect(sharedFakeAppFiles.files.get(nativePath(CRASH_LOG_OLD_FILE))).toBe(near);
  });

  it("never throws when the file cannot be written", () => {
    sharedFakeAppFiles.failWrites();

    expect(() =>
      reportCrash({ message: "boom", stack: "Error: boom", at: AT }),
    ).not.toThrow();
    expect(readCrashLog()).toBe("");
  });

  it("writes only to the app's documents folder, never the vault", () => {
    reportCrash({ message: "boom", stack: "Error: boom", at: AT });

    expect(sharedFakeAppFiles.writes.length).toBeGreaterThan(0);
    for (const uri of sharedFakeAppFiles.writes) {
      expect(uri.startsWith(`${DOCUMENT}/monkey-tasks-crash`)).toBe(true);
      expect(uri.startsWith("content://")).toBe(false);
    }
  });

  it("keeps the log in local storage on the web, not the device files", () => {
    platform.os = "web";
    vi.stubGlobal("localStorage", storage);

    reportCrash({ message: "boom", stack: "Error: boom", at: AT });

    expect(storage.values.get("monkey-tasks.crash-log")).toContain("message: boom");
    expect(sharedFakeAppFiles.writes).toEqual([]);
    expect(readCrashLog()).toContain("message: boom");
  });
});

describe("read helpers", () => {
  it("shows the last entry and counts every crash", () => {
    const first = formatCrashEntry({ message: "one", stack: "" }, context());
    const second = formatCrashEntry({ message: "two", stack: "" }, context());

    expect(crashCount(first + second)).toBe(2);
    expect(latestCrashEntry(first + second)).toContain("message: two");
    expect(latestCrashEntry(first + second)).not.toContain("message: one");
    expect(latestCrashEntry("")).toBe("");
  });

  it("counts UTF-8 bytes", () => {
    expect(utf8Bytes("abc")).toBe(3);
    expect(utf8Bytes("é")).toBe(2);
    expect(utf8Bytes("🙂")).toBe(4);
  });
});
