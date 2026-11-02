/**
 * The one port in front of the vault folder (ADR 0037). Every file call
 * goes through it. Android uses the SAF adapter. The web preview, the
 * component tests and Playwright use the memory adapter. A uri is
 * opaque outside the adapter that made it.
 */

/**
 * One entry in a folder. On SAF, `isFolder` is a cheap guess from the
 * name: a name with a dot reads as a file. `findFolder` checks.
 */
export type VaultEntry = { uri: string; name: string; isFolder: boolean };

export interface VaultAdapter {
  readonly kind: "saf" | "memory";
  /** The root the user granted before, or null. */
  savedRoot(): Promise<string | null>;
  /** Ask for a root. Null when the user cancels. */
  requestRoot(): Promise<string | null>;
  /** The entries in a folder, sorted by name. */
  list(folderUri: string): Promise<VaultEntry[]>;
  /**
   * The folder with this name, or null. A file with the name is not it.
   * SAF probes a name with a dot only, so there a file named "Tasks",
   * with no extension, passes for a folder.
   */
  findFolder(parentUri: string, name: string): Promise<string | null>;
  makeFolder(parentUri: string, name: string): Promise<string>;
  read(uri: string): Promise<string>;
  /** Replace the text of a file that exists. */
  write(uri: string, text: string): Promise<void>;
  /** The provider may rename a taken name, for example "x (1).md". */
  create(
    folderUri: string,
    fileName: string,
    text: string,
  ): Promise<{ uri: string; fileName: string }>;
  /** A file already gone is not an error. */
  remove(uri: string): Promise<void>;
  parentOf(uri: string): string;
}
