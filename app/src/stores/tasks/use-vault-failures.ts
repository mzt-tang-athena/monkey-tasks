import * as React from "react";
import {
  MutationObserver,
  useMutationState,
  useQueryClient,
  type Mutation,
  type QueryClient,
} from "@tanstack/react-query";
import { VAULT_SCOPE } from "@/lib/vault/read-gate";
import { messageOf, type VaultMeta } from "./mutations/use-vault-mutation";

type Entry = {
  /** Stable for the entry's life, for a React key. */
  key: number;
  kind: "failure" | "notice";
  /** The write's label, for example "tick". */
  label: string;
  message: string;
};

/** One line in the failure list: a write that failed, or a notice. */
export type VaultFailure = Omit<Entry, "kind"> & {
  /** Take the entry off the list. */
  dismiss(): void;
} & (
    | {
        kind: "failure";
        /** Run the same write again, as a new mutation. */
        retry(): void;
      }
    | { kind: "notice" }
  );

function noticeOf(data: unknown): string | null {
  if (typeof data !== "object" || data == null || !("notice" in data)) {
    return null;
  }
  const { notice } = data as { notice?: unknown };
  return typeof notice === "string" ? notice : null;
}

function entryOf(mutation: Mutation<unknown, Error, unknown, unknown>): Entry | null {
  const meta = mutation.options.meta as VaultMeta | undefined;
  if (meta == null || !meta.listed) {
    return null;
  }
  const { state } = mutation;
  if (state.status === "error") {
    return {
      key: mutation.mutationId,
      kind: "failure",
      label: meta.label,
      message: messageOf(state.error),
    };
  }
  const notice = state.status === "success" ? noticeOf(state.data) : null;
  return notice == null
    ? null
    : { key: mutation.mutationId, kind: "notice", label: meta.label, message: notice };
}

function find(client: QueryClient, key: number) {
  return client
    .getMutationCache()
    .getAll()
    .find((mutation) => mutation.mutationId === key);
}

/**
 * The failed vault writes and the notices, oldest first. Each entry
 * stays until it is dismissed or retried. A retry runs the same write,
 * with the same variables, as a new mutation, and drops the old entry.
 * The read's own error stays on the query.
 */
export function useVaultFailures(): VaultFailure[] {
  const client = useQueryClient();
  const entries = useMutationState({
    filters: { mutationKey: [VAULT_SCOPE] },
    select: entryOf,
  });
  return React.useMemo(
    () =>
      entries.flatMap((entry): VaultFailure[] => {
        if (entry == null) {
          return [];
        }
        const dismiss = () => {
          const mutation = find(client, entry.key);
          if (mutation != null) {
            client.getMutationCache().remove(mutation);
          }
        };
        const retry = () => {
          const mutation = find(client, entry.key);
          if (mutation == null) {
            return;
          }
          const observer = new MutationObserver(client, mutation.options);
          void observer.mutate(mutation.state.variables).catch(() => undefined);
          client.getMutationCache().remove(mutation);
        };
        const { key, label, message } = entry;
        return [
          entry.kind === "failure"
            ? { key, label, message, kind: "failure", dismiss, retry }
            : { key, label, message, kind: "notice", dismiss },
        ];
      }),
    [client, entries],
  );
}
