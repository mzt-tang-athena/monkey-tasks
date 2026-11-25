import { taskIsDone, type TaskStatus } from "@monkey-tasks/schemas";
import type { SortMode } from "@/lib/settings";
import type { SectionTone } from "@/stores/tasks/selectors";
import type { TaskItem } from "@/types/task";

/**
 * The Board's five status groups, in the order design A stacks them.
 * The first three stay on the page, so an empty column still takes a
 * drop. Done and Dropped fold at the end (ADR
 * 20261125-deed-board-is-the-kanban-list).
 */
export const BOARD_STATUSES = [
  "active",
  "backlog",
  "someday",
  "done",
  "dropped",
] as const;

export type BoardStatus = (typeof BOARD_STATUSES)[number];

/** The group a status draws, and whether its rows fold. */
export const BOARD_GROUPS: Record<
  BoardStatus,
  { title: string; tone: SectionTone | "faint"; foldable: boolean }
> = {
  active: { title: "Active", tone: "ink", foldable: false },
  backlog: { title: "Backlog", tone: "ink", foldable: false },
  someday: { title: "Someday", tone: "ink", foldable: false },
  done: { title: "Done", tone: "faint", foldable: true },
  dropped: { title: "Dropped", tone: "faint", foldable: true },
};

/** One status group on the board: its header and its deeds. */
export type BoardSection = {
  /** The status key, which is also the group's identity. */
  key: BoardStatus;
  status: BoardStatus;
  title: string;
  tone: SectionTone | "faint";
  foldable: boolean;
  data: TaskItem[];
};

/** The bare status of a deed, or null for a plain task. */
export function deedStatus(task: TaskItem): BoardStatus | null {
  const status = task.data?.status;
  if (status == null) {
    return null;
  }
  const bare = status.replace(/^\[\[|\]\]$/g, "") as BoardStatus;
  return (BOARD_STATUSES as readonly string[]).includes(bare) ? bare : null;
}

/** Every deed, in the order the vault read gave them. */
export function selectDeeds(tasks: readonly TaskItem[]): TaskItem[] {
  return tasks.filter((task) => deedStatus(task) != null);
}

/** The status a drop writes: done carries a completed date, the rest
    carry none. A task that already has one keeps it. */
export function statusWrite(
  task: TaskItem,
  to: BoardStatus,
  completedAt: string,
): { status: TaskStatus; completed: string | null } {
  return {
    status: `[[${to}]]`,
    completed:
      to === "done" ? (task.data?.completed ?? completedAt) : null,
  };
}

/** Notes by their file name and their title, lowercased: what a
    wikilink may point at. */
export function notesByName(
  tasks: readonly TaskItem[],
): Map<string, TaskItem> {
  const byName = new Map<string, TaskItem>();
  for (const task of tasks) {
    byName.set(task.name.toLowerCase(), task);
    const title = task.data?.title;
    if (title != null && title !== "") {
      if (!byName.has(title.toLowerCase())) {
        byName.set(title.toLowerCase(), task);
      }
    }
  }
  return byName;
}

/** The note name a wikilink points at: no brackets, alias or heading,
    and the last path segment. */
export function linkName(link: string): string {
  const bare = link
    .trim()
    .replace(/^\[\[/, "")
    .replace(/\]\]$/, "")
    .split("|")[0]
    .split("#")[0]
    .trim();
  return bare.split("/").pop() ?? bare;
}

/**
 * The deed's first blocker that is still open, by name. A link that
 * reaches no note does not block; `vault:check` names it instead. A
 * deed is not ready while any linked note is not done (ADR
 * 20261124-deeds-are-tasks-with-a-status).
 */
export function blockerOf(
  task: TaskItem,
  byName: ReadonlyMap<string, TaskItem>,
): string | null {
  for (const link of task.data?.["blocked by"] ?? []) {
    const target = byName.get(linkName(link).toLowerCase());
    if (target == null || target.data == null || taskIsDone(target.data)) {
      continue;
    }
    return target.data.title ?? target.name;
  }
  return null;
}

/** Manual order, the lists' own rule: `order` ascending, then
    `created`, then the name. */
function byManualOrder(a: TaskItem, b: TaskItem): number {
  const left = a.data?.order;
  const right = b.data?.order;
  if (left != null && right != null) {
    return left - right || byCreated(a, b);
  }
  if (left != null) return -1;
  if (right != null) return 1;
  return byCreated(a, b);
}

function byCreated(a: TaskItem, b: TaskItem): number {
  const left = a.data?.created ?? "9999-99-99";
  const right = b.data?.created ?? "9999-99-99";
  return left.localeCompare(right) || a.name.localeCompare(b.name);
}

/** Due date ascending, undated last, ties by name. */
function byDue(a: TaskItem, b: TaskItem): number {
  const left = a.data?.due;
  const right = b.data?.due;
  if (left == null && right == null) return a.name.localeCompare(b.name);
  if (left == null) return 1;
  if (right == null) return -1;
  return left.localeCompare(right) || a.name.localeCompare(b.name);
}

/** Done and Dropped read by name, because their order means nothing. */
function byName(a: TaskItem, b: TaskItem): number {
  return a.name.localeCompare(b.name);
}

/**
 * The board's groups, always all five, each with its deeds in the
 * chosen order. A due-date sort turns the drag off, and orders the open
 * columns by due date; the folded columns stay by name.
 */
export function selectBoardSections(
  deeds: readonly TaskItem[],
  sortMode: SortMode = "manual",
): BoardSection[] {
  const compare = sortMode === "due" ? byDue : byManualOrder;
  return BOARD_STATUSES.map((status) => {
    const group = BOARD_GROUPS[status];
    const rows = deeds.filter((task) => deedStatus(task) === status);
    rows.sort(group.foldable ? byName : compare);
    return {
      key: status,
      status,
      title: group.title,
      tone: group.tone,
      foldable: group.foldable,
      data: rows,
    };
  });
}

/**
 * Hide the rows of each folded group. Only the view folds; the drag and
 * the tick read the groups before this step.
 */
export function foldBoard(
  sections: BoardSection[],
  open: (status: BoardStatus) => boolean,
): BoardSection[] {
  return sections.map((section) =>
    section.foldable && !open(section.status)
      ? { ...section, data: [] }
      : section,
  );
}
