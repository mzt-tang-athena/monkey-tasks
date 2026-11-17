/**
 * The last actions the app ran, for the crash report. The ring lives
 * in memory only: a breadcrumb is context for the next crash, not a
 * log of its own. A detail is a task title or a list name, never a
 * note body.
 */
export type BreadcrumbKind = "tick" | "open" | "tab" | "drag-start" | "drag-drop";

export type Breadcrumb = {
  at: string;
  kind: BreadcrumbKind;
  detail?: string;
};

export const BREADCRUMB_LIMIT = 20;
const DETAIL_LIMIT = 80;

const ring: Breadcrumb[] = [];

function clean(detail: string | undefined): string | undefined {
  if (detail == null) {
    return undefined;
  }
  const text = detail.replace(/\s+/g, " ").trim().slice(0, DETAIL_LIMIT);
  return text === "" ? undefined : text;
}

/** Add one action to the ring, dropping the oldest past the limit. */
export function recordBreadcrumb(
  kind: BreadcrumbKind,
  detail?: string,
  at: Date = new Date(),
): void {
  ring.push({ at: at.toISOString(), kind, detail: clean(detail) });
  if (ring.length > BREADCRUMB_LIMIT) {
    ring.shift();
  }
}

/** The ring, oldest first. Callers get a copy. */
export function readBreadcrumbs(): Breadcrumb[] {
  return ring.map((crumb) => ({ ...crumb }));
}

export function resetBreadcrumbs(): void {
  ring.length = 0;
}
