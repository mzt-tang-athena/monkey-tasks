/**
 * A file name a document provider accepts. A task name is free text,
 * so it can carry a slash or a colon; a document provider refuses
 * those and the write fails. Illegal characters become spaces, and a
 * name with nothing left becomes "task".
 */
export function safeFileName(name: string): string {
  const cleaned = name
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "")
    .slice(0, 80)
    .trim();
  return cleaned === "" ? "task" : cleaned;
}
