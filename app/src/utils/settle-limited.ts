/**
 * Run `fn` over every item, with at most `limit` runs in flight, and
 * settle each one. The results come back in the items' order, shaped as
 * `Promise.allSettled` shapes them, so one failure stays one entry.
 *
 * A vault with a thousand notes would otherwise ask the provider for a
 * thousand reads at once. At most `limit` run, and the next starts as
 * one settles, so a slow item holds one slot rather than the list.
 */
export async function settleLimited<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results = new Array<PromiseSettledResult<R>>(items.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const at = next;
      next += 1;
      try {
        results[at] = { status: "fulfilled", value: await fn(items[at], at) };
      } catch (reason) {
        results[at] = { status: "rejected", reason };
      }
    }
  };
  const workers = Array.from(
    { length: Math.min(Math.max(1, limit), items.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}
