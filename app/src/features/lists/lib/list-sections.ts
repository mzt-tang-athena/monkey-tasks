import type { TaskItem } from "@/types/task";
import type { SectionTone, TaskSection } from "@/stores/tasks/selectors";

/**
 * One group on the Lists screen: a header and its rows. `key` is the
 * group's own identity, not its place in the list. `SectionList` keys
 * each row from it, so a row keeps its mount when a group above it
 * appears or leaves.
 */
export type ListsSection = {
  key: string;
  title: string;
  tone: SectionTone | "faint";
  data: TaskItem[];
};

/** The title of the quiet group at the end. */
export const completedTitle = "Completed";

/**
 * The screen's groups: the open ones in due order, then one quiet
 * Completed group when it has rows. Each open group's title names it
 * for the whole session ("Today", "Fri, 30 Oct"), so the title is
 * its key.
 */
export function buildSections(
  open: TaskSection[],
  completed: TaskItem[],
): ListsSection[] {
  const sections: ListsSection[] = open.map((section) => ({
    key: section.title,
    title: section.title,
    tone: section.tone,
    data: section.items,
  }));
  if (completed.length > 0) {
    sections.push({
      key: completedTitle,
      title: completedTitle,
      tone: "faint",
      data: completed,
    });
  }
  return sections;
}
