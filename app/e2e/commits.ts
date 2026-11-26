import type { Page } from "@playwright/test";

/** What one commit left in the DOM: the rows in order, by the id each
    reorder item carries, and whether the drag ghost was mounted. */
export type CommitOrder = { order: string[]; ghost: boolean };

/**
 * Sample the DOM after every commit from now until the reader is
 * called. A mutation observer runs in a microtask, so it records a
 * commit even while the page clock is paused, which is the state a
 * held cache notification leaves: a drop's ghost leaves and its order
 * stays behind until the clock runs.
 *
 * Each sample is taken once per microtask, so a commit's many
 * mutations make one sample.
 */
export async function sampleCommits(
  page: Page,
  testIDPrefix: string,
): Promise<() => Promise<CommitOrder[]>> {
  await page.evaluate((prefix) => {
    const commits: { order: string[]; ghost: boolean }[] = [];
    (window as unknown as { commits: typeof commits }).commits = commits;
    let queued = false;
    const sample = () => {
      queued = false;
      const items = [
        ...document.querySelectorAll(`[data-testid^="${prefix}"]`),
      ];
      commits.push({
        order: items.map((item) =>
          (item.getAttribute("data-testid") ?? "").slice(prefix.length),
        ),
        ghost: document.querySelector('[data-testid="drag-ghost"]') != null,
      });
    };
    new MutationObserver(() => {
      if (queued) {
        return;
      }
      queued = true;
      queueMicrotask(sample);
    }).observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["style"],
    });
    sample();
  }, testIDPrefix);
  return () =>
    page.evaluate(
      () => (window as unknown as { commits: CommitOrder[] }).commits,
    );
}

/**
 * The commits that drew the old order after the drop let go. The drop
 * is the commit that unmounts the ghost: the surface clears its shifts
 * and its lift there. A drop that lets go before its order lands draws
 * at least one old-order commit after that point, and the new order
 * comes in a later commit. An empty list is the proof.
 *
 * The first commit is the order before the drag, and the last is the
 * order it settled at, so a test reads them after the drop has come to
 * rest. A pair that never changed means the drop never landed, and
 * that fails here rather than passing on an empty list.
 */
export function commitsThatWentBack(commits: CommitOrder[]): CommitOrder[] {
  const first = commits[0];
  const last = commits[commits.length - 1];
  if (first == null || last == null) {
    throw new Error("no commits were sampled");
  }
  const before = first.order;
  const after = last.order;
  const isOrder = (commit: CommitOrder, order: readonly string[]) =>
    commit.order.length === order.length &&
    order.every((name, at) => commit.order[at] === name);
  if (isOrder(first, after)) {
    throw new Error(
      `the drop never changed the order: ${after.slice(0, 3).join(", ")}`,
    );
  }
  const dropped = commits.findLastIndex((commit) => commit.ghost);
  if (dropped === -1) {
    throw new Error("no pickup was sampled, so there was no drop");
  }
  const afterDrop = commits.slice(dropped + 1);
  if (!afterDrop.some((commit) => isOrder(commit, after))) {
    throw new Error(
      `no commit after the drop drew the new order: ${JSON.stringify(
        afterDrop.map((commit) => commit.order[0]),
      )}`,
    );
  }
  return afterDrop.filter((commit) => isOrder(commit, before));
}
