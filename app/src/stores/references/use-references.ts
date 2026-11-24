import { useQuery } from "@tanstack/react-query";
import { useVault } from "@/lib/vault/vault-provider";
import type { ReferenceNote } from "@/types/reference";
import { referencesQueryOptions } from "./query";

/**
 * The References folder's notes, or null while the first read runs.
 * Every consumer asks with the same key, so the editor, the picker and
 * the preview share one read. With no folder granted there is nothing
 * to read, and the list is empty rather than pending.
 */
export function useReferenceNotes(): {
  notes: ReferenceNote[] | null;
  error: string | null;
} {
  const { adapter, root } = useVault();
  const query = useQuery(referencesQueryOptions(adapter, root));
  if (root == null) {
    return { notes: [], error: null };
  }
  return {
    notes: query.data ?? null,
    error: query.isError ? "The References folder could not be read." : null,
  };
}
