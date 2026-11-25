import { beforeEach, describe, expect, it, vi } from "vitest";

// A button press that failed keeps a record, so the app can show it
// after a restart. The app itself can then do the thing, and the record
// must go. These tests keep the record in the fake documents folder.

vi.mock("react-native", () => ({ Platform: { OS: "android" } }));
vi.mock("expo-file-system", async () => {
  const { sharedFakeAppFiles } = await import("@/testing/fake-app-files");
  return {
    File: sharedFakeAppFiles.File,
    Paths: { document: sharedFakeAppFiles.document },
  };
});

import {
  clearActionFailure,
  clearActionFailuresFor,
  failureId,
  loadActionFailures,
  recordActionFailure,
  type ActionFailure,
} from "./action-failures";
import { sharedFakeAppFiles } from "@/testing/fake-app-files";

const URI = "content://vault/Tasks/Call%20Mum.md";
const OTHER = "content://vault/Tasks/Stretch.md";

function failure(
  id: string,
  uri: string,
  action: ActionFailure["action"],
): ActionFailure {
  return { id, uri, name: "Call Mum", action, message: "disk full", at: 1 };
}

beforeEach(() => {
  sharedFakeAppFiles.reset();
});

describe("action failures", () => {
  it("keeps one record per task and action", () => {
    recordActionFailure(failure("a", URI, { kind: "done" }));
    recordActionFailure(failure("b", URI, { kind: "done" }));

    expect(loadActionFailures()).toMatchObject([{ id: "b" }]);
  });

  it("drops the records of one action on one task", () => {
    recordActionFailure(failure("a", URI, { kind: "done" }));
    recordActionFailure(
      failure("b", URI, { kind: "reschedule", target: "2026-11-26T09:00" }),
    );
    recordActionFailure(failure("c", OTHER, { kind: "done" }));

    expect(clearActionFailuresFor(URI, "done")).toEqual(["a"]);
    expect(loadActionFailures().map((entry) => entry.id)).toEqual(["b", "c"]);
  });

  it("leaves every record alone when nothing matches", () => {
    recordActionFailure(failure("a", URI, { kind: "done" }));

    expect(clearActionFailuresFor(OTHER, "done")).toEqual([]);
    expect(loadActionFailures()).toHaveLength(1);
  });

  it("drops one record by id", () => {
    recordActionFailure(failure("a", URI, { kind: "done" }));

    clearActionFailure("a");

    expect(loadActionFailures()).toEqual([]);
  });

  it("names a record by its task and action", () => {
    expect(failureId(URI, { kind: "done" })).toBe(`${URI}|done`);
  });
});
