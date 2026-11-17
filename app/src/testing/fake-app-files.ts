/**
 * A stand-in for the `File`/`Paths` API of `expo-file-system`, for the
 * app-private files in a unit test. It keeps files by uri in memory
 * and records every write.
 */
export function createFakeAppFiles() {
  const files = new Map<string, string>();
  const writes: string[] = [];
  let writeFailure = false;
  const document = { uri: "file:///documents" };

  class File {
    readonly uri: string;

    constructor(...parts: (string | { uri: string })[]) {
      this.uri = parts
        .map((part) => (typeof part === "string" ? part : part.uri))
        .join("/");
    }

    get exists(): boolean {
      return files.has(this.uri);
    }

    get size(): number {
      return new TextEncoder().encode(files.get(this.uri) ?? "").length;
    }

    textSync(): string {
      const text = files.get(this.uri);
      if (text == null) {
        throw new Error(`no such file: ${this.uri}`);
      }
      return text;
    }

    writeSync(text: string, options?: { append?: boolean }): void {
      if (writeFailure) {
        throw new Error("disk full");
      }
      writes.push(this.uri);
      const previous = options?.append ? (files.get(this.uri) ?? "") : "";
      files.set(this.uri, previous + text);
    }

    delete(): void {
      files.delete(this.uri);
    }
  }

  return {
    File,
    document,
    files,
    writes,
    /** Fail every write until the next reset, as a full disk does. */
    failWrites(): void {
      writeFailure = true;
    },
    reset(): void {
      files.clear();
      writes.length = 0;
      writeFailure = false;
    },
  };
}

/** One instance per test file. Its `vi.mock` factory returns it. */
export const sharedFakeAppFiles = createFakeAppFiles();
