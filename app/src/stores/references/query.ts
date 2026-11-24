import { queryOptions } from "@tanstack/react-query";
import type { VaultAdapter } from "@/lib/vault/adapter";
import { loadReferences } from "./notes";

/** The first part of the reference list key. */
export const REFERENCES_KEY = "references";

/** The cache entry for the References folder under one granted root. */
export function referencesKey(
  root: string | null,
): readonly [string, string | null] {
  return [REFERENCES_KEY, root];
}

/**
 * The read of the References folder. The picker filters the cached list
 * in memory, so a keystroke never reads the folder. The list holds
 * until the app returns to the foreground, when the read runs again so
 * a note added in Obsidian shows up without a restart. The app never
 * writes this folder, so nothing else has to invalidate it.
 */
export function referencesQueryOptions(
  adapter: VaultAdapter,
  root: string | null,
) {
  return queryOptions({
    queryKey: referencesKey(root),
    queryFn: () => loadReferences(adapter, root),
    enabled: root != null,
    networkMode: "always",
    refetchOnWindowFocus: "always",
    staleTime: Infinity,
  });
}
