import { describe, expect, it } from "vitest";
import { markLanded, takeLanded } from "./entrances";

describe("landed mark", () => {
  it("is taken once", () => {
    markLanded("task:a");
    expect(takeLanded("task:a")).toBe(true);
    expect(takeLanded("task:a")).toBe(false);
  });

  it("belongs to its own id", () => {
    markLanded("task:b");
    expect(takeLanded("task:c")).toBe(false);
    expect(takeLanded("task:b")).toBe(true);
  });
});
