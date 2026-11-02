import * as FileSystem from "expo-file-system/legacy";
import type { VaultAdapter, VaultEntry } from "../adapter";

const { StorageAccessFramework } = FileSystem;

/**
 * The vault on Android, through the Storage Access Framework. This is
 * the only file in the app that imports `expo-file-system/legacy`.
 */

/** The app's own file that remembers the granted folder. */
const PERMISSION_FILE = "vault-folder.txt";

function permissionFile(): string {
  return `${FileSystem.documentDirectory}${PERMISSION_FILE}`;
}

/**
 * SAF document uris carry the full relative path in the final segment,
 * for example "primary:Documents/vault/Tasks". The display name is the
 * part after the last slash.
 */
export function displayName(uri: string): string {
  const segment = uri.split("/").pop() ?? uri;
  const decoded = decodeURIComponent(segment);
  return decoded.split("/").pop() ?? decoded;
}

/**
 * Cut the last path segment of a SAF document uri. A child document is
 * addressed by its full path inside the encoded document id, so the
 * folder that holds it is the document id minus its last segment:
 * ".../document/primary%3ADocuments%2Fvault%2FTasks%2FCall.md" becomes
 * ".../document/primary%3ADocuments%2Fvault%2FTasks".
 *
 * The slashes inside the document id are percent-encoded, so the cut
 * happens on the decoded id and the result is encoded again; slicing
 * the uri itself would cut at "/document/" and hand the provider the
 * tree's document id instead of the folder's.
 */
export function parentUri(uri: string): string {
  const marker = "/document/";
  const at = uri.lastIndexOf(marker);
  if (at !== -1) {
    const head = uri.slice(0, at + marker.length);
    const documentId = decodeURIComponent(uri.slice(head.length));
    const cut = documentId.lastIndexOf("/");
    if (cut !== -1) {
      return `${head}${encodeURIComponent(documentId.slice(0, cut))}`;
    }
  }
  const cut = uri.lastIndexOf("/");
  return cut === -1 ? "" : uri.slice(0, cut);
}

/**
 * SAF returns child document uris with no marker for file versus
 * folder, and `getInfoAsync` reports every content uri as a file.
 * Listing the child is the only reliable probe: it succeeds for a
 * folder and rejects for a document.
 */
async function isDirectoryUri(uri: string): Promise<boolean> {
  try {
    await StorageAccessFramework.readDirectoryAsync(uri);
    return true;
  } catch {
    return false;
  }
}

async function list(folderUri: string): Promise<VaultEntry[]> {
  const uris = await StorageAccessFramework.readDirectoryAsync(folderUri);
  return uris
    .map((uri) => {
      const name = displayName(uri);
      // Cheap first pass: a name with a dot is a document. A caller
      // that needs certainty (findFolder) probes with isDirectoryUri.
      return { uri, name, isFolder: !name.includes(".") };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function write(uri: string, text: string): Promise<void> {
  await FileSystem.writeAsStringAsync(uri, text, {
    encoding: FileSystem.EncodingType.UTF8,
  });
}

async function remove(uri: string): Promise<void> {
  await FileSystem.deleteAsync(uri, { idempotent: true });
}

export const safAdapter: VaultAdapter = {
  kind: "saf",

  async savedRoot() {
    const uri = permissionFile();
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) {
      return null;
    }
    const value = await FileSystem.readAsStringAsync(uri);
    return value.trim() === "" ? null : value;
  },

  /** Open the system folder picker and persist the grant. */
  async requestRoot() {
    const result =
      await StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (!result.granted) {
      return null;
    }
    await FileSystem.writeAsStringAsync(permissionFile(), result.directoryUri, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    return result.directoryUri;
  },

  list,

  async findFolder(parentUri, name) {
    const entries = await list(parentUri);
    const match = entries.find((entry) => entry.name === name);
    if (!match) {
      return null;
    }
    // "Tasks 2.0" reads as a file to the dot heuristic. Probe before
    // deciding, otherwise a caller makes a second "Tasks".
    if (match.isFolder || (await isDirectoryUri(match.uri))) {
      return match.uri;
    }
    return null;
  },

  makeFolder(parentUri, name) {
    return StorageAccessFramework.makeDirectoryAsync(parentUri, name);
  },

  read(uri) {
    return FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.UTF8,
    });
  },

  write,

  /**
   * The provider appends " (1)" when the name is taken, so the result
   * carries the name the file really got. SAF creates an empty file
   * first. When the text cannot be written, the empty file goes again,
   * so a failed create leaves nothing behind.
   */
  async create(folderUri, fileName, text) {
    const uri = await StorageAccessFramework.createFileAsync(
      folderUri,
      fileName,
      "text/markdown",
    );
    try {
      await write(uri, text);
    } catch (error) {
      await remove(uri).catch(() => undefined);
      throw error;
    }
    return { uri, fileName: displayName(uri) };
  },

  remove,

  parentOf: parentUri,
};
