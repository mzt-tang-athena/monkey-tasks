import { beforeEach, describe, expect, it, vi } from "vitest";

const world = vi.hoisted(() => ({
  made: [] as { id: string; options: Record<string, unknown> }[],
  deleted: [] as string[],
  granted: false,
  categories: new Map<string, { identifier: string; buttonTitle: string; options: { opensAppToForeground: boolean } }[]>(),
  armed: new Map<string, { content: Record<string, unknown>; trigger: Record<string, unknown> }>(),
}));

vi.mock("expo-notifications", () => ({
  DEFAULT_ACTION_IDENTIFIER: "expo.modules.notifications.actions.DEFAULT",
  SchedulableTriggerInputTypes: { DATE: "date" },
  AndroidImportance: { MAX: 5, HIGH: 4 },
  AndroidAudioUsage: { ALARM: 4 },
  AndroidAudioContentType: { SONIFICATION: 4 },
  setNotificationHandler: () => undefined,
  setNotificationCategoryAsync: async (
    id: string,
    actions: { identifier: string; buttonTitle: string; options: { opensAppToForeground: boolean } }[],
  ) => {
    world.categories.set(id, actions);
  },
  getPermissionsAsync: async () => ({ granted: true }),
  scheduleNotificationAsync: async (request: {
    identifier: string;
    content: Record<string, unknown>;
    trigger: Record<string, unknown>;
  }) => {
    world.armed.set(request.identifier, {
      content: request.content,
      trigger: request.trigger,
    });
  },
  getAllScheduledNotificationsAsync: async () =>
    [...world.armed.entries()].map(([identifier, request]) => ({
      identifier,
      content: request.content,
      trigger: request.trigger,
    })),
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
  world.armed.clear();
  world.categories.clear();
  vi.resetModules();
});

async function channels() {
  return import("./notifications");
}

const ALARM_RING = {
  id: "alert:a:1",
  uri: "content://vault/Tasks/a.md",
  base: 1,
  weight: "harsh" as const,
  buttons: "full" as const,
  when: 1,
  title: "Take the pill",
  body: "Due",
};

function channelOf(id: string): unknown {
  return world.armed.get(id)?.trigger.channelId;
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
    const { ensureChannels, refreshChannels } = await channels();
    await ensureChannels();
    await ensureChannels();
    expect(world.made).toHaveLength(2);

    world.granted = true;
    await refreshChannels();
    expect(world.made.map((entry) => entry.id)).toContain("reminder-alarm-dnd");
  });

  it("re-arms an armed alarm into the bypass channel when access comes later", async () => {
    const { scheduleRing, refreshChannels } = await channels();
    await scheduleRing(ALARM_RING);
    expect(channelOf(ALARM_RING.id)).toBe("reminder-alarm");

    world.granted = true;
    await refreshChannels();

    expect(channelOf(ALARM_RING.id)).toBe("reminder-alarm-dnd");
    expect(world.armed.size).toBe(1);
    expect(world.armed.get(ALARM_RING.id)?.content).toMatchObject({
      title: "Take the pill",
      body: "Due",
      data: { uri: ALARM_RING.uri, base: 1, weight: "harsh" },
    });
  });

  it("re-arms an alarm a killed process left on the old channel", async () => {
    const first = await channels();
    await first.scheduleRing(ALARM_RING);

    world.granted = true;
    vi.resetModules();
    const second = await channels();
    await second.ensureChannels();

    expect(channelOf(ALARM_RING.id)).toBe("reminder-alarm-dnd");
  });

  it("leaves a normal ring and an older build's ring alone", async () => {
    const { scheduleRing, refreshChannels } = await channels();
    await scheduleRing({ ...ALARM_RING, id: "alert:n:1", weight: "quiet" });
    world.armed.set("alert:old:1:5", {
      content: { data: { uri: "u", base: 1, weight: "harsh", buttons: "full" } },
      trigger: { channelId: "reminders-harsh" },
    });

    world.granted = true;
    await refreshChannels();

    expect(channelOf("alert:n:1")).toBe("reminder-normal");
    expect(channelOf("alert:old:1:5")).toBe("reminders-harsh");
  });
});

describe("the reminder buttons", () => {
  it("offers Done, Snooze and Didn't do, and Snooze alone opens the app", async () => {
    const { ensureChannels } = await channels();
    await ensureChannels();

    const buttons = (id: string) =>
      world.categories
        .get(id)
        ?.map((a) => [a.identifier, a.buttonTitle, a.options.opensAppToForeground]);
    expect(buttons("reminderactions")).toEqual([
      ["done", "Done", false],
      ["snooze", "Snooze", true],
      ["didnt", "Didn't do", false],
    ]);
    expect(buttons("reminderalldayactions")).toEqual([
      ["done", "Done", false],
      ["didnt", "Didn't do", false],
    ]);
    // Android shows three buttons at most.
    for (const actions of world.categories.values()) {
      expect(actions.length).toBeLessThanOrEqual(3);
    }
  });

  it("schedules a ring under the category its buttons name", async () => {
    const { scheduleRing } = await channels();
    await scheduleRing({ ...ALARM_RING, id: "alert:f:1", weight: "quiet" });
    await scheduleRing({
      ...ALARM_RING,
      id: "alert:d:1",
      weight: "quiet",
      buttons: "allday",
    });

    expect(world.armed.get("alert:f:1")?.content.categoryIdentifier).toBe(
      "reminderactions",
    );
    expect(world.armed.get("alert:d:1")?.content.categoryIdentifier).toBe(
      "reminderalldayactions",
    );
  });

  it("arms a ring from the Later and Tomorrow build again under the new buttons", async () => {
    const armedBefore = (id: string, category: string, buttons: string) =>
      world.armed.set(id, {
        content: {
          title: "Call Mum",
          body: "Due",
          categoryIdentifier: category,
          data: { uri: "u", base: 5, weight: "quiet", buttons },
        },
        trigger: { channelId: "reminder-normal" },
      });
    armedBefore("alert:full:5", "reminder", "full");
    armedBefore("alert:done:5", "reminderdone", "done");
    armedBefore("alert:live:5", "reminderactions", "full");
    const { ensureChannels } = await channels();

    await ensureChannels();

    expect(world.armed.get("alert:full:5")?.content).toMatchObject({
      categoryIdentifier: "reminderactions",
      title: "Call Mum",
      data: { buttons: "full", base: 5 },
    });
    expect(world.armed.get("alert:done:5")?.content).toMatchObject({
      categoryIdentifier: "reminderalldayactions",
      data: { buttons: "allday" },
    });
    expect(world.armed.size).toBe(3);
    expect(channelOf("alert:full:5")).toBe("reminder-normal");
  });
});
