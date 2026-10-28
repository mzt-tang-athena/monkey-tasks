import { describe, expect, it } from "vitest";
import { parentUri } from "./rename";

const OLD_URI =
  "content://com.android.externalstorage.documents/tree/primary%3ADocuments%2Fvault/document/primary%3ADocuments%2Fvault%2FTasks%2FCall.md";
const FOLDER_URI =
  "content://com.android.externalstorage.documents/tree/primary%3ADocuments%2Fvault/document/primary%3ADocuments%2Fvault%2FTasks";

describe("parentUri", () => {
  it("cuts the last segment of an external storage document uri", () => {
    expect(parentUri(OLD_URI)).toBe(FOLDER_URI);
  });

  it("keeps the encoded document id intact when the name has a space", () => {
    expect(
      parentUri(
        "content://com.android.externalstorage.documents/tree/primary%3ADocuments%2Fvault/document/primary%3ADocuments%2Fvault%2FTasks%2FCall%20Mum.md",
      ),
    ).toBe(FOLDER_URI);
  });

  it("cuts the last segment of a downloads document uri", () => {
    expect(
      parentUri(
        "content://com.android.providers.downloads.documents/tree/downloads/document/downloads%2Fvault%2FTasks%2FCall.md",
      ),
    ).toBe(
      "content://com.android.providers.downloads.documents/tree/downloads/document/downloads%2Fvault%2FTasks",
    );
  });

  it("has no parent for a bare file name", () => {
    expect(parentUri("Call.md")).toBe("");
  });
});
