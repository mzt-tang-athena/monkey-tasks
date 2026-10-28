import { describe, expect, it } from "vitest";

import { displayName } from "./scan";

// Real SAF uris: the folder path is percent-encoded in the final
// segment, so a plain split("/") yields "primary%3A..." and a plain
// decode yields "Tasks/Lists". The display name is the last part.
const treeUri =
  "content://com.android.externalstorage.documents/tree/primary%3ADocuments%2Fvault";

describe("displayName", () => {
  it("names a tree document uri after its deepest folder", () => {
    expect(
      displayName(
        `${treeUri}/document/primary%3ADocuments%2Fvault%2FTasks%2FLists`,
      ),
    ).toBe("Lists");
  });

  it("names a nested file uri after the file", () => {
    expect(
      displayName(
        `${treeUri}/document/primary%3ADocuments%2Fvault%2FTasks%2FLists%2FErrands.md`,
      ),
    ).toBe("Errands.md");
  });
});
