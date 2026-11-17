import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const alert = vi.hoisted(() => vi.fn());
const platform = vi.hoisted(() => ({ os: "android" }));

vi.mock("react-native", () => ({
  Alert: { alert },
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

import { installErrorAlert } from "./errors";
import { crashCount, readCrashLog } from "./crash-log";
import { resetBreadcrumbs } from "./breadcrumbs";
import { sharedFakeAppFiles } from "@/testing/fake-app-files";

type Handler = (error: unknown, isFatal?: boolean) => void;

let handler: Handler | undefined;

beforeEach(() => {
  sharedFakeAppFiles.reset();
  resetBreadcrumbs();
  platform.os = "android";
  alert.mockClear();
  handler = undefined;
  (globalThis as { ErrorUtils?: unknown }).ErrorUtils = {
    setGlobalHandler: (next: Handler) => {
      handler = next;
    },
  };
});

afterEach(() => {
  delete (globalThis as { ErrorUtils?: unknown }).ErrorUtils;
});

describe("installErrorAlert", () => {
  it("reports a forced JS error before it shows the dialog", () => {
    installErrorAlert();

    handler?.(new Error("boom"), true);

    const text = readCrashLog();
    expect(crashCount(text)).toBe(1);
    expect(text).toContain("kind=js fatal=yes");
    expect(text).toContain("message: boom");
    expect(text).toContain("app=1.0.0");
    expect(text).toContain("platform=android");
    expect(text).toContain("stack:");
    expect(alert).toHaveBeenCalledTimes(1);
  });

  it("keeps a non-fatal error in the log with fatal=no", () => {
    installErrorAlert();

    handler?.(new Error("quiet"), false);

    expect(readCrashLog()).toContain("kind=js fatal=no");
    expect(readCrashLog()).toContain("message: quiet");
  });

  it("reports a thrown value that is not an Error", () => {
    installErrorAlert();

    handler?.("not an error", true);

    expect(readCrashLog()).toContain("message: not an error");
  });

  it("does nothing on the web", () => {
    platform.os = "web";
    installErrorAlert();

    expect(handler).toBeUndefined();
  });
});
