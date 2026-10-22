/**
 * A registry of drop targets for the hand-rolled drag system.
 *
 * Touch pointers hold an implicit capture on their pointerdown
 * target, so pointerenter/pointerleave never fire on other views
 * while a drag is in flight - which made drop targeting mouse-only.
 * This breaks that dependency: each drop zone registers its view,
 * the drag measures the page-space rects once at promotion, and the
 * move handler hit-tests page coordinates against those rects.
 * One pointer path then serves mouse and touch alike.
 */
export class DropZoneMap {
  private views = new Map<string, { measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void } | null>();
  private rects = new Map<string, { x: number; y: number; w: number; h: number }>();
  private clip: { x: number; y: number; w: number; h: number } | null = null;

  /** Register a view node under a drop id. Call from ref callbacks. */
  set(id: string, node: { measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void } | null) {
    if (node != null) {
      this.views.set(id, node);
    }
  }

  /** True when any rects are measured for the active drag. */
  get measured(): boolean {
    return this.rects.size > 0;
  }

  /**
   * Measure every registered zone in page space. Call when a press
   * is promoted to a drag; measurement is async, so the first few
   * moves may hit against a partial set.
   */
  measureAll(cb?: () => void): void {
    this.rects.clear();
    let pending = this.views.size;
    if (pending === 0) {
      cb?.();
      return;
    }
    const onRect = () => {
      pending -= 1;
      if (pending <= 0) {
        cb?.();
      }
    };
    for (const [id, view] of this.views) {
      const node = view as { measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void } | null;
      if (node?.measureInWindow) {
        node.measureInWindow((x, y, w, h) => {
          this.rects.set(id, { x, y, w, h });
          onRect();
        });
      } else {
        onRect();
      }
    }
  }

  /** The drop id holding the page point, or null when outside all. */
  /** The visible band drops belong to. Hit-testing clamps every
      rect to it, so drop zones scrolled out of their scroller -
      whose layout rects stretch invisibly under neighbors - never
      catch a drop. Acid: measured once per drag, fresh rects. */
  setClip(rect: { x: number; y: number; w: number; h: number } | null) {
    this.clip = rect;
  }

  hit(x: number, y: number): string | null {
    for (const [id, rect] of this.rects) {
      let rx = rect.x;
      let ry = rect.y;
      let rw = rect.w;
      let rh = rect.h;
      if (this.clip != null) {
        rx = Math.max(rx, this.clip.x);
        ry = Math.max(ry, this.clip.y);
        rw = Math.min(rect.x + rect.w, this.clip.x + this.clip.w) - rx;
        rh = Math.min(rect.y + rect.h, this.clip.y + this.clip.h) - ry;
        if (rw <= 0 || rh <= 0) {
          continue;
        }
      }
      if (x >= rx && x < rx + rw && y >= ry && y < ry + rh) {
        return id;
      }
    }
    return null;
  }
}

/**
 * Web-only style: a drag starting on a task card belongs to the
 * card, not to the browser's scroll consumer. Without it, touch
 * drags hand off to the pane's pan-y/pan-x scrolling after the
 * first move, and pointer events stop arriving. Sans effect on
 * native, where the Android gesture library owns routing.
 */
export const touchNoScroll = {
  touchAction: "none",
} as unknown as import("react-native").ViewStyle;
