import { describe, expect, it } from "vitest";
import { idle, step, type DragEffect, type DragEvent, type DragState } from "./drag-machine";

function run(events: DragEvent[], from: DragState = idle) {
  let state = from;
  const effects: DragEffect[] = [];
  for (const event of events) {
    const next = step(state, event);
    state = next.state;
    effects.push(next.effect);
  }
  return { state, effects: effects.filter((effect) => effect !== "none") };
}

describe("drag machine", () => {
  it("picks up, drops and settles", () => {
    const { state, effects } = run([
      { type: "begin", source: 1 },
      { type: "activate", source: 1 },
      { type: "release", source: 1, canceled: false },
      { type: "finalize", source: 1 },
      { type: "settled" },
    ]);
    expect(effects).toEqual(["pickup", "drop"]);
    expect(state).toEqual(idle);
  });

  it("flushes a settle when a begin arrives, then waits again", () => {
    const settling = run([
      { type: "begin", source: 1 },
      { type: "activate", source: 1 },
      { type: "release", source: 1, canceled: false },
    ]).state;
    expect(settling.phase).toBe("settling");
    const next = step(settling, { type: "begin", source: 2 });
    expect(next.effect).toBe("flush");
    expect(next.state.phase).toBe("pending");
    expect(step(next.state, { type: "activate", source: 2 }).effect).toBe("pickup");
  });

  it("cancels a canceled release and never drops it", () => {
    const { effects } = run([
      { type: "begin", source: 1 },
      { type: "activate", source: 1 },
      { type: "release", source: 1, canceled: true },
      { type: "finalize", source: 1 },
      { type: "settled" },
    ]);
    expect(effects).toEqual(["pickup", "cancel"]);
  });

  it("lets the first source to activate own the drag", () => {
    const { effects, state } = run([
      { type: "begin", source: 1 },
      { type: "begin", source: 2 },
      { type: "activate", source: 2 },
      { type: "activate", source: 1 },
      { type: "release", source: 1, canceled: false },
      { type: "finalize", source: 1 },
    ]);
    expect(effects).toEqual(["pickup"]);
    expect(state).toEqual({ phase: "dragging", owner: 2 });
    const after = run(
      [
        { type: "release", source: 2, canceled: false },
        { type: "activate", source: 1 },
        { type: "release", source: 1, canceled: false },
        { type: "settled" },
        { type: "begin", source: 1 },
        { type: "activate", source: 1 },
      ],
      state,
    );
    expect(after.effects).toEqual(["drop", "pickup"]);
    expect(after.state.owner).toBe(1);
  });

  it("emits nothing for a finalize from pending", () => {
    const { effects, state } = run([
      { type: "begin", source: 1 },
      { type: "finalize", source: 1 },
    ]);
    expect(effects).toEqual([]);
    expect(state).toEqual(idle);
  });

  it("cancels a drag whose owner finalizes with no release", () => {
    const { effects } = run([
      { type: "begin", source: 1 },
      { type: "activate", source: 1 },
      { type: "finalize", source: 1 },
    ]);
    expect(effects).toEqual(["pickup", "cancel"]);
  });

  it("follows every pickup with exactly one drop or cancel", () => {
    // A seeded walk over every event from three sources.
    let seed = 7;
    const random = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    const pick = (): DragEvent => {
      const source = 1 + Math.floor(random() * 3);
      switch (Math.floor(random() * 6)) {
        case 0:
          return { type: "begin", source };
        case 1:
          return { type: "activate", source };
        case 2:
          return { type: "release", source, canceled: false };
        case 3:
          return { type: "release", source, canceled: true };
        case 4:
          return { type: "finalize", source };
        default:
          return { type: "settled" };
      }
    };
    let state = idle;
    let open = false;
    let pickups = 0;
    for (let i = 0; i < 20_000; i++) {
      const { state: next, effect } = step(state, pick());
      state = next;
      if (effect === "pickup") {
        expect(open).toBe(false);
        open = true;
        pickups += 1;
      } else if (effect === "drop" || effect === "cancel") {
        expect(open).toBe(true);
        open = false;
      }
      expect(open).toBe(state.phase === "dragging");
    }
    expect(pickups).toBeGreaterThan(100);
  });
});
