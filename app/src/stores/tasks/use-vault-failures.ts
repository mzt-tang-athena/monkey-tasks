import * as React from "react";
import {
  MutationObserver,
  useMutationState,
  useQueryClient,
  type Mutation,
  type QueryClient,
} from "@tanstack/react-query";
import { VAULT_SCOPE } from "./read-gate";
import { messageOf, type VaultMeta } from "./mutations/use-vault-mutation";

/** One line in the failure list: a write that failed, or a notice. */
export type VaultFailure = {
  /** Stable for the entry's life, for a React key. */
  key: number;
  kind: "failure" | "notice";
  /** The write's label, for example "tick". */
  label: string;
  message: string;
  /** Take the entry off the list. */
  dismiss(): void;
  /** Run the same write again. Only a failure has it. */
  retry?(): void;
};

type Entry = {
  key: number;
  kind: VaultFailure["kind"];
  label: string;
  message: string;
};

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
      entries.flatMap((entry) => {
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
        return [
          entry.kind === "failure"
            ? { ...entry, dismiss, retry }
            : { ...entry, dismiss },
        ];
      }),
    [client, entries],
  );
}
