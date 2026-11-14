import { useQuery } from "@tanstack/react-query";
import { readReference } from "@/lib/journal/reference";
import { useVault } from "@/lib/vault/vault-provider";
import { JOURNAL_KEY } from "./query";

/**
 * One reference note, read only when a preview asks for it. The key
 * holds the root and the name, so a grant or another name is another
 * entry. `null` from the read means the note is missing, which is an
 * answer, not a failure.
 */
export function useReferenceNote(name: string | null) {
  const { adapter, root } = useVault();
  return useQuery<string | null>({
    queryKey: [JOURNAL_KEY, "reference", root, name],
    queryFn: () => readReference(adapter, root as string, name as string),
    enabled: name != null && root != null,
    networkMode: "always",
  });
}
