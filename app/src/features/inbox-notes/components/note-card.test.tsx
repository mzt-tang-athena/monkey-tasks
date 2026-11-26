import * as React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { InboxNote } from "@/lib/inbox-notes/model";
import { NoteCard } from "./note-card";

function note(title: string): InboxNote {
  return {
    uri: `content://vault/Inbox/${title}.md`,
    fileName: `${title}.md`,
    stem: title,
    title,
    preview: "",
    text: "",
    sortKey: null,
  };
}

describe("NoteCard", () => {
  it("shows more of a long note when it is wide", () => {
    const text = Array.from({ length: 4 }, (_, line) =>
      `line ${line} ${"word ".repeat(20)}`.trim(),
    ).join("\n");
    const long = { ...note("long"), text, preview: "short preview" };
    const { unmount } = render(<NoteCard note={long} onPress={vi.fn()} />);
    expect(screen.getByText("short preview")).toBeTruthy();
    unmount();

    render(<NoteCard note={long} onPress={vi.fn()} wide />);
    expect(screen.queryByText("short preview")).toBeNull();
    expect(screen.getByText(/line 3 word/)).toBeTruthy();
  });

  it("shows the file name exactly as written", () => {
    const title = "20261023-flight-email-tracker";
    render(<NoteCard note={note(title)} onPress={vi.fn()} />);

    expect(screen.getByTestId("note-title").textContent).toBe(title);
  });

  it("names the card with the file name", () => {
    const title = "20261022-indented-paste";
    render(<NoteCard note={note(title)} onPress={vi.fn()} />);

    expect(screen.getByRole("button", { name: title })).toBeTruthy();
  });

  it("offers a line break after each hyphen and nowhere else", () => {
    render(
      <NoteCard
        note={note("20261023-flight-email-tracker")}
        onPress={vi.fn()}
      />,
    );

    const runs = [...screen.getByTestId("note-title").children].map(
      (run) => run.textContent,
    );
    expect(runs).toEqual(["20261023-", "flight-", "email-", "tracker"]);
  });

  it("keeps a name with no hyphen in one run", () => {
    const title = "have an agent monitor, organise and automate my emails";
    render(<NoteCard note={note(title)} onPress={vi.fn()} />);

    const runs = [...screen.getByTestId("note-title").children].map(
      (run) => run.textContent,
    );
    expect(runs).toEqual([title]);
  });

  it("joins back to the name for every hyphen shape", () => {
    for (const title of ["a--b", "-lead", "trail-", "-", "two words-here"]) {
      const { unmount } = render(
        <NoteCard note={note(title)} onPress={vi.fn()} />,
      );
      expect(screen.getByTestId("note-title").textContent).toBe(title);
      unmount();
    }
  });
});
