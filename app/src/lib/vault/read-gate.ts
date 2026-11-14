import { hashKey, type QueryClient, type QueryKey } from "@tanstack/react-query";

/**
 * How vault reads and vault writes take turns (ADR 0017, ADR 0037).
 *
 * A read never lands over a write. A read that starts while a write is
 * pending waits for the queue to drain. A write that starts while a
 * read runs cancels the read and marks it deferred, and the last write
 * to settle runs it again. No other read follows a write.
 */

/** The first part of every vault mutation key, and their one scope. */
export const VAULT_SCOPE = "vault";

/** The reads a write cancelled, per client, by query hash. */
const deferred = new WeakMap<QueryClient, Map<string, QueryKey>>();

function writing(client: QueryClient): boolean {
  return client.isMutating({ mutationKey: [VAULT_SCOPE] }) > 0;
}

/**
 * Resolve once no vault write is pending. A read awaits this before it
 * touches the vault. An aborted read stops waiting and rejects, so a
 * cancelled read never reads the vault at all.
 */
export function vaultIdle(
  client: QueryClient,
  signal?: AbortSignal,
): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(signal.reason);
  }
  if (!writing(client)) {
    return Promise.resolve();
  }
  return new Promise<void>((resolve, reject) => {
    const stop = () => {
      unsubscribe();
      signal?.removeEventListener("abort", abort);
    };
    const abort = () => {
      stop();
      reject(signal?.reason);
    };
    const unsubscribe = client.getMutationCache().subscribe(() => {
      if (!writing(client)) {
        stop();
        resolve();
      }
    });
    signal?.addEventListener("abort", abort);
  });
}

/**
 * Cancel the read of `queryKey` for a write. When a read was in
 * flight, it is marked deferred. The cancel takes effect at once, so
 * the caller can write the cache right after this call returns.
 */
export function deferRead(
  client: QueryClient,
  queryKey: QueryKey,
): Promise<void> {
  const state = client.getQueryState(queryKey);
  if (state != null && state.fetchStatus !== "idle") {
    const keys = deferred.get(client) ?? new Map<string, QueryKey>();
    keys.set(hashKey(queryKey), queryKey);
    deferred.set(client, keys);
  }
  return client.cancelQueries({ queryKey, exact: true });
}

/**
 * Run again every read a write cancelled. Only the last vault write to
 * settle calls this. The read still waits for that write to leave the
 * pending state before it reads.
 */
export function runDeferredReads(client: QueryClient): void {
  const keys = deferred.get(client);
  if (keys == null) {
    return;
  }
  deferred.delete(client);
  for (const queryKey of keys.values()) {
    void client.refetchQueries({ queryKey, exact: true });
  }
}
