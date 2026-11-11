import { describe, expect, it } from "vitest";
import type { TaskItem } from "@/types/task";
import { carryIds } from "./rows";

function row(uri: string, id = uri): TaskItem {
  return {
    id,
    uri,
    fileName: uri.split("/").at(-1) ?? uri,
    name: uri,
    text: "",
    data: null,
    body: "",
  };
}

describe("carryIds", () => {
  it("keeps a captured row's provisional id when the read names it by uri", () => {
    const old = [row("Tasks/Milk.md", "pending://1")];
    const next = [row("Tasks/Milk.md")];
    expect(carryIds(old, next).map((item) => item.id)).toEqual(["pending://1"]);
  });

  it("keeps a renamed row's first id", () => {
    const old = [row("Tasks/New.md", "Tasks/Old.md")];
    const next = [row("Tasks/New.md")];
    expect(carryIds(old, next)[0].id).toBe("Tasks/Old.md");
  });

  it("gives a new note at a renamed row's old uri an id of its own", () => {
    const old = [row("Tasks/New.md", "Tasks/Old.md")];
    const next = [row("Tasks/Old.md"), row("Tasks/New.md")];
    const ids = carryIds(old, next).map((item) => item.id);
    expect(ids[1]).toBe("Tasks/Old.md");
    expect(ids[0]).not.toBe("Tasks/Old.md");
    expect(new Set(ids).size).toBe(2);
  });

  it("returns the read's own list when no id changes", () => {
    const next = [row("Tasks/A.md"), row("Tasks/B.md")];
    expect(carryIds([row("Tasks/A.md")], next)).toBe(next);
    expect(carryIds(undefined, next)).toBe(next);
  });
});
