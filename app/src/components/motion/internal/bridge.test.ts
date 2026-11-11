import { describe, expect, it, vi } from "vitest";
import { createBridgeGuard } from "./bridge";

/** The root's three ends of a pickup, as it wires them to the guard. */
function root() {
  const guard = createBridgeGuard();
  const onDrop = vi.fn();
  const cancel = vi.fn();
  return {
    onDrop,
    cancel,
    guard,
    pickup: (generation: number) => guard.pickup(generation),
    drop: (generation: number) => {
      if (guard.settle(generation)) {
        onDrop();
      }
    },
    unmount: () => {
      if (guard.close()) {
        cancel();
      }
    },
  };
}

describe("bridge guard", () => {
  it("runs onDrop once when the drop beats the unmount", () => {
    const r = root();
    r.pickup(1);
    r.drop(1);
    r.unmount();
    r.drop(1);
    expect(r.onDrop).toHaveBeenCalledTimes(1);
    expect(r.cancel).not.toHaveBeenCalled();
  });

  it("runs the cancel once when the unmount beats the drop", () => {
    const r = root();
    r.pickup(1);
    r.unmount();
    r.drop(1);
    r.unmount();
    expect(r.cancel).toHaveBeenCalledTimes(1);
    expect(r.onDrop).not.toHaveBeenCalled();
  });

  it("ignores a drop that carries an old generation", () => {
    const r = root();
    r.pickup(1);
    r.drop(1);
    r.pickup(2);
    r.drop(1);
    expect(r.onDrop).toHaveBeenCalledTimes(1);
    r.drop(2);
    expect(r.onDrop).toHaveBeenCalledTimes(2);
  });

  it("ignores a pickup that lands after a newer one", () => {
    const r = root();
    expect(r.pickup(2)).toBe(true);
    expect(r.pickup(1)).toBe(false);
  });

  it("drops a measure that lands after a newer pickup", () => {
    const { guard } = root();
    guard.pickup(1);
    expect(guard.fresh(1)).toBe(true);
    guard.pickup(2);
    expect(guard.fresh(1)).toBe(false);
    expect(guard.fresh(2)).toBe(true);
  });
});
