import * as FileSystem from "expo-file-system/legacy";

const { StorageAccessFramework } = FileSystem;

export type Entry = {
  uri: string;
  name: string;
  isFile: boolean;
};

/**
 * SAF document URIs carry the full relative path in the final
 * segment, for example "primary:Documents/vault/Tasks". The display
 * name is the part after the last slash.
 */
export function displayName(uri: string): string {
  const segment = uri.split("/").pop() ?? uri;
  const decoded = decodeURIComponent(segment);
  return decoded.split("/").pop() ?? decoded;
}

/**
 * SAF returns child document uris with no marker for file versus
 * folder, and `getInfoAsync` reports every content uri as a file.
 * Listing the child is the only reliable probe: it succeeds for a
 * folder and rejects for a document.
 */
export async function isDirectoryUri(uri: string): Promise<boolean> {
  try {
    await StorageAccessFramework.readDirectoryAsync(uri);
    return true;
  } catch {
    return false;
  }
}

export async function listDirectory(folderUri: string): Promise<Entry[]> {
  const uris = await StorageAccessFramework.readDirectoryAsync(folderUri);
  return uris
    .map((uri) => {
      const name = displayName(uri);
      // Cheap first pass: a name with a dot is a document. Callers that
      // need certainty (folder lookup) probe with isDirectoryUri.
      return { uri, name, isFile: name.includes(".") };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function findSubfolder(
  rootUri: string,
  name: string,
): Promise<string | null> {
  const entries = await listDirectory(rootUri);
  const match = entries.find((entry) => entry.name === name);
  if (!match) {
    return null;
  }
  // "Tasks 2.0" reads as a file to the dot heuristic. Probe before
  // deciding, otherwise ensureSubfolder makes a duplicate "Tasks".
  if (!match.isFile || (await isDirectoryUri(match.uri))) {
    return match.uri;
  }
  return null;
}

/** Find a subfolder or create it. Returns its uri. */
export async function ensureSubfolder(
  rootUri: string,
  name: string,
): Promise<string> {
  const found = await findSubfolder(rootUri, name);
  if (found) {
    return found;
  }
  return StorageAccessFramework.makeDirectoryAsync(rootUri, name);
}
