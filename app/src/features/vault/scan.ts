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

export async function listDirectory(folderUri: string): Promise<Entry[]> {
  const uris = await StorageAccessFramework.readDirectoryAsync(folderUri);
  return uris
    .map((uri) => {
      const name = displayName(uri);
      return { uri, name, isFile: name.includes(".") };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function findSubfolder(
  rootUri: string,
  name: string,
): Promise<string | null> {
  const entries = await listDirectory(rootUri);
  const found = entries.find((entry) => !entry.isFile && entry.name === name);
  return found?.uri ?? null;
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
