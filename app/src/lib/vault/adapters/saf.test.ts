import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-file-system/legacy", async () => {
  const { sharedFakeSaf } = await import("@/testing/fake-saf");
  return sharedFakeSaf.module;
});

import { sharedFakeSaf as saf } from "@/testing/fake-saf";
import { displayName, parentUri, safAdapter } from "./saf";

// Real SAF uris: the folder path is percent-encoded in the final
// segment, so a plain split("/") yields "primary%3A..." and a plain
// decode yields "Tasks/Lists". The display name is the last part.
const treeUri =
  "content://com.android.externalstorage.documents/tree/primary%3ADocuments%2Fvault";
const OLD_URI =
  "content://com.android.externalstorage.documents/tree/primary%3ADocuments%2Fvault/document/primary%3ADocuments%2Fvault%2FTasks%2FCall.md";
const FOLDER_URI =
  "content://com.android.externalstorage.documents/tree/primary%3ADocuments%2Fvault/document/primary%3ADocuments%2Fvault%2FTasks";

beforeEach(() => {
  saf.reset();
});

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

describe("safAdapter", () => {
  it("has no root before a grant, and none when the picker is cancelled", async () => {
    expect(await safAdapter.savedRoot()).toBeNull();

    saf.setGrant(false);

    expect(await safAdapter.requestRoot()).toBeNull();
    expect(await safAdapter.savedRoot()).toBeNull();
  });

  it("takes the empty file away when the create cannot write it", async () => {
    saf.put("Tasks/Call.md", "call");
    saf.failNextWrite();

    await expect(
      safAdapter.create(saf.uriOf("Tasks"), "Milk.md", "milk"),
    ).rejects.toThrow("disk full");

    expect(saf.paths()).toEqual(["Tasks/", "Tasks/Call.md"]);
  });
});
