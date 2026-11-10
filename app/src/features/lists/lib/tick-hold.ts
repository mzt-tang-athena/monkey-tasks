import type { TaskItem } from "@/types/task";
import type { ListsSection } from "./list-sections";

/** Where a ticked row sat when the tap landed. */
export type TickHold = {
  uri: string;
  /** The key of the group the row sat in. */
  section: string;
  tone: ListsSection["tone"];
  /** The group's place among the groups. */
  sectionIndex: number;
  /** The rows directly around it when the tick landed. A row that
      leaves meanwhile cannot push the held row past its neighbours. */
  after: string | null;
  before: string | null;
  /** The row's place in its group, for a group with no neighbour left. */
  index: number;
};

/**
 * Ticks regroup their rows into Completed in the same frame, which
 * would cut off each row's own animation. This puts every held row
 * back where it sat, so it stays mounted while the circle plays
 * (ADR 0034). Holds go back in the order they occupied, so a second
 * tick never moves the first.
 *
 * `held` is the rows with their new, completed data. With no hold, or
 * a row that is not done, the groups come back as they are.
 */
export function applyTickHold(
  sections: ListsSection[],
  holds: readonly TickHold[],
  tasks: TaskItem[],
): ListsSection[] {
  if (holds.length === 0) {
    return sections;
  }
  const byUri = new Map(tasks.map((task) => [task.uri, task]));
  const placed = holds
    .map((hold) => {
      const task = byUri.get(hold.uri);
      return task?.data?.completed == null ? null : { hold, task };
    })
    .filter((entry) => entry !== null);
  if (placed.length === 0) {
    return sections;
  }
  const taken = new Set(placed.map(({ hold }) => hold.uri));
  // Lift every held row out of the group the tick pushed it into. A
  // group it leaves empty goes with it.
  const rest = sections
    .map((section) =>
      section.data.some((task) => taken.has(task.uri))
        ? {
            ...section,
            data: section.data.filter((task) => !taken.has(task.uri)),
          }
        : section,
    )
    .filter((section) => section.data.length > 0);

  placed.sort(
    (a, b) =>
      a.hold.sectionIndex - b.hold.sectionIndex || a.hold.index - b.hold.index,
  );
  let next = rest;
  for (const { hold, task } of placed) {
    const at = next.findIndex((section) => section.key === hold.section);
    if (at === -1) {
      // The row was its group's only task, or the others left with it,
      // so the group is gone. It comes back at the place it held, and
      // no further than the end.
      const copy = next.slice();
      copy.splice(Math.min(hold.sectionIndex, copy.length), 0, {
        key: hold.section,
        title: hold.section,
        tone: hold.tone,
        data: [task],
      });
      next = copy;
      continue;
    }
    next = next.map((section, index) => {
      if (index !== at) {
        return section;
      }
      return {
        ...section,
        data: insertAmong(section.data, hold, task),
      };
    });
  }
  return next;
}

/** Puts the held row back next to the neighbour it stood by. Only a
    group with no neighbour left falls back to the saved index. */
function insertAmong(
  data: TaskItem[],
  hold: TickHold,
  task: TaskItem,
): TaskItem[] {
  const indexOf = (uri: string | null) =>
    uri == null ? -1 : data.findIndex((item) => item.uri === uri);
  const after = indexOf(hold.after);
  const before = indexOf(hold.before);
  let at = hold.index;
  if (after !== -1) {
    at = after + 1;
  } else if (before !== -1) {
    at = before;
  }
  at = Math.max(0, Math.min(at, data.length));
  return [...data.slice(0, at), task, ...data.slice(at)];
}

/** The hold for a row that is about to be ticked, read from the groups
    on screen. It is null for a row that is not in an open group. */
export function startTickHold(
  sections: ListsSection[],
  task: TaskItem,
): TickHold | null {
  const sectionIndex = sections.findIndex(
    (section) =>
      section.tone !== "faint" &&
      section.data.some((item) => item.uri === task.uri),
  );
  if (sectionIndex === -1) {
    return null;
  }
  const section = sections[sectionIndex];
  const index = section.data.findIndex((item) => item.uri === task.uri);
  return {
    uri: task.uri,
    section: section.key,
    tone: section.tone,
    sectionIndex,
    after: section.data[index - 1]?.uri ?? null,
    before: section.data[index + 1]?.uri ?? null,
    index,
  };
}
