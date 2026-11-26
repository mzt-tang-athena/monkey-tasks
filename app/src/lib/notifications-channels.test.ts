import { beforeEach, describe, expect, it, vi } from "vitest";

const world = vi.hoisted(() => ({
  made: [] as { id: string; options: Record<string, unknown> }[],
  deleted: [] as string[],
  granted: false,
}));

vi.mock("expo-notifications", () => ({
  DEFAULT_ACTION_IDENTIFIER: "expo.modules.notifications.actions.DEFAULT",
  SchedulableTriggerInputTypes: { DATE: "date" },
  AndroidImportance: { MAX: 5, HIGH: 4 },
  AndroidAudioUsage: { ALARM: 4 },
  AndroidAudioContentType: { SONIFICATION: 4 },
  setNotificationHandler: () => undefined,
  setNotificationCategoryAsync: async () => undefined,
  setNotificationChannelAsync: async (id: string, options: object) => {
    world.made.push({ id, options: options as Record<string, unknown> });
  },
  deleteNotificationChannelAsync: async (id: string) => {
    world.deleted.push(id);
  },
}));

vi.mock("alarm-access", () => ({
  default: {
    hasDndAccess: () => world.granted,
    openDndAccess: () => undefined,
  },
}));

beforeEach(() => {
  world.made.length = 0;
  world.deleted.length = 0;
  world.granted = false;
  vi.resetModules();
});

async function channels(): Promise<{
  ensureChannels: () => Promise<void>;
}> {
  return import("./notifications");
}

describe("the reminder channels", () => {
  it("makes a normal channel and an alarm channel without the bypass", async () => {
    const { ensureChannels } = await channels();
    await ensureChannels();

    const ids = world.made.map((entry) => entry.id);
    expect(ids).toEqual(["reminder-normal", "reminder-alarm"]);
    expect(world.made[1].options).toMatchObject({
      sound: "alarm.wav",
      bypassDnd: false,
    });
    expect(world.deleted).toEqual(
      expect.arrayContaining([
        "reminders",
        "reminders-harsh",
        "reminders-quiet",
        "reminder-alarm-dnd",
      ]),
    );
  });

  it("makes the alarm channel with the bypass once the phone grants access", async () => {
    world.granted = true;
    const { ensureChannels } = await channels();
    await ensureChannels();

    expect(world.made.map((entry) => entry.id)).toEqual([
      "reminder-normal",
      "reminder-alarm-dnd",
    ]);
    expect(world.made[1].options).toMatchObject({ bypassDnd: true });
    expect(world.deleted).toContain("reminder-alarm");
  });

  it("makes the channels once, and again on a foreground refresh", async () => {
    const { ensureChannels, refreshChannels } = (await channels()) as {
      ensureChannels: () => Promise<void>;
      refreshChannels: () => Promise<void>;
    };
    await ensureChannels();
    await ensureChannels();
    expect(world.made).toHaveLength(2);

    world.granted = true;
    await refreshChannels();
    expect(world.made.map((entry) => entry.id)).toContain("reminder-alarm-dnd");
  });
});
