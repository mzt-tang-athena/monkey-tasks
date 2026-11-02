import { describe, expect, it } from "vitest";
import { DropZoneMap } from "./dropzone";

type Rect = { x: number; y: number; w: number; h: number };

/** A stand-in for a native view: it reports one fixed page rect. */
function node(rect: Rect) {
  return {
    measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => {
      cb(rect.x, rect.y, rect.w, rect.h);
    },
  };
}

const dayRect: Rect = { x: 0, y: 0, w: 100, h: 100 };

describe("DropZoneMap", () => {
  it("hits the registered id inside its measured rect", () => {
    const zones = new DropZoneMap();
    zones.set("day:2026-10-22", node(dayRect));
    zones.measureAll();
    expect(zones.hit(50, 50)).toBe("day:2026-10-22");
  });

  it("misses outside every rect", () => {
    const zones = new DropZoneMap();
    zones.set("day:2026-10-22", node(dayRect));
    zones.measureAll();
    expect(zones.hit(150, 50)).toBeNull();
    expect(zones.hit(50, 150)).toBeNull();
    expect(zones.hit(-1, -1)).toBeNull();
  });

  it("keeps the rect when the ref drops its node", () => {
    // React re-invokes inline ref callbacks with null on every render,
    // so a drag would lose every rect after its first move if set(id,
    // null) cleared them.
    const zones = new DropZoneMap();
    zones.set("day:2026-10-22", node(dayRect));
    zones.measureAll();
    zones.set("day:2026-10-22", null);
    // The rect outlives the unregistration: a move between the null
    // callback and the next node callback still lands.
    expect(zones.hit(50, 50)).toBe("day:2026-10-22");
    zones.set("day:2026-10-22", node(dayRect));
    expect(zones.hit(50, 50)).toBe("day:2026-10-22");
  });

  it("clears rects at the next measure once an id is unregistered", () => {
    const zones = new DropZoneMap();
    zones.set("day:2026-10-22", node(dayRect));
    zones.measureAll();
    zones.set("day:2026-10-22", null);
    zones.measureAll();
    expect(zones.hit(50, 50)).toBeNull();
  });

  it("clamps hit testing to the visible band", () => {
    const zones = new DropZoneMap();
    zones.set("hour:9", node({ x: 0, y: 0, w: 100, h: 100 }));
    zones.measureAll();
    zones.setClip({ x: 0, y: 0, w: 100, h: 40 });
    expect(zones.hit(50, 20)).toBe("hour:9");
    expect(zones.hit(50, 60)).toBeNull();
  });
});
