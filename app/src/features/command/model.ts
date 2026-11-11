/**
 * A command is one row of the pane: a label the user searches and
 * reads, an optional hint that names the outcome, and the action it
 * runs. The row's id is stable, so the recent list survives a rebuild
 * of the commands after a write.
 */
export type Command = {
  id: string;
  label: string;
  hint?: string;
  /** Extra words the search matches, such as "capture" for Add task. */
  keywords?: string[];
  run: () => void;
};

/** The pane keeps this many recent command ids, newest first. */
export const recentLimit = 5;
/** The pane draws this many rows at most. */
export const rowLimit = 12;

function haystack(command: Command): string {
  return [command.label, command.hint ?? "", ...(command.keywords ?? [])]
    .join(" ")
    .toLowerCase();
}

/** The commands a query finds. An empty query finds every command. */
export function filterCommands(commands: Command[], query: string): Command[] {
  const needle = query.trim().toLowerCase();
  if (needle === "") {
    return commands;
  }
  return commands.filter((command) => haystack(command).includes(needle));
}

/**
 * The rows to draw: the recent commands first, newest first, then the
 * rest in their declared order, capped at the pane's row limit. A
 * recent id that no longer names a command is skipped.
 */
export function orderCommands(
  commands: Command[],
  recent: string[],
  limit = rowLimit,
): Command[] {
  const byId = new Map(commands.map((command) => [command.id, command]));
  const seen = new Set<string>();
  const rows: Command[] = [];
  for (const id of recent) {
    const command = byId.get(id);
    if (command != null && !seen.has(id)) {
      seen.add(id);
      rows.push(command);
    }
  }
  for (const command of commands) {
    if (!seen.has(command.id)) {
      seen.add(command.id);
      rows.push(command);
    }
  }
  return rows.slice(0, limit);
}

/** Record a command the user chose, at the front of the recent list. */
export function recordRecent(
  recent: string[],
  id: string,
  limit = recentLimit,
): string[] {
  return [id, ...recent.filter((item) => item !== id)].slice(0, limit);
}
