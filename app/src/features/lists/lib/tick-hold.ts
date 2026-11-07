import type { TaskItem } from "@/types/task";
import type { ListsSection } from "./list-sections";

/** How long a ticked row keeps its place before it regroups. */
export const tickHoldMs = 250;

/** Where a ticked row sat when the tap landed. */
export type TickHold = {
  uri: string;
  /** The key of the group the row sat in. */
  section: string;
  tone: ListsSection["tone"];
  /** The group's place among the groups. */
  sectionIndex: number;
  /** The row's place in its group. */
  index: number;
};

/**
 * A tick regroups the row into Completed in the same frame, which
 * would cut off the circle's own animation. This puts the held row
 * back where it was, so it stays mounted while the circle plays.
 *
 * `held` is the row with its new, completed data. With no hold, or a
 * row that is not done, the groups come back as they are.
 */
export function applyTickHold(
  sections: ListsSection[],
  hold: TickHold | null,
  tasks: TaskItem[],
): ListsSection[] {
  if (hold == null) {
    return sections;
  }
  const held = tasks.find((task) => task.uri === hold.uri);
  if (held == null || held.data?.completed == null) {
    return sections;
  }
  // Lift the row out of the group the tick pushed it into. A group it
  // leaves empty goes with it.
  const rest = sections
    .map((section) =>
      section.data.some((task) => task.uri === hold.uri)
        ? {
            ...section,
            data: section.data.filter((task) => task.uri !== hold.uri),
          }
        : section,
    )
    .filter((section) => section.data.length > 0);

  const at = rest.findIndex((section) => section.key === hold.section);
  if (at === -1) {
    // The row was its group's only task, so the group is gone. It
    // comes back at the place it held, and no further than the end.
    const next = rest.slice();
    next.splice(Math.min(hold.sectionIndex, next.length), 0, {
      key: hold.section,
      title: hold.section,
      tone: hold.tone,
      data: [held],
    });
    return next;
  }
  return rest.map((section, index) => {
    if (index !== at) {
      return section;
    }
    const cut = Math.min(hold.index, section.data.length);
    return {
      ...section,
      data: [...section.data.slice(0, cut), held, ...section.data.slice(cut)],
    };
  });
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
  return {
    uri: task.uri,
    section: section.key,
    tone: section.tone,
    sectionIndex,
    index: section.data.findIndex((item) => item.uri === task.uri),
  };
}
