import { beforeEach, describe, expect, it } from "vitest";
import {
  BREADCRUMB_LIMIT,
  readBreadcrumbs,
  recordBreadcrumb,
  resetBreadcrumbs,
} from "./breadcrumbs";

beforeEach(() => {
  resetBreadcrumbs();
});

describe("breadcrumbs", () => {
  it("keeps the last 20 actions in order", () => {
    for (let i = 1; i <= 25; i += 1) {
      recordBreadcrumb("tick", `task-${i}`);
    }

    const crumbs = readBreadcrumbs();
    expect(crumbs).toHaveLength(BREADCRUMB_LIMIT);
    expect(crumbs[0].detail).toBe("task-6");
    expect(crumbs[crumbs.length - 1].detail).toBe("task-25");
  });

  it("collapses whitespace and clips a long detail", () => {
    recordBreadcrumb("open", `  Water\n the\tplants ${"x".repeat(120)}`);

    const [crumb] = readBreadcrumbs();
    expect(crumb.detail?.startsWith("Water the plants ")).toBe(true);
    expect(crumb.detail?.length).toBe(80);
  });

  it("records an action with no detail", () => {
    recordBreadcrumb("drag-start", "   ");

    expect(readBreadcrumbs()).toEqual([
      { at: expect.any(String), kind: "drag-start", detail: undefined },
    ]);
  });

  it("hands out a copy, so a reader cannot change the ring", () => {
    recordBreadcrumb("tab", "Main");
    const crumbs = readBreadcrumbs();
    crumbs[0].detail = "changed";

    expect(readBreadcrumbs()[0].detail).toBe("Main");
  });
});
