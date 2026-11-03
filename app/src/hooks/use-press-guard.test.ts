import { describe, expect, it } from "vitest";
import { makePressGuard, pressGuardMs } from "./use-press-guard";

function clock() {
  let at = 1000;
  return {
    now: () => at,
    tick: (ms: number) => {
      at += ms;
    },
  };
}

describe("makePressGuard", () => {
  it("lets a press through when no gesture ran", () => {
    expect(makePressGuard().blocked()).toBe(false);
  });

  it("blocks a press while a gesture runs", () => {
    const guard = makePressGuard();

    guard.arm();

    expect(guard.blocked()).toBe(true);
    expect(guard.blocked()).toBe(true);
  });

  it("blocks the click after the gesture, once", () => {
    const time = clock();
    const guard = makePressGuard(time.now);
    guard.arm();
    guard.release();

    expect(guard.blocked()).toBe(true);
    expect(guard.blocked()).toBe(false);
  });

  it("lets a press through after the window passes", () => {
    const time = clock();
    const guard = makePressGuard(time.now);
    guard.arm();
    guard.release();

    time.tick(pressGuardMs + 1);

    expect(guard.blocked()).toBe(false);
  });
});
