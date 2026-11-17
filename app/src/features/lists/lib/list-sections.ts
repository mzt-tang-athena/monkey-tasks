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
  /** The header's label, or null for the headerless My order group. */
  title: string | null;
  tone: SectionTone | "faint";
  data: TaskItem[];
};

/** The title of the quiet group at the end. */
export const completedTitle = "Completed";

/** The key of My order's single open group. A date label and the
    Completed title never equal it. */
export const myOrderKey = "my-order";

/**
 * The line an empty page shows. Main is the unfiled bucket, so its
 * line says what it holds and points at the list tabs.
 */
export function emptyListLabel(tab: string): string {
  return tab === "Main"
    ? "No unfiled tasks. Main holds only tasks with no list; filed tasks show on their list tab."
    : "Nothing on this list yet.";
}

/**
 * The screen's groups: the open ones in their sort order, then one
 * quiet Completed group when it has rows. A titled group's title names
 * it for the whole session ("Today", "Fri, 30 Oct"), so the title is
 * its key. My order's single group has no title, so it takes the
 * constant key.
 */
export function buildSections(
  open: TaskSection[],
  completed: TaskItem[],
): ListsSection[] {
  const sections: ListsSection[] = open.map((section) => ({
    key: section.title ?? myOrderKey,
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
