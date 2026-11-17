import { beforeEach, describe, expect, it, vi } from "vitest";

// One group stays acknowledged for an escalation window. A rebuild
// after a restart reads the same file, so it measures the file API
// against a fake documents folder.

vi.mock("react-native", () => ({ Platform: { OS: "android" } }));
vi.mock("expo-file-system", async () => {
  const { sharedFakeAppFiles } = await import("@/testing/fake-app-files");
  return {
    File: sharedFakeAppFiles.File,
    Paths: { document: sharedFakeAppFiles.document },
  };
});

import {
  ACK_TTL_MS,
  ackKey,
  isAcked,
  loadAcked,
  pruneAcked,
  recordAcks,
  withAcks,
  type AckedGroups,
} from "./acked";
import { sharedFakeAppFiles } from "@/testing/fake-app-files";

const NOW = new Date("2026-11-16T09:00:00.000Z").getTime();
const MINUTE = 60_000;
const URI = "content://vault/Tasks/Call%20Mum.md";

function minutesAgo(minutes: number): number {
  return NOW - minutes * MINUTE;
}

beforeEach(() => {
  sharedFakeAppFiles.reset();
});

describe("pruneAcked", () => {
  it("drops entries older than 20 minutes", () => {
    const acked: AckedGroups = {
      [ackKey(URI, 1)]: minutesAgo(21),
      [ackKey(URI, 2)]: minutesAgo(20),
      [ackKey(URI, 3)]: minutesAgo(1),
    };
    expect(pruneAcked(acked, NOW)).toEqual({
      [ackKey(URI, 2)]: minutesAgo(20),
      [ackKey(URI, 3)]: minutesAgo(1),
    });
    expect(ACK_TTL_MS).toBe(20 * MINUTE);
  });

  it("drops a value that is not a timestamp", () => {
    const acked = { [ackKey(URI, 1)]: "soon" } as unknown as AckedGroups;
    expect(pruneAcked(acked, NOW)).toEqual({});
  });
});

describe("withAcks", () => {
  it("keeps the first time a group was acknowledged", () => {
    const acked = withAcks({}, [{ uri: URI, base: 1 }], minutesAgo(5));
    const later = withAcks(acked, [{ uri: URI, base: 1 }], NOW);
    expect(later[ackKey(URI, 1)]).toBe(minutesAgo(5));
  });
});

describe("the stored file", () => {
  it("persists a group so a restart still knows it", () => {
    recordAcks([{ uri: URI, base: 1 }], NOW);

    const loaded = loadAcked(NOW + MINUTE);

    expect(isAcked(loaded, URI, 1)).toBe(true);
    expect(loaded[ackKey(URI, 1)]).toBe(NOW);
  });

  it("prunes an expired group when it reads", () => {
    sharedFakeAppFiles.files.set(
      "file:///documents/monkey-tasks-acked-alerts.json",
      JSON.stringify({
        [ackKey(URI, 1)]: minutesAgo(30),
        [ackKey(URI, 2)]: minutesAgo(2),
      }),
    );

    expect(loadAcked(NOW)).toEqual({ [ackKey(URI, 2)]: minutesAgo(2) });
    expect(
      sharedFakeAppFiles.files.get(
        "file:///documents/monkey-tasks-acked-alerts.json",
      ),
    ).toBe(JSON.stringify({ [ackKey(URI, 2)]: minutesAgo(2) }));
  });

  it("starts empty when the file is missing or broken", () => {
    expect(loadAcked(NOW)).toEqual({});
    sharedFakeAppFiles.files.set(
      "file:///documents/monkey-tasks-acked-alerts.json",
      "{not json",
    );
    expect(loadAcked(NOW)).toEqual({});
  });

  it("writes nothing for an empty acknowledgement", () => {
    recordAcks([], NOW);
    expect(sharedFakeAppFiles.writes).toEqual([]);
  });
});
