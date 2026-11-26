import { describe, expect, it } from "vitest";
import { settleLimited } from "./settle-limited";

/**
 * A gate a run waits on, so a test can hold runs in flight and count
 * them. `open()` releases every waiting run.
 */
function gate() {
  let open: () => void = () => undefined;
  const opened = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { wait: () => opened, open };
}

function counter() {
  let inFlight = 0;
  let most = 0;
  return {
    start() {
      inFlight += 1;
      most = Math.max(most, inFlight);
    },
    end() {
      inFlight -= 1;
    },
    get most() {
      return most;
    },
  };
}

describe("settleLimited", () => {
  it("never runs more than the limit at once", async () => {
    const items = Array.from({ length: 100 }, (_, at) => at);
    const held = gate();
    const counts = counter();
    const done: number[] = [];

    const run = settleLimited(items, 32, async (item) => {
      counts.start();
      await held.wait();
      counts.end();
      done.push(item);
      return item;
    });
    // Let every worker reach its first read, and no further.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(counts.most).toBe(32);
    expect(done).toHaveLength(0);

    held.open();
    const results = await run;

    expect(counts.most).toBe(32);
    expect(results).toHaveLength(100);
    expect(
      results.every((result, at) => result.status === "fulfilled" && result.value === at),
    ).toBe(true);
  });

  it("reads every item when the limit divides the count neither way", async () => {
    const items = Array.from({ length: 7 }, (_, at) => at);
    const results = await settleLimited(items, 3, async (item) => item * 2);

    expect(results.map((r) => (r.status === "fulfilled" ? r.value : null))).toEqual([
      0, 2, 4, 6, 8, 10, 12,
    ]);
  });

  it("keeps one failure as one settled entry, in order", async () => {
    const items = ["a", "b", "c", "d"];
    const results = await settleLimited(items, 2, async (item) => {
      if (item === "b") {
        throw new Error("cannot read b");
      }
      return item.toUpperCase();
    });

    expect(results[0]).toEqual({ status: "fulfilled", value: "A" });
    expect(results[1].status).toBe("rejected");
    expect(results[2]).toEqual({ status: "fulfilled", value: "C" });
    expect(results[3]).toEqual({ status: "fulfilled", value: "D" });
  });

  it("takes an empty list and a limit of zero", async () => {
    expect(await settleLimited([], 32, async (item) => item)).toEqual([]);
    expect(await settleLimited([1, 2], 0, async (item) => item)).toHaveLength(2);
  });
});
