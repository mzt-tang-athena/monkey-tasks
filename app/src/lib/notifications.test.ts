import { describe, expect, it, vi } from "vitest";

vi.mock("expo-notifications", () => ({
  DEFAULT_ACTION_IDENTIFIER: "expo.modules.notifications.actions.DEFAULT",
  SchedulableTriggerInputTypes: { DATE: "date" },
  AndroidImportance: { MAX: 5, DEFAULT: 3 },
  AndroidAudioUsage: { ALARM: 4 },
  AndroidAudioContentType: { SONIFICATION: 4 },
  setNotificationHandler: () => undefined,
}));

import { isButtonPayload, readTaskResponse } from "./notifications";

const DEFAULT = "expo.modules.notifications.actions.DEFAULT";
const URI = "content://vault/Tasks/Call%20Mum.md";

function payload(content: Record<string, unknown>, actionIdentifier: string) {
  return {
    actionIdentifier,
    notification: {
      date: 1,
      request: { identifier: "alert:abc:0", content: { title: "Call Mum", ...content } },
    },
  };
}

describe("readTaskResponse", () => {
  it("reads the data a background task gets as JSON text", () => {
    const dataString = JSON.stringify({ uri: URI, base: 5, weight: "harsh" });

    expect(readTaskResponse(payload({ dataString }, "done"))).toEqual({
      uri: URI,
      base: 5,
      name: "Call Mum",
      button: "done",
      key: "alert:abc:0|done",
    });
  });

  it("reads data that is already an object", () => {
    expect(
      readTaskResponse(payload({ data: { uri: URI } }, "done")),
    ).toMatchObject({ uri: URI, button: "done" });
  });

  it("reads a tap on the notification as no button", () => {
    const response = readTaskResponse(
      payload({ dataString: JSON.stringify({ uri: URI }) }, DEFAULT),
    );

    expect(response).not.toBeNull();
    expect(response?.button).toBeUndefined();
  });

  it("reads nothing from data that is not a task's", () => {
    expect(readTaskResponse(payload({ dataString: "not json" }, "done"))).toBeNull();
    expect(readTaskResponse(payload({ dataString: "{}" }, "done"))).toBeNull();
    expect(readTaskResponse({ remote: true })).toBeNull();
    expect(readTaskResponse(null)).toBeNull();
  });
});

describe("isButtonPayload", () => {
  it("is true for a button and false for a tap or other data", () => {
    expect(isButtonPayload(payload({}, "done"))).toBe(true);
    expect(isButtonPayload(payload({}, DEFAULT))).toBe(false);
    expect(isButtonPayload({ remote: true })).toBe(false);
  });
});
